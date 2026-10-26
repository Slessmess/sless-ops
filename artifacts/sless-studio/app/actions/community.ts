"use server"

import { runAction } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-types"
import { requireUser } from "@/lib/auth/session"
import { reportGeneration } from "@/lib/community"

export async function reportGenerationAction(input: {
  generationId: string
  reason: "sexual" | "violence" | "hate" | "copyright" | "spam" | "other"
  details?: string
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    await reportGeneration(await requireUser(), input)
    return null
  })
}
