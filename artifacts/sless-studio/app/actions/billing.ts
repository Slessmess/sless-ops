"use server"

import { runAction } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-types"
import { requireUser } from "@/lib/auth/session"
import {
  createCheckoutSession,
  createPortalSession,
} from "@/lib/billing/checkout"

export async function checkoutAction(
  input:
    | {
        kind: "plan"
        plan: "starter" | "plus" | "ultra"
        interval: "month" | "year"
      }
    | { kind: "topup"; pack: "small" | "medium" | "large" }
): Promise<ActionResult<{ url: string }>> {
  return runAction(async () =>
    createCheckoutSession(await requireUser(), input)
  )
}

export async function portalAction(): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => createPortalSession(await requireUser()))
}
