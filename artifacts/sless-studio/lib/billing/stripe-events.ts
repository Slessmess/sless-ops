import "server-only"

import { ObjectId } from "mongodb"
import type Stripe from "stripe"

import CreditsAddedEmail, { creditsAddedText } from "@/emails/credits-added"
import { BRAND } from "@/lib/brand"
import { collections } from "@/lib/db/collections"
import { sendEmail } from "@/lib/email/send"
import { env } from "@/lib/env"

import { grantCredits, isDuplicateKey, totalCredits } from "./ledger"
import { planOf } from "./plans"
import { idOf, planForPriceId, stripe } from "./stripe"
import { applyPaidInvoice, endSubscription } from "./subscriptions"

/**
 * Stripe webhook events → credits. Every grant is keyed on a Stripe object id
 * in the ledger, so replays and duplicate deliveries are harmless; the
 * stripe_events collection additionally skips events already processed.
 */
export async function handleStripeEvent(
  event: Stripe.Event
): Promise<"processed" | "duplicate" | "ignored"> {
  const { stripeEvents } = await collections()
  if (await stripeEvents.findOne({ _id: event.id })) return "duplicate"
  const handled = await dispatch(event)
  try {
    await stripeEvents.insertOne({
      _id: event.id,
      type: event.type,
      processedAt: new Date(),
    })
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
  }
  return handled ? "processed" : "ignored"
}

async function dispatch(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await onCheckoutCompleted(event.data.object)
      return true
    case "invoice.paid":
      await onInvoicePaid(event.data.object)
      return true
    case "customer.subscription.updated":
      await onSubscriptionUpdated(event.data.object)
      return true
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object)
      return true
    case "charge.refunded":
      await onChargeRefunded(event.data.object)
      return true
    default:
      return false
  }
}

async function userFor(input: {
  userId?: string | null
  customerId?: string
}): Promise<ObjectId | undefined> {
  const { users } = await collections()
  if (input.userId && ObjectId.isValid(input.userId)) {
    const byId = await users.findOne(
      { _id: new ObjectId(input.userId) },
      { projection: { _id: 1 } }
    )
    if (byId) return byId._id
  }
  if (input.customerId) {
    const byCustomer = await users.findOne(
      { stripeCustomerId: input.customerId },
      { projection: { _id: 1 } }
    )
    if (byCustomer) return byCustomer._id
  }
  return undefined
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = idOf(session.customer)
  const userId = await userFor({
    userId: session.client_reference_id ?? session.metadata?.userId,
    customerId,
  })
  if (!userId) {
    console.error(`[stripe] checkout ${session.id} has no matching user`)
    return
  }
  const { users } = await collections()
  if (customerId)
    await users.updateOne(
      { _id: userId, stripeCustomerId: { $exists: false } },
      { $set: { stripeCustomerId: customerId } }
    )
  if (session.mode !== "payment" || session.metadata?.kind !== "topup") return
  if (session.payment_status !== "paid") return
  const credits = Number(session.metadata?.credits)
  if (!Number.isInteger(credits) || credits <= 0) {
    console.error(`[stripe] checkout ${session.id} has no credit amount`)
    return
  }
  const result = await grantCredits({
    userId,
    bucket: "topup",
    amount: credits,
    reason: "topup_purchase",
    refType: "checkout",
    refId: session.id,
    note: session.metadata?.pack
      ? `Top-up: ${session.metadata.pack}`
      : "Top-up",
  })
  if (!result.applied) return
  const user = await users.findOne({ _id: userId })
  if (user?.email)
    await sendEmail({
      to: user.email,
      subject: `✦ ${credits.toLocaleString("en-US")} credits added`,
      react: CreditsAddedEmail({
        brand: BRAND.name,
        credits,
        balance: totalCredits(result.balance),
        amountLabel: formatAmount(session.amount_total, session.currency),
        appUrl: env().APP_URL,
      }),
      text: creditsAddedText({
        brand: BRAND.name,
        credits,
        balance: totalCredits(result.balance),
        amountLabel: formatAmount(session.amount_total, session.currency),
        appUrl: env().APP_URL,
      }),
    }).catch((error) => console.error("[stripe] receipt email failed", error))
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "your purchase"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
  }).format(amount / 100)
}

