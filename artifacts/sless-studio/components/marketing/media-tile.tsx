/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { Sparkles } from "lucide-react"

import { LoopVideo } from "@/components/media/loop-video"
import { cn } from "@/lib/utils"

import type { EffectCard } from "./effects"
import { appPath } from "@/lib/paths"

/** Fills its (aspect-ratio) parent with a lazy image or a muted on-screen loop. */
export function TileMedia({
  image,
  video,
  poster,
  alt = "",
  playing = true,
  eager = false,
  className,
}: {
  image: string
  video?: string
  poster?: string
  alt?: string
  playing?: boolean
  eager?: boolean
  className?: string
}) {
  if (video)
    return (
      <>
        {/* The still sits under the loop so the tile is never blank while the video loads. */}
        <img
          src={appPath(poster ?? image)}
          alt=""
          aria-hidden
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={cn("absolute inset-0 size-full object-cover", className)}
        />
        <LoopVideo
          src={appPath(video)}
          poster={appPath(poster ?? image)}
          playing={playing}
          className={cn("absolute inset-0 size-full", className)}
        />
      </>
    )
  return (
    <img
      src={appPath(image)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  )
}

/**
 * One effect preset as a masonry tile. Hover (or keyboard focus) darkens the
 * media and centres the title with a yellow chip; on touch screens the title
 * sits at the bottom instead, since there is no hover.
 */
export function EffectTile({
  effect,
  cta = "Recreate",
  aspect = effect.aspect,
  eager = false,
  className,
}: {
  effect: EffectCard
  cta?: string
  aspect?: number
  eager?: boolean
  className?: string
}) {
  return (
    <Link
      href={`/effects/${effect.slug}`}
      aria-label={`${effect.title} effect`}
      className={cn(
        "group relative block overflow-hidden rounded-xl bg-surface",
        className
      )}
      style={{ aspectRatio: String(aspect) }}
    >
      <TileMedia
        image={effect.image}
        video={effect.video}
        poster={appPath(effect.poster)}
        eager={eager}
      />
      <span
        aria-hidden
        className="font-display pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-10 pb-3 text-base leading-tight text-white md:hidden"
      >
        {effect.title}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 hidden flex-col items-center justify-center gap-3 bg-black/50 p-4 text-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 md:flex"
      >
        <span className="font-display text-[26px] leading-[1.05] text-white lg:text-[28px]">
          {effect.title}
        </span>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand/15 px-3 text-sm font-medium text-brand backdrop-blur-sm">
          <Sparkles className="size-4" /> {cta}
        </span>
      </span>
    </Link>
  )
}
