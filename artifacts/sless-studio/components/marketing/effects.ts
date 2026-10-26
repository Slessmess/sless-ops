import type { Surface } from "@/generation/catalog/types"

/**
 * The slice of a preset the marketing pages render. Built on the server from
 * `PresetView` so prompt templates and settings never reach the browser.
 */
export interface EffectCard {
  slug: string
  title: string
  description: string
  surface: Surface
  modelLabel: string
  category: string
  image: string
  video?: string
  poster: string
  /** width / height of the tile. */
  aspect: number
}

/** Our generated loops: landscape ones are 16:9, everything else is 9:16. */
const LANDSCAPE_LOOPS = ["hero", "kling", "seedance"]

function loopAspect(url: string): number {
  const name =
    url
      .split("/")
      .pop()
      ?.replace(/\.mp4$/, "") ?? ""
  return LANDSCAPE_LOOPS.includes(name) ? 16 / 9 : 9 / 16
}

/** Stills are 3:4; vary the crop a little so the masonry has rhythm. */
const STILL_ASPECTS = [3 / 4, 2 / 3, 4 / 5, 3 / 4, 3 / 5, 4 / 5]

export function toEffectCard(
  preset: {
    slug: string
    title: string
    description: string
    surface: Surface
    modelLabel: string
    category: string
    coverUrl: string
    coverVideoUrl?: string
  },
  index: number
): EffectCard {
  const video = preset.coverVideoUrl || undefined
  const poster =
    video && video.startsWith("/media/loops/")
      ? video.replace(/\.mp4$/, ".jpg")
      : preset.coverUrl
  return {
    slug: preset.slug,
    title: preset.title,
    description: preset.description,
    surface: preset.surface,
    modelLabel: preset.modelLabel,
    category: preset.category,
    image: preset.coverUrl,
    ...(video ? { video } : {}),
    poster,
    aspect: video
      ? loopAspect(video)
      : STILL_ASPECTS[index % STILL_ASPECTS.length]!,
  }
}
