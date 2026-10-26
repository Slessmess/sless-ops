/* eslint-disable @next/next/no-img-element */
"use client"

import { useState } from "react"
import { Flag, Link2, Play, Sparkles } from "lucide-react"

import type { TileAction } from "@/components/studio/gallery/gallery-types"
import { GenerationDetailModal } from "@/components/studio/generation-detail"
import { LoopVideo } from "@/components/media/loop-video"
import { useApp, useToast } from "@/components/providers/app-providers"
import type { PublicGeneration } from "@/lib/community"
import { cn } from "@/lib/utils"

import { formatDate, initialOf, settingRows } from "./format"
import { Masonry, MasonryItem } from "./masonry"
import { useRecreate } from "./recreate-button"
import { ReportDialog } from "./report-dialog"
import { appPath } from "@/lib/paths"

export function AuthorAvatar({
  name,
  image,
  className,
}: {
  name: string
  image?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-[11px] font-semibold text-foreground ring-1 ring-white/15",
        className
      )}
    >
      {image ? (
        <img src={appPath(image)} alt="" className="size-full object-cover" />
      ) : (
        initialOf(name)
      )}
    </span>
  )
}

/** Clamp extreme ratios so one tall upload can't take over a column. */
function tileAspect(item: PublicGeneration): number {
  const output = item.outputs[0]
  const ratio =
    output?.width && output.height
      ? output.width / output.height
      : item.aspect > 0
        ? item.aspect
        : 1
  return Math.min(Math.max(ratio, 9 / 16), 16 / 9)
}

function CommunityTile({
  item,
  onReport,
  eager,
}: {
  item: PublicGeneration
  onReport: (id: string) => void
  eager: boolean
}) {
  const { user, openAuth } = useApp()
  const toast = useToast()
  const recreate = useRecreate()
  const [hover, setHover] = useState(false)
  const output = item.outputs[0]
  if (!output) return null
  const isVideo = output.kind === "video"
  const alt = item.prompt.slice(0, 140)

  const actions: TileAction[] = [
    {
      id: "recreate",
      label: "Recreate",
      icon: Sparkles,
      onSelect: () =>
        void recreate({
          surface: item.surface,
          modelId: item.modelId,
          prompt: item.prompt,
          settings: item.settings,
        }),
    },
    {
      id: "copy-link",
      label: "Copy link",
      icon: Link2,
      onSelect: () => {
        const url = `${window.location.origin}${appPath(`/g/${item.id}`)}`
        void navigator.clipboard
          ?.writeText(url)
          .then(() => toast.success("Link copied"))
          .catch(() => toast.error("Couldn't copy the link", url))
      },
    },
    {
      id: "report",
      label: "Report",
      icon: Flag,
      danger: true,
      onSelect: () => {
        if (!user) {
          openAuth({ mode: "login", reason: "Sign in to report a generation." })
          return
        }
        onReport(item.id)
      },
    },
  ]

  const rows = [
    { id: "model", label: "Model", value: item.modelLabel },
    ...settingRows(item.modelId, item.settings),
    {
      id: "published",
      label: "Published",
      value: formatDate(item.publishedAt),
    },
  ]

  return (
    <GenerationDetailModal
      generation={{
        src: output.url,
        mediaType: output.kind,
        prompt: item.prompt,
        model: item.modelLabel,
        createdAt: item.publishedAt,
        settings: item.settings,
        author: item.author,
        aspectRatio: tileAspect(item),
      }}
      rows={rows}
      actions={actions}
      trigger={
        <button
          type="button"
          aria-label={`Open ${isVideo ? "video" : "image"} by ${item.author.name}: ${alt}`}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-surface text-left"
          style={{ aspectRatio: String(tileAspect(item)) }}
        >
          {isVideo ? (
            // No poster for community clips; the #t fragment makes Safari paint a first frame.
            <LoopVideo
              src={appPath(`${output.url}#t=0.1`)}
              playing={hover}
              className="absolute inset-0 size-full"
            />
          ) : (
            <img
              src={appPath(output.url)}
              alt=""
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {isVideo ? (
            <span
              aria-hidden
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-black/40 text-white backdrop-blur-sm transition-opacity group-hover:opacity-0"
            >
              <Play className="size-3.5 fill-white" />
            </span>
          ) : null}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pt-12 pb-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <AuthorAvatar name={item.author.name} image={item.author.image} />
            <span className="truncate text-sm font-medium text-white">
              {item.author.name}
            </span>
          </span>
        </button>
      }
    />
  )
}

/** Masonry of public generations; each tile opens the lightbox (Recreate / Copy link / Report). */
export function CommunityWall({
  items,
  columns = 4,
  eagerCount = 4,
}: {
  items: PublicGeneration[]
  columns?: 3 | 4 | 5
  eagerCount?: number
}) {
  const [reportId, setReportId] = useState<string | null>(null)
  return (
    <>
      <Masonry columns={columns} gap="md" label="Community generations">
        {items.map((item, index) => (
          <MasonryItem key={item.id}>
            <CommunityTile
              item={item}
              onReport={setReportId}
              eager={index < eagerCount}
            />
          </MasonryItem>
        ))}
      </Masonry>
      {reportId ? (
        <ReportDialog
          generationId={reportId}
          open
          onOpenChange={(open) => {
            if (!open) setReportId(null)
          }}
        />
      ) : null}
    </>
  )
}
