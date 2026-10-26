import "server-only"

import Stripe from "stripe"

import { UserFacingError } from "@/lib/errors"
import { env } from "@/lib/env"

import {
  PLANS,
  TOPUPS,
  type BillingInterval,
  type PlanId,
  type TopupId,
} from "./plans"

let client: Stripe | undefined

export function stripe(): Stripe {
  if (process.env.BILLING_ENABLED !== "true")
    throw new UserFacingError("Payments are not activated.", "BILLING_DISABLED")
  const key = env().STRIPE_SECRET_KEY
  if (!key)
    throw new UserFacingError(
      "Payments aren't configured on this server yet.",
      "BILLING_DISABLED"
    )
  client ??= new Stripe(key, { appInfo: { name: "sless-studio" } })
  return client
}

export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true" && Boolean(env().STRIPE_SECRET_KEY)
}

function priceEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

export function planPriceId(
  plan: PlanId,
  interval: BillingInterval
): string | undefined {
  const names = PLANS[plan].stripePriceEnv
  return names
    ? priceEnv(interval === "year" ? names.year : names.month)
    : undefined
}

export function topupPriceId(pack: TopupId): string | undefined {
  return priceEnv(TOPUPS[pack].stripePriceEnv)
}

/** Reverse lookup from a Stripe price id to our plan + interval. */
export function planForPriceId(
  priceId: string
): { plan: PlanId; interval: BillingInterval } | undefined {
  for (const plan of Object.values(PLANS)) {
    if (!plan.stripePriceEnv) continue
    if (priceEnv(plan.stripePriceEnv.month) === priceId)
      return { plan: plan.id, interval: "month" }
    if (priceEnv(plan.stripePriceEnv.year) === priceId)
      return { plan: plan.id, interval: "year" }
  }
  return undefined
}

export function idOf(
  value: string | { id: string } | null | undefined
): string | undefined {
  if (!value) return undefined
  return typeof value === "string" ? value : value.id
}
