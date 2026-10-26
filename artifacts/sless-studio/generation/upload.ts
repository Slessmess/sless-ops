import { recordUploadAction } from "@/app/actions/uploads"
import type { UploadView } from "@/lib/generations/view"

import { parseUploadTicket, requireUploadContentType } from "./upload-contract"
import { appPath } from "@/lib/paths"

/**
 * Browser upload flow: ask our server for a signed platform upload URL, PUT
 * the file there with exactly the returned headers and no credentials, then
 * confirm so the server records (and copies) it. Signed URLs are never logged.
 */
export async function uploadMedia(file: File): Promise<UploadView> {
  const contentType = requireUploadContentType(file.type)
  const response = await fetch(appPath("/api/upload"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, size: file.size, name: file.name }),
  })
  const payload = (await response.json().catch(() => null)) as {
    ticket?: unknown
    token?: string
    error?: string
  } | null
  if (!response.ok || !payload?.ticket || !payload.token)
    throw new Error(
      payload?.error ??
        `Could not prepare the upload (${response.status}). Try again.`
    )
  const ticket = parseUploadTicket(payload.ticket, contentType)
  const uploaded = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: ticket.upload_headers,
    body: file,
    credentials: "omit",
  })
  if (!uploaded.ok)
    throw new Error(`Upload failed (${uploaded.status}). Try the file again.`)
  const recorded = await recordUploadAction({
    publicUrl: ticket.public_url,
    contentType,
    name: file.name,
    size: file.size,
    token: payload.token,
  })
  if (!recorded.ok) throw new Error(recorded.error)
  return recorded.data
}
