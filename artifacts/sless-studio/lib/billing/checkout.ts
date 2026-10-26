import "server-only"

import { z } from "zod"

import { UserFacingError } from "@/lib/errors"
import type { SessionUser } from "@/lib/auth/session"
import { collections } from "@/lib/db/collections"
import { env } from "@/lib/env"
import { enforceRateLimit } from "@/lib/rate-limit"

import { planOf, TOPUPS, topupCredits, type TopupId } from "./plans"
import { planPriceId, stripe, topupPriceId } from "./stripe"

export const checkoutSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    plan: z.enum(["starter", "plus", "ultra"]),
    interval: z.enum(["month", "year"]),
  }),
  z.object({
    kind: z.literal("topup"),
    pack: z.enum(["small", "medium", "large"]),
  }),
])

/** Stripe customer, created lazily at first checkout (never at sign-up). */
async function customerFor(user: SessionUser): Promise<string> {
  const { users } = await collections()
  const account = await users.findOne({ _id: user.objectId })
  if (!account) throw new UserFacingError("Account not found.")
  if (account.stripeCustomerId) return account.stripeCustomerId
  const customer = await stripe().customers.create(
    { email: account.email, metadata: { userId: user.id } },
    { idempotencyKey: `customer:${user.id}` }
  )
  const updated = await users.findOneAndUpdate(
    { _id: user.objectId, stripeCustomerId: { $exists: false } },
    { $set: { stripeCustomerId: customer.id } },
    { returnDocument: "after" }
  )
  return (
    updated?.stripeCustomerId ??
    (await users.findOne({ _id: user.objectId }))?.stripeCustomerId ??
    customer.id
  )
}

export async function createCheckoutSession(
  user: SessionUser,
  raw: unknown
): Promise<{ url: string }> {
  const input = checkoutSchema.parse(raw)
  await enforceRateLimit(
    `checkout:${user.id}`,
    10,
    60 * 10,
    "Too many checkout attempts. Try again in a few minutes."
  )
  const appUrl = env().APP_URL.replace(/\/$/, "")
  const { users } = await collections()
  const account = await users.findOne({ _id: user.objectId })
  if (!account) throw new UserFacingError("Account not found.")
  const customer = await customerFor(user)

  if (input.kind === "plan") {
    // Existing subscribers change plans in the Customer Portal (prorated).
    if (account.stripeSubscriptionId && account.plan !== "free")
      return createPortalSession(user)
    const price = planPriceId(input.plan, input.interval)
    if (!price)
      throw new UserFacingError(
        "This plan isn't available for purchase yet.",
        "PRICE_MISSING"
      )
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl}/account/billing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=canceled`,
      metadata: {
        userId: user.id,
        kind: "plan",
        plan: input.plan,
        interval: input.interval,
      },
      subscription_data: {
        metadata: { userId: user.id, plan: input.plan },
      },
    })
    if (!session.url) throw new UserFacingError("Could not start checkout.")
    return { url: session.url }
  }

  const pack = TOPUPS[input.pack as TopupId]
  const price = topupPriceId(pack.id)
  if (!price)
    throw new UserFacingError(
      "Top-ups aren't available for purchase yet.",
      "PRICE_MISSING"
    )
  // The credit amount is fixed now (plan bonus included) and granted by the webhook.
  const credits = topupCredits(pack, planOf(account.plan))
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/account/billing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=canceled#topups`,
    metadata: {
      userId: user.id,
      kind: "topup",
      pack: pack.id,
      credits: String(credits),
    },
    payment_intent_data: {
      metadata: {
        userId: user.id,
        kind: "topup",
        pack: pack.id,
        credits: String(credits),
      },
    },
  })
  if (!session.url) throw new UserFacingError("Could not start checkout.")
  return { url: session.url }
}

export async function createPortalSession(
  user: SessionUser
): Promise<{ url: string }> {
  await enforceRateLimit(
    `portal:${user.id}`,
    10,
    60 * 10,
    "Too many attempts. Try again in a few minutes."
  )
  const { users } = await collections()
  const account = await users.findOne({ _id: user.objectId })
  if (!account?.stripeCustomerId)
    throw new UserFacingError(
      "You don't have a billing account yet. Choose a plan first.",
      "NO_CUSTOMER"
    )
  const session = await stripe().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${env().APP_URL.replace(/\/$/, "")}/account/billing`,
  })
  return { url: session.url }
}
