import "server-only"

import { NextResponse } from "next/server"

import { toFailure } from "@/lib/action-result"

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INSUFFICIENT_CREDITS: 402,
  INVALID: 400,
  INTERNAL: 500,
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

/** Known errors → { error, code } with a fitting status; others → 500. */
export function errorResponse(caught: unknown): NextResponse {
  const failure = toFailure(caught)
  return json(
    { error: failure.error, code: failure.code },
    STATUS_BY_CODE[failure.code] ?? 400
  )
}

/** Reject browser requests from another origin (defence in depth next to SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  return !origin || origin === new URL(request.url).origin
}
