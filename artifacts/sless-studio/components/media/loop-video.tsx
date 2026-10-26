"use client"

import { useEffect, useRef, type CSSProperties } from "react"

import { cn } from "@/lib/utils"
import { appPath } from "@/lib/paths"

/**
 * Muted, looping, inline video that only plays while on screen and never
 * under prefers-reduced-motion. React doesn't reflect `muted` as an attribute
 * on first render, which makes browsers block autoplay — so it's set here.
 */
export function LoopVideo({
  src,
  poster,
  className,
  style,
  playing = true,
  label,
}: {
  src: string
  poster?: string
  className?: string
  style?: CSSProperties
  /** Parent-controlled play (e.g. only on hover). */
  playing?: boolean
  label?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const visible = useRef(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    video.defaultMuted = true
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => {
      if (playing && visible.current && !reduce.matches)
        void video.play().catch(() => undefined)
      else video.pause()
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = Boolean(entry?.isIntersecting)
        sync()
      },
      { rootMargin: "200px" }
    )
    observer.observe(video)
    reduce.addEventListener("change", sync)
    sync()
    return () => {
      observer.disconnect()
      reduce.removeEventListener("change", sync)
    }
  }, [playing, src])

  return (
    <video
      ref={ref}
      src={appPath(src)}
      poster={appPath(poster)}
      loop
      muted
      playsInline
      preload="metadata"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("object-cover", className)}
      style={style}
    />
  )
}
