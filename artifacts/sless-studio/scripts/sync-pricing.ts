/**
 * Fill lib/billing/pricing.generated.json from the documented estimate
 * endpoint (POST /estimate/{path}, docs: concepts/billing-and-retention) with
 * the platform key in HF_CREDENTIALS. For every endpoint a catalog model can
 * reach it estimates the default request, the duration slope (per-second
 * endpoints) and each enum value the catalog offers on that endpoint.
 *
 *   pnpm pricing:sync            # writes the JSON, prints a diff table
 *   pnpm pricing:sync --dry-run  # prints only
 *
 * Endpoints that fetch their inputs need reachable sample media:
 *   PROBE_IMAGE=https://… PROBE_VIDEO=https://… pnpm pricing:sync
 * Token-metered endpoints answer with a pricing description instead of
 * numbers; they are listed at the end and priced by hand in pricing-table.ts.
 */
import "./load-env"

import { writeFileSync } from "node:fs"
import { join } from "node:path"

const { MODELS } = await import("../generation/catalog")
const { PLACEHOLDER_PRICING, PRICING_TABLE } =
  await import("../lib/billing/pricing-table")
const { EstimateDescriptionError, higgsfield } =
  await import("../lib/higgsfield/client")
type PriceRule = import("../lib/billing/pricing-types").PriceRule
type Model = (typeof MODELS)[number]
type Plane = Parameters<NonNullable<Model["toPlatform"]>>[0]
type Settings = Record<string, unknown>

const dryRun = process.argv.includes("--dry-run")
const client = higgsfield()
const image = process.env.PROBE_IMAGE ?? "https://example.com/sample.png"
const video = process.env.PROBE_VIDEO ?? "https://example.com/sample.mp4"
const item = (role: string, kind: "image" | "video", url: string) => ({
  id: role,
  url,
  role,
  kind,
})

const MEDIA_TRIALS = [
  {},
  { start: [item("start", "image", image)] },
  { reference: [item("reference", "image", image)] },
  { video: [item("video", "video", video)] },
  { source: [item("source", "video", video)] },
  {
    source: [item("source", "video", video)],
    reference: [item("reference", "image", image)],
  },
  {
    start: [item("start", "image", image)],
    source: [item("source", "video", video)],
  },
] as unknown as Plane["media"][]

type Probe = {
  model: Model
  media: Plane["media"]
  settings: Settings
  body: Record<string, unknown>
}

function defaults(model: Model): Settings {
  return Object.fromEntries(
    Object.entries(model.settings).map(([key, field]) => [key, field.default])
  )
}

function build(
  model: Model,
  media: Plane["media"],
  settings: Settings
): { path: string; body: Record<string, unknown> } | null {
  try {
    return model.toPlatform!({
      model: model.id,
      prompt: { text: "A calm lake at sunrise" },
      media,
      settings,
    })
  } catch {
    return null
  }
}

/** Setting variants: defaults, each enum value alone, and pairs of enums. */
function variants(model: Model): Settings[] {
  const base = defaults(model)
  const enums = Object.entries(model.settings).flatMap(([key, field]) =>
    field.type === "enum" ? [[key, field.values] as const] : []
  )
  const out: Settings[] = [base]
  for (const [key, values] of enums)
    for (const value of values) out.push({ ...base, [key]: value })
  for (let i = 0; i < enums.length; i++)
    for (let j = i + 1; j < enums.length; j++) {
      const [keyA, valuesA] = enums[i]!
      const [keyB, valuesB] = enums[j]!
      for (const a of valuesA)
        for (const b of valuesB) out.push({ ...base, [keyA]: a, [keyB]: b })
    }
  return out
}

/** The closest-to-default request for every endpoint a model can reach. */
function discover(): Map<string, Probe> {
  const found = new Map<string, Probe>()
  // Sless tools run on our servers and are priced in TOOL_PRICING, not here.
  for (const model of MODELS.filter((entry) => entry.runner !== "local"))
    for (const settings of variants(model))
      for (const media of MEDIA_TRIALS) {
        // Skip media sets submit would reject (e.g. an edit without its source).
        const roles = Object.keys(media ?? {})
        if ((model.requiredRoles ?? []).some((role) => !roles.includes(role)))
          continue
        const request = build(model, media, settings)
        if (request && !found.has(request.path))
          found.set(request.path, {
            model,
            media,
            settings,
            body: request.body,
          })
      }
  return found
}

type Outcome = { usd: number } | { description: string } | { error: string }

async function estimate(
  path: string,
  body: Record<string, unknown>
): Promise<Outcome> {
  try {
    return { usd: (await client.estimate(path, body)).usd }
  } catch (error) {
    if (error instanceof EstimateDescriptionError)
      return { description: error.description }
    return { error: (error as Error).message }
  }
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

/** Another allowed duration (the longest), to measure the per-second slope. */
function longerDuration(model: Model, current: number): unknown {
  const field = model.settings.duration
  if (!field) return undefined
  if (field.type === "enum") {
    const longest = [...field.values]
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > current)
      .sort((a, b) => b - a)[0]
    return longest === undefined ? undefined : String(longest)
  }
  if (field.type === "range" && field.max > current) return field.max
  return undefined
}

const out: Record<string, PriceRule> = {}
const rows: string[] = []
const described: string[] = []
const failures: string[] = []
const notes: string[] = []

