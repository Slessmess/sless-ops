import "server-only"

import { ObjectId, type Filter } from "mongodb"

import { NotFoundError } from "@/lib/errors"
import { totalCredits } from "@/lib/billing/ledger"
import { planOf, type BillingInterval, type PlanId } from "@/lib/billing/plans"
import { billingEnabled } from "@/lib/billing/stripe"
import {
  collections,
  type Credits,
  type LedgerDoc,
  type LedgerReason,
} from "@/lib/db/collections"

export interface AccountView {
  email: string
  name?: string | null
  image?: string | null
  role: "user" | "admin"
  plan: PlanId
  planName: string
  planInterval?: BillingInterval
  planStatus?: string
  planRenewsAt?: number
  credits: Credits
  total: number
  hasBillingAccount: boolean
  billingEnabled: boolean
  createdAt: number
}

export async function getAccount(userId: ObjectId): Promise<AccountView> {
  const { users } = await collections()
  const user = await users.findOne({ _id: userId })
  if (!user) throw new NotFoundError("Account not found.")
  const credits = user.credits ?? { subscription: 0, topup: 0 }
  const plan = planOf(user.plan)
  return {
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role ?? "user",
    plan: plan.id,
    planName: plan.name,
    ...(user.planInterval ? { planInterval: user.planInterval } : {}),
    ...(user.planStatus ? { planStatus: user.planStatus } : {}),
    ...(user.planRenewsAt ? { planRenewsAt: user.planRenewsAt.getTime() } : {}),
    credits,
    total: totalCredits(credits),
    hasBillingAccount: Boolean(user.stripeCustomerId),
    billingEnabled: billingEnabled(),
    createdAt: user.createdAt?.getTime() ?? 0,
  }
}

/** Live balance for the nav pill (never cached in the session). */
export async function getBalance(
  userId: ObjectId
): Promise<{ total: number; credits: Credits }> {
  const { users } = await collections()
  const user = await users.findOne(
    { _id: userId },
    { projection: { credits: 1 } }
  )
  const credits = user?.credits ?? { subscription: 0, topup: 0 }
  return { total: totalCredits(credits), credits }
}

export interface LedgerEntryView {
  id: string
  delta: number
  bucket: "subscription" | "topup"
  reason: LedgerReason
  label: string
  refType: string
  refId: string
  note?: string
  balanceAfter: number
  createdAt: number
}

const REASON_LABEL: Record<LedgerReason, string> = {
  generation_debit: "Generation",
  generation_refund: "Refund",
  generation_adjust: "Adjustment",
  subscription_grant: "Plan credits",
  subscription_reset: "Plan credits",
  topup_purchase: "Top-up",
  signup_bonus: "Welcome bonus",
  admin_adjust: "Adjustment by support",
  stripe_refund: "Payment refunded",
}

export function toLedgerView(doc: LedgerDoc): LedgerEntryView {
  return {
    id: doc._id.toHexString(),
    delta: doc.delta,
    bucket: doc.bucket,
    reason: doc.reason,
    label: REASON_LABEL[doc.reason],
    refType: doc.refType,
    refId: doc.refId,
    ...(doc.note ? { note: doc.note } : {}),
    balanceAfter: totalCredits(doc.balanceAfter),
    createdAt: doc.createdAt.getTime(),
  }
}

export async function listLedger(
  userId: ObjectId,
  cursor?: string,
  limit = 50
): Promise<{ items: LedgerEntryView[]; nextCursor: string | null }> {
  const { ledger } = await collections()
  const filter: Filter<LedgerDoc> = { userId }
  if (cursor && ObjectId.isValid(cursor))
    filter._id = { $lt: new ObjectId(cursor) }
  const docs = await ledger
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray()
  const page = docs.slice(0, limit)
  return {
    items: page.map(toLedgerView),
    nextCursor:
      docs.length > limit ? (page.at(-1)?._id.toHexString() ?? null) : null,
  }
}
