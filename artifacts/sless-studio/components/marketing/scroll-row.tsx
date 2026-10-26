"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Horizontally scrolling row with ‹ › buttons (desktop) and native swipe
 * (touch). Buttons disable at either end.
 */
export function ScrollRow({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const measure = useCallback(() => {
    const node = ref.current
    if (!node) return
    setEdges({
      start: node.scrollLeft <= 4,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    measure()
    node.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      node.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [measure])

  const scroll = (direction: 1 | -1) => {
    const node = ref.current
    if (!node) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    node.scrollBy({
      left: direction * node.clientWidth * 0.85,
      behavior: reduce ? "auto" : "smooth",
    })
  }

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={ref}
        role="list"
        aria-label={label}
        className="-mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 scrollbar-none gap-3 overflow-x-auto px-4 py-1"
      >
        {children}
      </ul>
      <div className="pointer-events-none absolute inset-y-0 -left-1 hidden items-center md:flex">
        <button
          type="button"
          aria-label={`Scroll ${label} left`}
          onClick={() => scroll(-1)}
          disabled={edges.start}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition-opacity hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 -right-1 hidden items-center md:flex">
        <button
          type="button"
          aria-label={`Scroll ${label} right`}
          onClick={() => scroll(1)}
          disabled={edges.end}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition-opacity hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  )
}
