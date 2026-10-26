import { getModel, parseSettings } from "@/generation/catalog"
import { groupMedia, inferInputMode } from "@/generation/catalog/media-inputs"
import type { MediaItem, PlatformRequest } from "@/generation/catalog/types"
import { toPlatform } from "@/generation/to-platform"

import type { PriceRule, PricingTable } from "./pricing-types"

/**
 * priceFor — the one price function. Pure and shared: the Generate button
 * shows its result, and submitGeneration recomputes it on the server from
 * server-resolved media. The browser only ever sees credit rules (USD cost and
 * markup are folded in on the server), so it can't reverse our margins.
 */

/** A PriceRule with USD converted to (unrounded) credits per unit. */
export type CreditRule = Omit<PriceRule, "usd" | "source" | "perItem"> & {
  credits: number
  perItem?: { role: MediaItem["role"]; included: number; credits: number }
}
export type CreditTable = Record<string, CreditRule>

export type CreditConfig = { markup: number; creditUsd: number }

export type Quote = {
  credits: number
  path: string
  units: number
  /** Units were a guess (source length unknown); finalize refunds any overcharge. */
  provisional: boolean
  /** units = unitScale × source seconds + unitOffset, for the finalize true-up. */
  unitScale: number
  unitOffset: number
}

export function toCreditTable(
  table: PricingTable,
  { markup, creditUsd }: CreditConfig
): CreditTable {
  const toCredits = (usd: number) => (usd * markup) / creditUsd
  return Object.fromEntries(
    Object.entries(table).map(([path, rule]) => [
      path,
      {
        per: rule.per,
        ...(rule.field ? { field: rule.field } : {}),
        ...(rule.defaultUnits ? { defaultUnits: rule.defaultUnits } : {}),
        ...(rule.sourceLength ? { sourceLength: true } : {}),
        ...(rule.factors ? { factors: rule.factors } : {}),
        ...(rule.inputVideo ? { inputVideo: rule.inputVideo } : {}),
        ...(rule.perItem
          ? {
              perItem: {
                role: rule.perItem.role,
                included: rule.perItem.included,
                credits: toCredits(rule.perItem.usd),
              },
            }
          : {}),
        credits: toCredits(rule.usd),
      },
    ])
  )
}

type Unitized = Pick<
  PriceRule,
  "per" | "field" | "defaultUnits" | "sourceLength" | "factors" | "inputVideo"
>

type Units = {
  units: number
  provisional: boolean
  unitScale: number
  unitOffset: number
}

/** Generated units: from the body, else the source length, else a default. */
function generatedUnits(
  rule: Unitized,
  body: Record<string, unknown>,
  media: MediaItem[]
): { units: number; provisional: boolean; fromSource: boolean } {
  const plain = (units: number) => ({
    units,
    provisional: false,
    fromSource: false,
  })
  if (rule.per === "request") return plain(1)
  const field =
    rule.field ?? (rule.per === "second" ? "duration" : "batch_size")
  const raw = body[field]
  const fromBody = typeof raw === "number" ? raw : Number(raw)
  if (Number.isFinite(fromBody) && fromBody > 0) return plain(fromBody)
  if (rule.per === "output") return plain(1)
  if (rule.sourceLength) {
    const cap = rule.defaultUnits ?? 30
    const source = media.find((item) => item.role === "source")
    if (source?.durationSec && source.durationSec > 0)
      return {
        units: Math.min(cap, Math.max(1, Math.ceil(source.durationSec))),
        provisional: false,
        fromSource: true,
      }
    return { units: cap, provisional: true, fromSource: true }
  }
  return plain(rule.defaultUnits ?? 5)
}

/**
 * Units billed for one request, and whether they are a provisional guess.
 * With `inputVideo`, input videos add their (rounded-up) seconds and the
 * whole sum takes the with-video rate; a source video whose length sets the
 * output length counts twice (as input and as generated video).
 */
export function billableUnits(
  rule: Unitized,
  body: Record<string, unknown>,
  media: MediaItem[]
): Units {
  const generated = generatedUnits(rule, body, media)
  const plain: Units = {
    units: generated.units,
    provisional: generated.provisional,
    unitScale: generated.fromSource ? 1 : 0,
    unitOffset: generated.fromSource ? 0 : generated.units,
  }
  const extra = rule.inputVideo
  if (!extra || rule.per !== "second") return plain
  const inputs = media.filter(
    (item) => item.kind === "video" && extra.roles.includes(item.role)
  )
  if (!inputs.length) return plain
  let scale = plain.unitScale
  let offset = plain.unitOffset
  for (const item of inputs) {
    if (generated.fromSource && item.role === "source") scale += 1
    else
      offset +=
        item.durationSec && item.durationSec > 0
          ? Math.ceil(item.durationSec)
          : extra.maxSeconds
  }
  const sourceSeconds = generated.fromSource ? generated.units : 0
  return {
    units: (scale * sourceSeconds + offset) * extra.rate,
    provisional: generated.provisional,
    unitScale: scale * extra.rate,
    unitOffset: offset * extra.rate,
  }
}

