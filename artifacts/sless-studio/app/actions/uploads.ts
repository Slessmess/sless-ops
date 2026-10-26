"use server"

import { runAction } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-types"
import { requireUser } from "@/lib/auth/session"
import type { UploadView } from "@/lib/generations/view"
import { deleteUpload, recordUpload } from "@/lib/uploads"

export async function recordUploadAction(input: {
  publicUrl: string
  contentType: string
  name: string
  size: number
  token: string
}): Promise<ActionResult<UploadView>> {
  return runAction(async () => recordUpload(await requireUser(), input))
}

export async function deleteUploadAction(
  id: string
): Promise<ActionResult<null>> {
  return runAction(async () => {
    await deleteUpload((await requireUser()).objectId, id)
    return null
  })
}