for (const [path, probe] of discover()) {
  const current = PRICING_TABLE[path]
  if (!current) {
    failures.push(`${path}: no rule in pricing-table.ts (add one)`)
    continue
  }
  const base = await estimate(path, probe.body)
  if ("description" in base) {
    described.push(
      `${path} [${current.source}]\n      ${base.description.slice(0, 220)}`
    )
    continue
  }
  if ("error" in base) {
    failures.push(`${path}: ${base.error}`)
    continue
  }

  const rule: PriceRule = {
    per: current.per,
    usd: base.usd,
    source: "estimate",
    ...(current.field ? { field: current.field } : {}),
    ...(current.defaultUnits ? { defaultUnits: current.defaultUnits } : {}),
    ...(current.sourceLength ? { sourceLength: true } : {}),
    ...(current.inputVideo ? { inputVideo: current.inputVideo } : {}),
  }

  if (current.per === "second") {
    const d1 = Number(probe.body.duration)
    if (!Number.isFinite(d1) || d1 <= 0) {
      // Billed on a source video's length, which we can't measure here.
      failures.push(
        `${path}: billed on source length; price it by hand (Admin → Models)`
      )
      continue
    }
    let perSecond = base.usd / d1
    const durationField = probe.model.settings.duration
    if (durationField?.type === "enum") {
      // Fixed choices: price each allowed length exactly via a duration factor.
      const byDuration: Record<string, number> = { [String(d1)]: 1 }
      for (const value of durationField.values) {
        const variant = build(probe.model, probe.media, {
          ...probe.settings,
          duration: value,
        })
        const seconds = Number(variant?.body.duration)
        if (!variant || variant.path !== path || seconds === d1) continue
        const priced = await estimate(path, variant.body)
        if ("usd" in priced)
          byDuration[String(seconds)] = round(priced.usd / seconds / perSecond)
        else
          notes.push(
            `${path}: duration=${seconds} not estimable; priced at the ${d1}s rate`
          )
      }
      rule.usd = round(perSecond)
      rule.factors = { duration: byDuration }
    }
    const d2Setting =
      durationField?.type === "enum"
        ? undefined
        : longerDuration(probe.model, d1)
    const longer =
      d2Setting === undefined
        ? null
        : build(probe.model, probe.media, {
            ...probe.settings,
            duration: d2Setting,
          })
    if (longer?.path === path) {
      const d2 = Number(longer.body.duration)
      const priced = await estimate(path, longer.body)
      // max(): never undercharge at either end, whatever the fixed part.
      if ("usd" in priced && d2 > d1)
        perSecond = Math.max(perSecond, (priced.usd - base.usd) / (d2 - d1))
    }
    rule.usd = round(perSecond)
  } else if (current.per === "output") {
    rule.usd = round(base.usd / (Number(probe.body.batch_size ?? 1) || 1))
  } else {
    rule.usd = round(base.usd)
  }

  // Factors for every enum / switch value the catalog offers on this endpoint.
  const factors: Record<string, Record<string, number>> = {}
  for (const [key, field] of Object.entries(probe.model.settings)) {
    if (key === "duration" || key === "batchSize") continue
    const values: readonly unknown[] =
      field.type === "enum"
        ? field.values
        : field.type === "boolean"
          ? [true, false]
          : []
    for (const value of values) {
      const variant = build(probe.model, probe.media, {
        ...probe.settings,
        [key]: value,
      })
      if (!variant || variant.path !== path) continue
      const changed = Object.keys({ ...probe.body, ...variant.body }).filter(
        (name) =>
          JSON.stringify(probe.body[name]) !==
          JSON.stringify(variant.body[name])
      )
      if (changed.length === 0) continue
      if (changed.length > 1) {
        notes.push(`${path}: ${key}=${value} changes ${changed.join(", ")}`)
        continue
      }
      const bodyField = changed[0]!
      factors[bodyField] ??= { [String(probe.body[bodyField])]: 1 }
      const priced = await estimate(path, variant.body)
      const bodyValue = String(variant.body[bodyField])
      if ("usd" in priced) {
        factors[bodyField][bodyValue] = round(priced.usd / base.usd)
        continue
      }
      // Unpriceable value: keep the conservative placeholder factor if any.
      const fallback =
        PLACEHOLDER_PRICING[path]?.factors?.[bodyField]?.[bodyValue]
      if (fallback !== undefined && fallback >= 1)
        factors[bodyField][bodyValue] = fallback
      notes.push(
        `${path}: ${bodyField}=${bodyValue} not estimable (${"error" in priced ? priced.error : "description"})` +
          (fallback !== undefined && fallback >= 1
            ? `; kept factor ${fallback}`
            : "; runs with this value use factor 1 — check it")
      )
    }
  }
  if (Object.keys(factors).length)
    rule.factors = { ...rule.factors, ...factors }
  out[path] = rule
  rows.push(
    `${path.padEnd(58)} ${current.usd.toFixed(4).padStart(8)} → ${rule.usd.toFixed(4).padStart(8)} /${rule.per}`
  )
}

console.log(`\nendpoint${" ".repeat(51)}   before →  estimate`)
for (const row of rows) console.log(row)
if (described.length) {
  console.log(
    `\nPriced by description (hand-derived rules in pricing-table.ts):`
  )
  for (const line of described) console.log(`  ${line}`)
}
if (notes.length) {
  console.log(`\nNotes:`)
  for (const line of notes) console.log(`  ${line}`)
}
if (failures.length) {
  console.log(`\nNot synced (placeholders stay unsold on the live API):`)
  for (const line of failures) console.log(`  ${line}`)
}
if (!dryRun) {
  writeFileSync(
    join(process.cwd(), "lib/billing/pricing.generated.json"),
    JSON.stringify(out, null, 2) + "\n"
  )
  console.log(
    `\nWrote ${Object.keys(out).length} rules to lib/billing/pricing.generated.json`
  )
}
