import type { MediaRole } from "@/generation/catalog/types"

/**
 * How Higgsfield bills one endpoint, expressed over the request body we send.
 *
 *   usd = usd × units × Π factors[field][String(body[field])] + perItem
 *
 * `per: "second"` reads units from `body[field ?? "duration"]` (or
 * `defaultUnits` when the endpoint derives length from a source video);
 * `per: "output"` reads the count from `body[field ?? "batch_size"]`
 * (default 1); `per: "request"` is a flat price.
 */
export type PriceRule = {
  usd: number
  per: "second" | "output" | "request"
  field?: string
  /** Units when the field is absent, e.g. edit endpoints billed on source length. */
  defaultUnits?: number
  /** True when output length follows a source video: charged up front at
      `defaultUnits`, then the difference is refunded from the real length. */
  sourceLength?: boolean
  factors?: Record<string, Record<string, number>>
  /**
   * Token-metered video models bill input videos too: when the request has
   * videos in these roles, units become (generated + input seconds) × rate.
   * Unknown input lengths count as `maxSeconds`.
   */
  inputVideo?: { roles: MediaRole[]; rate: number; maxSeconds: number }
  /** A flat charge per media item beyond the included count (e.g. extra references). */
  perItem?: { role: MediaRole; included: number; usd: number }
  /**
   * Where the number came from: "estimate" = POST /estimate (`pnpm
   * pricing:sync`); "description" = hand-derived from the pricing text the
   * estimate endpoint returns for token-metered models; "placeholder" =
   * unverified (not sold on the live platform until an admin sets a price);
   * "internal" = a Sless tool priced from our own costs (lib/tools).
   */
  source: "placeholder" | "estimate" | "description" | "admin" | "internal"
}

export type PricingTable = Record<string, PriceRule>
