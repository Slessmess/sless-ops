import "server-only"

import { MongoServerError, ObjectId, type ClientSession } from "mongodb"

import {
  collections,
  type CreditBucket,
  type Credits,
  type LedgerReason,
} from "@/lib/db/collections"
import { mongoClient } from "@/lib/db/mongo"

import { BILLING_FLAGS } from "./config"

/**
 * The credit ledger. Balances live on the user document for fast checks;
 * every change also appends a ledger row in the same transaction. The unique
 * index {reason, refType, refId, bucket} makes each grant, debit and refund
 * apply at most once, so webhooks and retries can replay freely.
 */

export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS"
  constructor(
    readonly needed: number,
    readonly available: number
  ) {
    super(`This generation costs ${needed} credits and you have ${available}.`)
    this.name = "InsufficientCreditsError"
  }
}

export const EMPTY_CREDITS: Credits = { subscription: 0, topup: 0 }

export function totalCredits(credits: Partial<Credits> | undefined): number {
  return (credits?.subscription ?? 0) + (credits?.topup ?? 0)
}

/** Split a charge across buckets in spend order. */
export function splitDebit(balance: Credits, amount: number): Credits {
  const split: Credits = { subscription: 0, topup: 0 }
  let remaining = amount
  for (const bucket of BILLING_FLAGS.spendOrder) {
    const take = Math.min(Math.max(balance[bucket], 0), remaining)
    split[bucket] = take
    remaining -= take
  }
  if (remaining > 0)
    throw new InsufficientCreditsError(amount, totalCredits(balance))
  return split
}

/** Run `work` in a transaction (retried on transient errors by the driver). */
export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>
): Promise<T> {
  const client = await mongoClient()
  const session = client.startSession()
  try {
    let result: T | undefined
    await session.withTransaction(
      async () => {
        result = await work(session)
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
      }
    )
    return result as T
  } finally {
    await session.endSession()
  }
}

type Entry = {
  userId: ObjectId
  reason: LedgerReason
  refType: string
  refId: string
  note?: string
  actorId?: ObjectId
}

async function alreadyApplied(
  entry: Entry,
  session: ClientSession
): Promise<boolean> {
  const { ledger } = await collections()
  return (
    (await ledger.countDocuments(
      { reason: entry.reason, refType: entry.refType, refId: entry.refId },
      { session, limit: 1 }
    )) > 0
  )
}

/**
 * Apply signed per-bucket deltas atomically. Negative deltas are guarded so no
 * bucket goes below zero; returns false when this (reason, ref) was already
 * applied.
 */
export async function applyDeltas(
  entry: Entry,
  deltas: Partial<Credits>,
  session: ClientSession
): Promise<{ applied: boolean; balance: Credits }> {
  const { users, ledger } = await collections()
  if (await alreadyApplied(entry, session)) {
    const user = await users.findOne({ _id: entry.userId }, { session })
    return { applied: false, balance: user?.credits ?? EMPTY_CREDITS }
  }
  const inc: Record<string, number> = {}
  const guard: Record<string, unknown> = { _id: entry.userId }
  for (const bucket of ["subscription", "topup"] as const) {
    const delta = deltas[bucket] ?? 0
    if (!delta) continue
    inc[`credits.${bucket}`] = delta
    if (delta < 0) guard[`credits.${bucket}`] = { $gte: -delta }
  }
  const updated = await users.findOneAndUpdate(
    guard,
    { $inc: inc },
    { session, returnDocument: "after" }
  )
  if (!updated) {
    const user = await users.findOne({ _id: entry.userId }, { session })
    if (!user) throw new Error("User not found")
    const needed = -Object.values(deltas).reduce((a, b) => a + (b ?? 0), 0)
    throw new InsufficientCreditsError(needed, totalCredits(user.credits))
  }
  const balance = updated.credits
  const rows = (["subscription", "topup"] as const)
    .filter((bucket) => deltas[bucket])
    .map((bucket) => ({
      _id: new ObjectId(),
      userId: entry.userId,
      delta: deltas[bucket]!,
      bucket,
      reason: entry.reason,
      refType: entry.refType,
      refId: entry.refId,
      balanceAfter: balance,
      ...(entry.note ? { note: entry.note } : {}),
      ...(entry.actorId ? { actorId: entry.actorId } : {}),
      createdAt: new Date(),
    }))
  if (rows.length) await ledger.insertMany(rows, { session })
  return { applied: true, balance }
}

