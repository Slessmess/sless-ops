import "server-only"

import type { ObjectId } from "mongodb"

import { collections } from "@/lib/db/collections"

import { grantCredits } from "./ledger"
import { PLANS, type BillingInterval, type PlanId } from "./plans"

const MONTH_MS = 30 * 24 * 60 * 60_000

function addMonth(date: Date): Date {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

/**
 * A paid subscription invoice: reset the subscription bucket to the plan's
 * monthly allowance (idempotent on the invoice id) and record the plan.
 */
export async function applyPaidInvoice(input: {
  userId: ObjectId
  invoiceId: string
  plan: PlanId
  interval: BillingInterval
  subscriptionId: string
  periodEnd: Date
}): Promise<boolean> {
  const plan = PLANS[input.plan]
  const { users } = await collections()
  const result = await grantCredits({
    userId: input.userId,
    bucket: "subscription",
    amount: plan.monthlyCredits,
    mode: "reset",
    reason: "subscription_reset",
    refType: "invoice",
    refId: input.invoiceId,
    note: `${plan.name} (${input.interval === "year" ? "annual" : "monthly"})`,
  })
  const now = new Date()
  await users.updateOne(
    { _id: input.userId },
    {
      $set: {
        plan: input.plan,
        planInterval: input.interval,
        planStatus: "active",
        planRenewsAt: input.periodEnd,
        subscriptionAllowance: plan.monthlyCredits,
        stripeSubscriptionId: input.subscriptionId,
        ...(input.interval === "year" ? { nextGrantAt: addMonth(now) } : {}),
      },
      ...(input.interval === "month" ? { $unset: { nextGrantAt: "" } } : {}),
    }
  )
  return result.applied
}

/** Annual plans are billed yearly but granted monthly (reconciler step). */
export async function grantMonthlyAllowances(
  now = new Date()
): Promise<number> {
  const { users } = await collections()
  const due = await users
    .find({
      nextGrantAt: { $lte: now },
      planInterval: "year",
      planStatus: "active",
    })
    .limit(100)
    .toArray()
  let granted = 0
  for (const user of due) {
    if (!user.nextGrantAt) continue
    const plan = PLANS[user.plan]
    const period = user.nextGrantAt.toISOString().slice(0, 10)
    const result = await grantCredits({
      userId: user._id,
      bucket: "subscription",
      amount: plan.monthlyCredits,
      mode: "reset",
      reason: "subscription_reset",
      refType: "annual-grant",
      refId: `${user.stripeSubscriptionId ?? user._id.toHexString()}:${period}`,
      note: `${plan.name} monthly credits (annual plan)`,
    })
    const next = addMonth(user.nextGrantAt)
    await users.updateOne(
      { _id: user._id, nextGrantAt: user.nextGrantAt },
      {
        $set: {
          nextGrantAt:
            user.planRenewsAt && next > user.planRenewsAt
              ? new Date(user.planRenewsAt.getTime() + MONTH_MS)
              : next,
        },
      }
    )
    if (result.applied) granted++
  }
  return granted
}

/** Subscription ended: back to Free; unused subscription credits lapse. */
export async function endSubscription(
  userId: ObjectId,
  subscriptionId: string
): Promise<void> {
  const { users } = await collections()
  await grantCredits({
    userId,
    bucket: "subscription",
    amount: 0,
    mode: "reset",
    reason: "subscription_reset",
    refType: "subscription-ended",
    refId: subscriptionId,
    note: "Subscription ended",
  })
  await users.updateOne(
    { _id: userId, stripeSubscriptionId: subscriptionId },
    {
      $set: { plan: "free", planStatus: "canceled" },
      $unset: {
        planInterval: "",
        planRenewsAt: "",
        nextGrantAt: "",
        subscriptionAllowance: "",
        stripeSubscriptionId: "",
      },
    }
  )
}
