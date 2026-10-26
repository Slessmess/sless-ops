"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import type { EffectCard } from "./effects"
import { Masonry, MasonryItem } from "./masonry"
import { EffectTile } from "./media-tile"

/** Category chips (client-side filter) over the effects masonry. */
export function EffectsGallery({
  effects,
  categories,
}: {
  effects: EffectCard[]
  categories: readonly string[]
}) {
  const [active, setActive] = useState<string>("All")
  // Only offer categories that have at least one effect, in the canonical order.
  const chips = useMemo(
    () => [
      "All",
      ...categories.filter((category) =>
        effects.some((e) => e.category === category)
      ),
    ],
    [categories, effects]
  )
  const visible =
    active === "All"
      ? effects
      : effects.filter((effect) => effect.category === active)

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div
        role="group"
        aria-label="Filter effects by category"
        className="-mx-4 flex scrollbar-none gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {chips.map((chip) => {
          const pressed = chip === active
          const count =
            chip === "All"
              ? effects.length
              : effects.filter((e) => e.category === chip).length
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={pressed}
              onClick={() => setActive(chip)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium uppercase transition-colors duration-200",
                pressed
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-brand/5 bg-white/[0.01] text-white hover:bg-white/10"
              )}
            >
              {chip}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  pressed ? "text-brand/70" : "text-white/40"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {`Showing ${visible.length} ${active === "All" ? "" : `${active} `}effect${visible.length === 1 ? "" : "s"}`}
      </p>
      <Masonry columns={5} label="Effects">
        {visible.map((effect, index) => (
          <MasonryItem key={effect.slug}>
            <EffectTile effect={effect} cta="Use effect" eager={index < 5} />
          </MasonryItem>
        ))}
      </Masonry>
    </div>
  )
}