/** Debit a generation's cost in spend order. Throws InsufficientCreditsError. */
export async function debitGeneration(
  userId: ObjectId,
  generationId: ObjectId,
  cost: number,
  session: ClientSession
): Promise<Credits> {
  const { users } = await collections()
  const user = await users.findOne({ _id: userId }, { session })
  if (!user) throw new Error("User not found")
  const split = splitDebit(user.credits ?? EMPTY_CREDITS, cost)
  await applyDeltas(
    {
      userId,
      reason: "generation_debit",
      refType: "generation",
      refId: generationId.toHexString(),
    },
    { subscription: -split.subscription, topup: -split.topup },
    session
  )
  return split
}

/**
 * Return credits for a generation, at most once per reason. A full refund
 * ("generation_refund") returns whatever has not been returned yet to the
 * buckets it came from; a partial adjustment ("generation_adjust") returns
 * `amount`, topup first.
 */
export async function refundGeneration(
  generationId: ObjectId,
  reason: "generation_refund" | "generation_adjust",
  amount?: number
): Promise<{ refunded: number }> {
  return withTransaction(async (session) => {
    const { generations } = await collections()
    const gen = await generations.findOne({ _id: generationId }, { session })
    if (!gen) return { refunded: 0 }
    const outstanding = gen.cost - (gen.refunded ?? 0)
    const value = Math.min(amount ?? outstanding, outstanding)
    if (value <= 0) return { refunded: 0 }
    const back = refundSplit(gen.costSplit, gen.refunded ?? 0, value)
    const result = await applyDeltas(
      {
        userId: gen.userId,
        reason,
        refType: "generation",
        refId: generationId.toHexString(),
      },
      back,
      session
    )
    if (!result.applied) return { refunded: 0 }
    await generations.updateOne(
      { _id: generationId },
      { $inc: { refunded: value }, $set: { updatedAt: new Date() } },
      { session }
    )
    return { refunded: value }
  })
}

/** Which buckets a refund goes back to. */
export function refundSplit(
  costSplit: Credits,
  alreadyRefunded: number,
  value: number
): Credits {
  // Adjustments and full refunds both return topup first (never expires),
  // bounded by what each bucket actually paid, net of earlier returns.
  let prior = alreadyRefunded
  const remaining: Credits = { ...costSplit }
  for (const bucket of ["topup", "subscription"] as const) {
    const used = Math.min(remaining[bucket], prior)
    remaining[bucket] -= used
    prior -= used
  }
  const back: Credits = { subscription: 0, topup: 0 }
  let left = value
  const order: CreditBucket[] = ["topup", "subscription"]
  for (const bucket of order) {
    const give = Math.min(remaining[bucket], left)
    back[bucket] = give
    left -= give
  }
  return back
}

/**
 * Add or reset a bucket (grants, purchases, admin adjustments).
 * `mode: "reset"` sets the subscription bucket to `amount`.
 */
export async function grantCredits(input: {
  userId: ObjectId
  bucket: CreditBucket
  amount: number
  mode?: "add" | "reset"
  reason: LedgerReason
  refType: string
  refId: string
  note?: string
  actorId?: ObjectId
  /** Clamp a negative delta at the current balance instead of failing. */
  clampAtZero?: boolean
}): Promise<{ applied: boolean; delta: number; balance: Credits }> {
  return withTransaction(async (session) => {
    const { users } = await collections()
    const user = await users.findOne({ _id: input.userId }, { session })
    if (!user) throw new Error("User not found")
    const current = user.credits?.[input.bucket] ?? 0
    let delta = input.mode === "reset" ? input.amount - current : input.amount
    if (delta < 0 && input.clampAtZero) delta = -Math.min(current, -delta)
    const result = await applyDeltas(
      {
        userId: input.userId,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        note: input.note,
        actorId: input.actorId,
      },
      { [input.bucket]: delta },
      session
    )
    return { applied: result.applied, delta, balance: result.balance }
  })
}

export function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}
