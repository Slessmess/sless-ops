"use client"

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react"

import { SHOWCASE } from "@/lib/showcase"
import { cn } from "@/lib/utils"
import { appPath } from "@/lib/paths"

/** Left pane of the auth modal: a looping carousel of our own generations. */
export function AuthShowcase() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % SHOWCASE.length),
      4500
    )
    return () => window.clearInterval(timer)
  }, [])
  const slide = SHOWCASE[index]!
  return (
    <div className="relative size-full overflow-hidden rounded-2xl bg-surface">
      {SHOWCASE.map((item, i) => (
        <img
          key={item.src}
          src={appPath(item.src)}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700",
            i === index ? "opacity-100" : "opacity-0"
          )}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute inset-x-6 bottom-6 flex flex-col gap-3">
        <span className="w-fit rounded-lg bg-black/30 px-2.5 py-1 text-xs text-white/90 backdrop-blur-md">
          {slide.chip}
        </span>
        <p className="font-display text-4xl text-white">{slide.title}</p>
        <p className="text-sm text-white/60">{slide.caption}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {SHOWCASE.map((item, i) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setIndex(i)}
              className="flex flex-col gap-1.5 text-left"
              aria-label={`Show ${item.title}`}
            >
              <span className="h-1 overflow-hidden rounded-full bg-white/20">
                <span
                  className={cn(
                    "block h-full rounded-full bg-white",
                    i === index ? "w-full" : "w-0"
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-xs",
                  i === index ? "text-white" : "text-white/40"
                )}
              >
                {item.chip}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
