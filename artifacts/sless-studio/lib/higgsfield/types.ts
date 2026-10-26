import type { StoredMedia } from "@/lib/db/collections"

/** Request statuses, per https://docs.higgsfield.ai/docs/concepts/requests */
export type PlatformStatus =
  "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled"

export const PLATFORM_TERMINAL: ReadonlySet<string> = new Set([
  "completed",
  "failed",
  "nsfw",
  "canceled",
])

export type QueuedRequest = {
  status: string
  requestId: string
  statusUrl: string
  cancelUrl: string
}

export type PlatformArtifact = {
  kind: "image" | "video" | "audio" | "file"
  url: string
  contentType?: string
  /**
   * Set by Sless tools (lib/tools), whose results are already in our bucket:
   * finalize records them as they are instead of copying.
   */
  stored?: StoredMedia
}

export type RequestStatus = {
  status: string
  requestId: string
  artifacts: PlatformArtifact[]
  error?: string
}

export type UploadTicket = {
  upload_url: string
  public_url: string
  content_type: string
  upload_headers: Record<string, string>
}

export type Estimate = { credits: number; usd: number }
