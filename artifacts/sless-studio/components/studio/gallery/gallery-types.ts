import type { LucideIcon } from "lucide-react"

import type { GenerationView } from "@/lib/generations/view"

/** Data model for the justified-masonry feed. width/height only need the right ratio. */
export type MediaKind = "image" | "video" | "audio"
export type ItemStatus = "ready" | "generating" | "failed"

export interface GalleryItem {
  id: string
  /** Run this item belongs to (one video, or one of N images). */
  runId: string
  projectId?: string
  createdAt: number
  kind: MediaKind
  status: ItemStatus
  /** Why a failed tile failed: drives the blocked vs failed treatment. */
  failureKind?: "failed" | "nsfw" | "canceled" | "submit" | "timeout"
  /** Queued vs running, for the generating label. */
  phase?: "starting" | "queued" | "in_progress"
  /** Still for images; poster (may be empty) for video. */
  src: string
  videoSrc?: string
  audioSrc?: string
  width: number
  height: number
  failureLabel?: string
  prompt: string
  alt: string
  modelLabel: string
  settings: Record<string, unknown>
  groupId: string
  groupLabel: string
  /** The generation behind the tile, for hover actions and the lightbox. */
  generation?: GenerationView
  /** Output index within a multi-image run. */
  outputIndex?: number
}

/** How near a tile is to the viewport — drives eager vs lazy loading. */
export type LoadTier = "full" | "near" | "far"

/** One hover-rail / lightbox action. */
export interface TileAction {
  id: string
  label: string
  icon: LucideIcon
  onSelect?: () => void
  danger?: boolean
}

export type TileActions = (item: GalleryItem) => TileAction[]
