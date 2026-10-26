import { timingSafeEqual } from "node:crypto"

import { env } from "@/lib/env"
import { json } from "@/lib/http"
import { runToolJobs } from "@/lib/tools/jobs"

export const runtime = "nodejs"
// Long enough for a 10-minute clip with AI voice isolation (Vercel Pro).
export const maxDuration = 800

function authorized(request: Request): boolean {
  const secret = env().CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * Vercel Cron (every minute): runs Sless tool jobs that weren't started right
 * after their submit, or whose worker stopped (lib/tools/jobs.ts).
 */
export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Unauthorized" }, 401)
  return json({ ran: await runToolJobs({ budgetMs: 5 * 60_000 }) })
}

export const POST = GET
