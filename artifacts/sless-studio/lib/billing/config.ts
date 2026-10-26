import "server-only"

import type { CreditBucket } from "@/lib/db/collections"
import { env } from "@/lib/env"

import type { CreditConfig } from "./price"

/** Bucket behaviour (docs/decisions.md → Credits and pricing). */
export const BILLING_FLAGS = {
  /** Paid subscription invoices reset (not add to) the subscription bucket. */
  subscriptionResets: true,
  /** Order buckets are spent in. */
  spendOrder: [
    "subscription",
    "topup",
  ] as const satisfies readonly CreditBucket[],
  /** Refunds return credits to the buckets they came from. */
  refundToSource: true,
}

export function creditConfig(): CreditConfig {
  const value = env()
  return { markup: value.CREDIT_MARKUP, creditUsd: value.CREDIT_USD_VALUE }
}
