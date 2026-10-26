"use client"

import Link from "next/link"
import { useRef, useState, type KeyboardEvent } from "react"
import { Loader2, RotateCw, Sparkles, Users } from "lucide-react"

import type { PublicGeneration } from "@/lib/community"
import { cn } from "@/lib/utils"

import { CommunityWall } from "./community-wall"
import { EmptyCard } from "./empty-card"
import { appPath } from "@/lib/paths"

type Filter = "all" | "image" | "video"

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
]

type Page = { items: PublicGeneration[]; nextCursor: string | null }

async function fetchPage(
  filter: Filter,
  cursor: string | null,
  signal: AbortSignal
): Promise<Page> {
  const params = new URLSearchParams()
  if (filter !== "all") params.set("surface", filter)
  if (cursor) params.set("cursor", cursor)
  const response = await fetch(appPath(`/api/community?${params.toString()}`), {
    signal,
  })
  if (!response.ok)
    throw new Error(`Community feed answered ${response.status}`)
  return (await response.json()) as Page
}

/** /community: All · Images · Videos tabs over a paginated masonry of published work. */
export function CommunityFeed({
  initial,
  initialCursor,
  initialError = false,
}: {
  initial: PublicGeneration[]
  initialCursor: string | null
  initialError?: boolean
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [items, setItems] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [status, setStatus] = useState<"idle" | "switching" | "more" | "error">(
    initialError ? "error" : "idle"
  )
  const request = useRef<AbortController | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const load = async (nextFilter: Filter, nextCursor: string | null) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setStatus(nextCursor ? "more" : "switching")
    try {
      const page = await fetchPage(nextFilter, nextCursor, controller.signal)
      if (controller.signal.aborted) return
      setItems((current) =>
        nextCursor ? [...current, ...page.items] : page.items
      )
      setCursor(page.nextCursor)
      setStatus("idle")
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        return
      if (!nextCursor) {
        setItems([])
        setCursor(null)
      }
      setStatus("error")
    }
  }

  const choose = (next: Filter) => {
    if (next === filter && status !== "error") return
    setFilter(next)
    void load(next, null)
  }

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (!delta && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (index + delta + TABS.length) % TABS.length
    tabRefs.current[target]?.focus()
    choose(TABS[target]!.value)
  }

  return (
    <div className="flex flex-col gap-8">
      <div
        role="tablist"
        aria-label="Filter community generations"
        className="mx-auto flex items-center gap-1 rounded-xl bg-surface p-1"
      >
        {TABS.map((tab, index) => {
          const active = tab.value === filter
          return (
            <button
              key={tab.value}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              type="button"
              role="tab"
              id={`community-tab-${tab.value}`}
              aria-selected={active}
              aria-controls="community-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => choose(tab.value)}
              onKeyDown={(event) => onTabKey(event, index)}
              className={cn(
                "h-8 rounded-lg px-4 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        id="community-panel"
        role="tabpanel"
        aria-labelledby={`community-tab-${filter}`}
        aria-busy={status === "switching"}
        className={cn(
          "transition-opacity",
          status === "switching" && "opacity-50"
        )}
      >
        {items.length > 0 ? (
          <CommunityWall items={items} columns={4} eagerCount={8} />
        ) : status === "switching" ? (
          <SkeletonWall />
        ) : status === "error" ? (
          <EmptyCard
            icon={<RotateCw className="size-5" aria-hidden />}
            title="The feed didn't load"
            body="Something went wrong on our side. Give it another try."
            action={
              <button
                type="button"
                onClick={() => void load(filter, null)}
                className="h-10 rounded-lg bg-white/5 px-4 text-sm font-medium hover:bg-white/10"
              >
                Try again
              </button>
            }
          />
        ) : (
          <EmptyCard
            icon={<Users className="size-5" aria-hidden />}
            title={
              filter === "all"
                ? "Be the first to publish"
                : `No ${filter === "image" ? "images" : "videos"} published yet`
            }
            body="Open any finished generation in your library and choose Publish — it will show up here for everyone."
            action={
              <Link
                href={filter === "image" ? "/image" : "/video"}
                className="btn-keycap inline-flex h-10 items-center gap-2 px-4 text-xs"
              >
                <Sparkles className="size-4" aria-hidden /> Start creating
              </Link>
            }
          />
        )}

        {items.length > 0 && status === "error" ? (
          <p role="alert" className="mt-6 text-center text-sm text-[#ff6b6b]">
            Couldn&apos;t load more. Try again in a moment.
          </p>
        ) : null}

        {items.length > 0 && cursor ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => void load(filter, cursor)}
              disabled={status === "more"}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/5 px-6 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              {status === "more" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {status === "more" ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SkeletonWall() {
  const heights = [320, 220, 280, 360, 240, 300, 260, 340]
  return (
    <div
      className="columns-2 gap-2 md:columns-3 md:gap-3 lg:columns-4"
      aria-hidden
    >
      {heights.map((height, index) => (
        <div
          key={index}
          className="mb-2 shimmer break-inside-avoid rounded-xl bg-surface md:mb-3"
          style={{ height }}
        />
      ))}
    </div>
  )
}