/** Items beyond the rule's included count (e.g. extra reference images). */
export function extraItems(
  rule: { perItem?: { role: MediaItem["role"]; included: number } },
  media: MediaItem[]
): number {
  if (!rule.perItem) return 0
  const { role, included } = rule.perItem
  return Math.max(
    0,
    media.filter((item) => item.role === role).length - included
  )
}

export function factorFor(
  rule: Unitized,
  body: Record<string, unknown>
): number {
  let product = 1
  for (const [field, values] of Object.entries(rule.factors ?? {})) {
    const value = body[field]
    if (value === undefined) continue
    const factor = values[String(value)]
    if (typeof factor === "number") product *= factor
  }
  return product
}

/** Credits from a fractional amount: always ≥ 1, rounded up, float-noise safe. */
export function roundCredits(amount: number): number {
  return Math.max(1, Math.ceil(Math.round(amount * 1e6) / 1e6))
}

export function creditsFromUsd(usd: number, config: CreditConfig): number {
  return roundCredits((usd * config.markup) / config.creditUsd)
}

export function usdForRequest(
  rule: PriceRule,
  request: PlatformRequest,
  media: MediaItem[],
  unitsOverride?: number
): number {
  const units = unitsOverride ?? billableUnits(rule, request.body, media).units
  const extras = (rule.perItem?.usd ?? 0) * extraItems(rule, media)
  return rule.usd * units * factorFor(rule, request.body) + extras
}

export class PricingUnavailableError extends Error {
  constructor(path: string) {
    super(`This model is not priced yet (${path}).`)
    this.name = "PricingUnavailableError"
  }
}

/** Build the platform request the way submit will, for pricing. */
export function requestFor(
  modelId: string,
  settings: Record<string, unknown>,
  media: MediaItem[],
  prompt = ""
): PlatformRequest {
  const model = getModel(modelId)
  return toPlatform({
    model: model.id,
    inputMode: inferInputMode(model, media),
    // A price can be shown before the prompt is typed.
    prompt: { text: prompt.trim() || "price preview" },
    media: groupMedia(media),
    settings: parseSettings(model, settings),
  })
}

export function quoteRequest(
  request: PlatformRequest,
  media: MediaItem[],
  table: CreditTable
): Quote {
  const rule = table[request.path]
  if (!rule) throw new PricingUnavailableError(request.path)
  const { units, provisional, unitScale, unitOffset } = billableUnits(
    rule,
    request.body,
    media
  )
  const extras = (rule.perItem?.credits ?? 0) * extraItems(rule, media)
  return {
    credits: roundCredits(
      rule.credits * units * factorFor(rule, request.body) + extras
    ),
    path: request.path,
    units,
    provisional,
    unitScale,
    unitOffset,
  }
}

/** priceFor(modelId, settings, media) → credits, per the brief. Throws on invalid input. */
export function priceFor(
  modelId: string,
  settings: Record<string, unknown>,
  media: MediaItem[],
  table: CreditTable,
  prompt = ""
): Quote {
  return quoteRequest(
    requestFor(modelId, settings, media, prompt),
    media,
    table
  )
}

/** UI helper: the quote, or null while inputs are incomplete. */
export function tryPriceFor(
  modelId: string,
  settings: Record<string, unknown>,
  media: MediaItem[],
  table: CreditTable,
  prompt = ""
): Quote | null {
  try {
    return priceFor(modelId, settings, media, table, prompt)
  } catch {
    return null
  }
}

const ROLE_SAMPLE: Record<MediaItem["role"], MediaItem["kind"]> = {
  start: "image",
  end: "image",
  reference: "image",
  video: "video",
  audio: "audio",
  source: "video",
}

/** Default-settings quote for the picker's "from ✦N" (5 s sample inputs when required). */
export function fromPrice(modelId: string, table: CreditTable): number | null {
  const plain = tryPriceFor(modelId, {}, [], table)
  if (plain) return plain.credits
  const model = getModel(modelId)
  const needed = new Set(model.requiredRoles ?? [])
  if (!needed.size) {
    const firstRole = (Object.keys(model.roles) as MediaItem["role"][])[0]
    if (firstRole) needed.add(firstRole)
  }
  const sample: MediaItem[] = [...needed].map((role, index) => ({
    id: `sample-${index}`,
    url: `https://example.invalid/sample-${index}`,
    role,
    kind: ROLE_SAMPLE[role],
    durationSec: 5,
  }))
  if (needed.has("source") && model.roles.reference && !needed.has("reference"))
    sample.push({
      id: "sample-ref",
      url: "https://example.invalid/sample-ref",
      role: "reference",
      kind: "image",
    })
  return tryPriceFor(modelId, {}, sample, table)?.credits ?? null
}
