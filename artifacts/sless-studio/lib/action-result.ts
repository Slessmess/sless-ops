import "server-only"

import { ZodError } from "zod"

import { NotFoundError, UnauthorizedError, UserFacingError } from "@/lib/errors"
import { InsufficientCreditsError } from "@/lib/billing/ledger"
import { RateLimitError } from "@/lib/rate-limit"

import type { ActionResult } from "./action-types"

export { UserFacingError }

/**
 * Run a server action body and return a typed result. Next.js hides thrown
 * messages in production, so known errors become `{ ok: false, error, code }`
 * and anything unexpected is logged and reported generically.
 */
export async function runAction<T>(
  work: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() }
  } catch (caught) {
    return toFailure(caught)
  }
}

export function toFailure(caught: unknown): {
  ok: false
  error: string
  code: string
} {
  if (caught instanceof UnauthorizedError)
    return { ok: false, error: caught.message, code: caught.code }
  if (caught instanceof NotFoundError)
    return { ok: false, error: caught.message, code: caught.code }
  if (caught instanceof InsufficientCreditsError)
    return { ok: false, error: caught.message, code: caught.code }
  if (caught instanceof RateLimitError)
    return { ok: false, error: caught.message, code: caught.code }
  if (caught instanceof UserFacingError)
    return { ok: false, error: caught.message, code: caught.code }
  if (caught instanceof ZodError)
    return {
      ok: false,
      error: caught.issues[0]?.message ?? "Invalid request.",
      code: "INVALID",
    }
  console.error("[action] unexpected error", caught)
  return {
    ok: false,
    error: "Something went wrong. Please try again.",
    code: "INTERNAL",
  }
}