const GRANTING_REASONS = new Set([
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
])

async function onInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.billing_reason || !GRANTING_REASONS.has(invoice.billing_reason))
    return
  if (!invoice.id) return
  const subscriptionId = idOf(
    invoice.parent?.subscription_details?.subscription
  )
  if (!subscriptionId) return
  const subscription = await stripe().subscriptions.retrieve(subscriptionId)
  const item = subscription.items.data[0]
  const mapped = item ? planForPriceId(item.price.id) : undefined
  if (!mapped) {
    console.error(
      `[stripe] invoice ${invoice.id}: unknown price on ${subscriptionId}`
    )
    return
  }
  const userId = await userFor({
    userId: subscription.metadata?.userId,
    customerId: idOf(invoice.customer),
  })
  if (!userId) {
    console.error(`[stripe] invoice ${invoice.id} has no matching user`)
    return
  }
  await applyPaidInvoice({
    userId,
    invoiceId: invoice.id,
    plan: mapped.plan,
    interval: mapped.interval,
    subscriptionId,
    periodEnd: new Date(
      (item?.current_period_end ?? invoice.period_end) * 1000
    ),
  })
}

async function onSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = await userFor({
    userId: subscription.metadata?.userId,
    customerId: idOf(subscription.customer),
  })
  if (!userId) return
  const item = subscription.items.data[0]
  const mapped = item ? planForPriceId(item.price.id) : undefined
  const { users } = await collections()
  const active =
    subscription.status === "active" || subscription.status === "trialing"
  await users.updateOne(
    { _id: userId },
    {
      $set: {
        planStatus: subscription.cancel_at_period_end
          ? "canceling"
          : subscription.status,
        stripeSubscriptionId: subscription.id,
        ...(item
          ? { planRenewsAt: new Date(item.current_period_end * 1000) }
          : {}),
        // Plan changes take effect once paid (invoice.paid resets credits);
        // a lapsed subscription keeps its credits until it is deleted.
        ...(active && mapped
          ? { plan: mapped.plan, planInterval: mapped.interval }
          : {}),
      },
    }
  )
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await userFor({
    userId: subscription.metadata?.userId,
    customerId: idOf(subscription.customer),
  })
  if (!userId) return
  await endSubscription(userId, subscription.id)
}

/**
 * A refunded top-up takes its credits back (never below zero). If they were
 * already spent, the account is flagged for admin review.
 */
async function onChargeRefunded(charge: Stripe.Charge) {
  const paymentIntent = idOf(charge.payment_intent)
  if (!paymentIntent || !charge.amount) return
  const sessions = await stripe().checkout.sessions.list({
    payment_intent: paymentIntent,
    limit: 1,
  })
  const session = sessions.data[0]
  const { users } = await collections()
  const userId = await userFor({
    userId: session?.client_reference_id ?? session?.metadata?.userId,
    customerId: idOf(charge.customer),
  })
  if (!userId) return
  if (!session || session.metadata?.kind !== "topup") {
    await users.updateOne(
      { _id: userId },
      {
        $set: {
          billingFlag: {
            reason: `Subscription charge ${charge.id} refunded; review credits manually.`,
            at: new Date(),
          },
        },
      }
    )
    return
  }
  const granted = Number(session.metadata?.credits ?? 0)
  const share = Math.min(1, charge.amount_refunded / charge.amount)
  const clawback = Math.floor(granted * share)
  if (clawback <= 0) return
  const result = await grantCredits({
    userId,
    bucket: "topup",
    amount: -clawback,
    clampAtZero: true,
    reason: "stripe_refund",
    refType: "charge",
    refId: `${charge.id}:${charge.amount_refunded}`,
    note: `Refund of ${session.id}`,
  })
  if (result.applied && -result.delta < clawback)
    await users.updateOne(
      { _id: userId },
      {
        $set: {
          billingFlag: {
            reason: `Refund ${charge.id}: ${clawback - -result.delta} credits were already spent.`,
            at: new Date(),
          },
        },
      }
    )
}

export { planOf }
