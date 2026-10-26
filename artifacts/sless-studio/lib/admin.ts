import "server-only"

import { ObjectId, type Filter } from "mongodb"
import { z } from "zod"

import { MODELS, findModel } from "@/generation/catalog"
import { UserFacingError } from "@/lib/errors"
import type { SessionUser } from "@/lib/auth/session"
import { objectIdOrNotFound } from "@/lib/ids"
import { NotFoundError } from "@/lib/errors"
import { grantCredits, totalCredits } from "@/lib/billing/ledger"
import { invalidatePricing, pricingContext } from "@/lib/billing/pricing"
import type { PriceRule } from "@/lib/billing/pricing-types"
import {
  collections,
  type GenerationDoc,
  type GenerationStatus,
  type ReportDoc,
} from "@/lib/db/collections"

/* ── Users ─────────────────────────────────────────────────────────────── */

export interface AdminUserRow {
  id: string
  email: string
  name?: string | null
  role: string
  plan: string
  credits: { subscription: number; topup: number }
  total: number
  generations: number
  billingFlag?: string
  createdAt: number
}

export async function searchUsers(query: string): Promise<AdminUserRow[]> {
  const { users, generations } = await collections()
  const q = query.trim().toLowerCase()
  const filter = q
    ? ObjectId.isValid(q) && q.length === 24
      ? { _id: new ObjectId(q) }
      : { email: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } }
    : {}
  const docs = await users
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()
  const counts = await generations
    .aggregate<{ _id: ObjectId; n: number }>([
      { $match: { userId: { $in: docs.map((d) => d._id) } } },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
    ])
    .toArray()
  const byId = new Map(counts.map((c) => [c._id.toHexString(), c.n]))
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role ?? "user",
    plan: doc.plan ?? "free",
    credits: doc.credits ?? { subscription: 0, topup: 0 },
    total: totalCredits(doc.credits),
    generations: byId.get(doc._id.toHexString()) ?? 0,
    ...(doc.billingFlag ? { billingFlag: doc.billingFlag.reason } : {}),
    createdAt: doc.createdAt?.getTime() ?? 0,
  }))
}

export const adjustSchema = z.object({
  userId: z.string(),
  bucket: z.enum(["subscription", "topup"]),
  delta: z.coerce
    .number()
    .int("Whole credits only.")
    .refine((n) => n !== 0, "Enter a non-zero amount.")
    .refine((n) => Math.abs(n) <= 1_000_000, "That's too many credits."),
  note: z
    .string()
    .trim()
    .min(3, "Add a note explaining the adjustment.")
    .max(200),
})

export async function adjustCredits(admin: SessionUser, raw: unknown) {
  const input = adjustSchema.parse(raw)
  const userId = objectIdOrNotFound(input.userId)
  const { users } = await collections()
  if (!(await users.findOne({ _id: userId })))
    throw new NotFoundError("User not found.")
  const result = await grantCredits({
    userId,
    bucket: input.bucket,
    amount: input.delta,
    reason: "admin_adjust",
    refType: "admin",
    refId: new ObjectId().toHexString(),
    note: input.note,
    actorId: admin.objectId,
  })
  return { balance: result.balance }
}

export async function clearBillingFlag(userId: string): Promise<void> {
  const { users } = await collections()
  await users.updateOne(
    { _id: objectIdOrNotFound(userId) },
    { $unset: { billingFlag: "" } }
  )
}

/* ── Generations ───────────────────────────────────────────────────────── */

export interface AdminGenerationRow {
  id: string
  userEmail: string
  modelId: string
  modelPath: string
  status: GenerationStatus
  cost: number
  refunded: number
  priceUsd: number
  hfRequestId?: string
  error?: string
  prompt: string
  isPublic: boolean
  thumb?: string
  kind?: string
  createdAt: number
  finishedAt?: number
}

