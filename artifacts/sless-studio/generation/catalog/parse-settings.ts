import type { ModelEntry } from "./types"

/**
 * Settings from the client, checked against the catalog: unknown keys are
 * dropped, missing keys take the default, and anything out of range throws.
 * Integer ranges (step ≥ 1) reject fractions so the platform never sees 5.5 s.
 */
export function parseSettings(
  model: ModelEntry,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(model.settings)) {
    const value = raw[key]
    if (field.type === "enum") {
      const picked = typeof value === "string" ? value : field.default
      if (!field.values.includes(picked)) throw new Error(`Invalid ${key}`)
      out[key] = picked
      continue
    }
    if (field.type === "range") {
      const picked = typeof value === "number" ? value : field.default
      const step = field.step ?? 1
      if (
        !Number.isFinite(picked) ||
        picked < field.min ||
        picked > field.max ||
        (step >= 1 && !Number.isInteger(picked))
      )
        throw new Error(`Invalid ${key}`)
      out[key] = picked
      continue
    }
    out[key] = typeof value === "boolean" ? value : field.default
  }
  return out
}
