import "server-only"

import { unstable_rethrow } from "next/navigation"

import type { Surface } from "@/generation/catalog/types"
import { listPublic, type PublicGeneration } from "@/lib/community"
import { listPresets } from "@/lib/presets"

import { toEffectCard, type EffectCard } from "./effects"

/** Active presets as marketing cards; empty (never throws) when the DB is unavailable. */
export async function loadEffects(): Promise<EffectCard[]> {
  try {
    const presets = await listPresets()
    return presets.map((preset, index) => toEffectCard(preset, index))
  } catch (error) {
    unstable_rethrow(error)
    console.error(
      "[marketing] presets unavailable",
      error instanceof Error ? error.message : error
    )
    return []
  }
}

/** A page of published generations; `failed` is set instead of throwing. */
export async function loadPublic(input: {
  surface?: Surface
  limit?: number
}): Promise<{
  items: PublicGeneration[]
  nextCursor: string | null
  failed: boolean
}> {
  try {
    const page = await listPublic(input)
    return { ...page, failed: false }
  } catch (error) {
    unstable_rethrow(error)
    console.error(
      "[marketing] community unavailable",
      error instanceof Error ? error.message : error
    )
    return { items: [], nextCursor: null, failed: true }
  }
}