export async function listAllGenerations(input: {
  status?: string
  modelId?: string
  cursor?: string
}): Promise<{ items: AdminGenerationRow[]; nextCursor: string | null }> {
  const { generations, users } = await collections()
  const filter: Filter<GenerationDoc> = {}
  if (input.status && input.status !== "all")
    filter.status = input.status as GenerationStatus
  if (input.modelId && findModel(input.modelId)) filter.modelId = input.modelId
  if (input.cursor && ObjectId.isValid(input.cursor))
    filter._id = { $lt: new ObjectId(input.cursor) }
  const docs = await generations
    .find(filter)
    .sort({ _id: -1 })
    .limit(51)
    .toArray()
  const page = docs.slice(0, 50)
  const owners = await users
    .find(
      { _id: { $in: page.map((d) => d.userId) } },
      { projection: { email: 1 } }
    )
    .toArray()
  const emails = new Map(owners.map((u) => [u._id.toHexString(), u.email]))
  return {
    items: page.map((doc) => ({
      id: doc._id.toHexString(),
      userEmail: emails.get(doc.userId.toHexString()) ?? "(deleted)",
      modelId: doc.modelId,
      modelPath: doc.modelPath,
      status: doc.status,
      cost: doc.cost,
      refunded: doc.refunded ?? 0,
      priceUsd: doc.priceUsd,
      ...(doc.hfRequestId ? { hfRequestId: doc.hfRequestId } : {}),
      ...(doc.error ? { error: doc.error } : {}),
      prompt: doc.prompt.slice(0, 160),
      isPublic: doc.isPublic,
      ...(doc.outputs[0]
        ? { thumb: doc.outputs[0].url, kind: doc.outputs[0].kind }
        : {}),
      createdAt: doc.createdAt.getTime(),
      ...(doc.finishedAt ? { finishedAt: doc.finishedAt.getTime() } : {}),
    })),
    nextCursor:
      docs.length > 50 ? (page.at(-1)?._id.toHexString() ?? null) : null,
  }
}

/* ── Models and pricing ────────────────────────────────────────────────── */

export interface AdminModelRow {
  id: string
  label: string
  surface: string
  family: string
  enabled: boolean
  paths: { path: string; rule?: PriceRule }[]
  repriceNeeded?: { path: string; liveUsd: number; ourUsd: number; at: number }
}

export async function listModelAdmin(): Promise<AdminModelRow[]> {
  const context = await pricingContext(true)
  const { modelPricing } = await collections()
  const docs = await modelPricing.find({}).toArray()
  const byModel = new Map(docs.map((doc) => [doc.modelId, doc]))
  // Every path a model can resolve to lives in its docs-backed mapper; we list
  // the priced paths whose prefix matches the model's family paths.
  return MODELS.map((model) => {
    const doc = byModel.get(model.id)
    const paths = pathsFor(model.id).map((path) => ({
      path,
      ...(context.usd[path] ? { rule: context.usd[path] } : {}),
    }))
    return {
      id: model.id,
      label: model.label,
      surface: model.surface,
      family: model.family,
      enabled: !context.disabled.has(model.id),
      paths,
      ...(doc?.repriceNeeded
        ? {
            repriceNeeded: {
              ...doc.repriceNeeded,
              at: doc.repriceNeeded.at.getTime(),
            },
          }
        : {}),
    }
  })
}

/** Paths a model's mapper can produce, discovered from the pricing table + catalog snapshots. */
function pathsFor(modelId: string): string[] {
  const model = findModel(modelId)
  if (!model) return []
  const candidates = new Set<string>()
  const base = { id: "p", url: "https://example.invalid/x", durationSec: 5 }
  const trials: Parameters<NonNullable<typeof model.toPlatform>>[0]["media"][] =
    [
      {},
      { start: [{ ...base, role: "start", kind: "image" }] },
      { reference: [{ ...base, role: "reference", kind: "image" }] },
      { video: [{ ...base, role: "video", kind: "video" }] },
      {
        source: [{ ...base, role: "source", kind: "video" }],
        reference: [{ ...base, role: "reference", kind: "image" }],
      },
      {
        start: [{ ...base, role: "start", kind: "image" }],
        source: [{ ...base, role: "source", kind: "video" }],
      },
      { source: [{ ...base, role: "source", kind: "video" }] },
    ]
  const variants: Record<string, unknown>[] = [{}]
  const enums = Object.entries(model.settings).filter(
    ([, field]) => field.type === "enum"
  )
  for (const [key, field] of enums)
    if (field.type === "enum")
      for (const value of field.values) variants.push({ [key]: value })
  // Pairs of small enums reach combinations like Recraft utility × 2k.
  const small = enums.filter(
    ([, field]) => field.type === "enum" && field.values.length <= 6
  )
  for (let i = 0; i < small.length; i++)
    for (let j = i + 1; j < small.length; j++) {
      const [keyA, fieldA] = small[i]!
      const [keyB, fieldB] = small[j]!
      if (fieldA.type !== "enum" || fieldB.type !== "enum") continue
      for (const a of fieldA.values)
        for (const b of fieldB.values) variants.push({ [keyA]: a, [keyB]: b })
    }
  for (const media of trials)
    for (const settings of variants) {
      try {
        const defaults = Object.fromEntries(
          Object.entries(model.settings).map(([key, field]) => [
            key,
            field.default,
          ])
        )
        const request = model.toPlatform?.({
          model: model.id,
          prompt: { text: "admin price probe" },
          media,
          settings: { ...defaults, ...settings },
        })
        if (request) candidates.add(request.path)
      } catch {
        /* combination not valid for this model */
      }
    }
  return [...candidates].sort()
}

export async function setModelEnabled(
  modelId: string,
  enabled: boolean
): Promise<void> {
  if (!findModel(modelId)) throw new UserFacingError("Unknown model.")
  const { modelPricing } = await collections()
  await modelPricing.updateOne(
    { modelId },
    { $set: { enabled: enabled === true, updatedAt: new Date() } },
    { upsert: true }
  )
  invalidatePricing()
}

export const overrideSchema = z.object({
  modelId: z.string(),
  path: z.string().min(3).max(200),
  usd: z.coerce.number().positive().max(100).nullable(),
  per: z.enum(["second", "output", "request"]).optional(),
})

export async function setPriceOverride(raw: unknown): Promise<void> {
  const input = overrideSchema.parse(raw)
  if (!findModel(input.modelId)) throw new UserFacingError("Unknown model.")
  if (!pathsFor(input.modelId).includes(input.path))
    throw new UserFacingError("That path doesn't belong to this model.")
  const context = await pricingContext(true)
  const { modelPricing } = await collections()
  if (input.usd === null) {
    await modelPricing.updateOne(
      { modelId: input.modelId },
      {
        $unset: { [`rules.${input.path}`]: "" },
        $set: { updatedAt: new Date() },
      }
    )
  } else {
    const current = context.usd[input.path]
    const rule: PriceRule = {
      ...(current ?? { per: input.per ?? "request" }),
      per: input.per ?? current?.per ?? "request",
      usd: input.usd,
      source: "admin",
    }
    await modelPricing.updateOne(
      { modelId: input.modelId },
      {
        $set: { [`rules.${input.path}`]: rule, updatedAt: new Date() },
        $unset: { repriceNeeded: "" },
        $setOnInsert: { enabled: true },
      },
      { upsert: true }
    )
  }
  invalidatePricing()
}

/* ── Moderation ────────────────────────────────────────────────────────── */

export interface ModerationItem {
  generationId: string
  prompt: string
  modelLabel: string
  thumb?: string
  kind?: string
  isPublic: boolean
  reports: { id: string; reason: string; details?: string; createdAt: number }[]
}

export async function moderationQueue(): Promise<ModerationItem[]> {
  const { reports, generations } = await collections()
  const open = await reports
    .find({ status: "open" })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()
  const grouped = new Map<string, ReportDoc[]>()
  for (const report of open) {
    const key = report.generationId.toHexString()
    grouped.set(key, [...(grouped.get(key) ?? []), report])
  }
  const docs = await generations
    .find({ _id: { $in: [...grouped.keys()].map((id) => new ObjectId(id)) } })
    .toArray()
  return docs.map((doc) => ({
    generationId: doc._id.toHexString(),
    prompt: doc.prompt,
    modelLabel: doc.modelLabel,
    ...(doc.outputs[0]
      ? { thumb: doc.outputs[0].url, kind: doc.outputs[0].kind }
      : {}),
    isPublic: doc.isPublic,
    reports: (grouped.get(doc._id.toHexString()) ?? []).map((report) => ({
      id: report._id.toHexString(),
      reason: report.reason,
      ...(report.details ? { details: report.details } : {}),
      createdAt: report.createdAt.getTime(),
    })),
  }))
}

export async function moderate(
  generationId: string,
  action: "unpublish" | "dismiss"
): Promise<void> {
  const { reports, generations } = await collections()
  const id = objectIdOrNotFound(generationId)
  if (action === "unpublish")
    await generations.updateOne(
      { _id: id },
      {
        $set: {
          isPublic: false,
          unpublishedByAdmin: true,
          updatedAt: new Date(),
        },
        $unset: { publishedAt: "" },
      }
    )
  await reports.updateMany(
    { generationId: id, status: "open" },
    { $set: { status: action === "unpublish" ? "actioned" : "dismissed" } }
  )
}
