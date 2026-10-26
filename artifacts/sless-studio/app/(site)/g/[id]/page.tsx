/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, unstable_rethrow } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { AuthorAvatar } from "@/components/marketing/community-wall"
import { CopyButton } from "@/components/marketing/copy-button"
import { formatDate, settingRows } from "@/components/marketing/format"
import { RecreateButton } from "@/components/marketing/recreate-button"
import { ReportButton } from "@/components/marketing/report-dialog"
import { findModel } from "@/generation/catalog"
import { BRAND } from "@/lib/brand"
import { getPublic, type PublicGeneration } from "@/lib/community"
import { familyCover } from "@/lib/showcase"
import { appPath } from "@/lib/paths"

type Params = Promise<{ id: string }>

async function load(id: string): Promise<PublicGeneration | null> {
  try {
    return await getPublic(id)
  } catch (error) {
    unstable_rethrow(error)
    console.error(
      "[g] generation unavailable",
      error instanceof Error ? error.message : error
    )
    return null
  }
}

function excerpt(text: string, max = 150): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function shareImage(item: PublicGeneration): string {
  const output = item.outputs[0]
  if (output?.kind === "image") return output.url
  const family = findModel(item.modelId)?.family ?? ""
  return familyCover(family, item.surface)
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const item = await load(id)
  if (!item) return { title: "Generation not found" }
  const kind =
    item.surface === "video"
      ? "Video"
      : item.surface === "audio"
        ? "Audio"
        : "Image"
  const title = `${kind} by ${item.author.name} · ${item.modelLabel}`
  const description = item.prompt
    ? excerpt(item.prompt)
    : `Made with ${item.modelLabel} on ${BRAND.name}.`
  const image = shareImage(item)
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: item.surface === "video" ? "video.other" : "article",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

export default async function PublicGenerationPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const item = await load(id)
  if (!item) notFound()
  const output = item.outputs[0]
  if (!output) notFound()

  const rows = [
    { id: "model", label: "Model", value: item.modelLabel },
    ...settingRows(item.modelId, item.settings),
    ...(output.width && output.height
      ? [
          {
            id: "size",
            label: "Size",
            value: `${output.width} × ${output.height}`,
          },
        ]
      : []),
    ...(output.durationSec
      ? [
          {
            id: "duration",
            label: "Length",
            value: `${Math.round(output.durationSec)}s`,
          },
        ]
      : []),
  ]
  const backdrop = output.kind === "image" ? output.url : shareImage(item)
  const ratio =
    output.width && output.height
      ? output.width / output.height
      : item.aspect || 1

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-6 md:px-8 md:pt-8">
      <Link
        href="/community"
        className="inline-flex h-8 w-fit items-center gap-1 rounded-lg border border-white/10 pr-3 pl-2 text-sm transition-colors hover:bg-white/5"
      >
        <ChevronLeft className="size-4" aria-hidden /> Community
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          aria-label="Media"
          className="relative isolate flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-hairline bg-panel p-3 md:min-h-[560px] md:p-8"
        >
          <img
            src={appPath(backdrop)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 size-full scale-110 object-cover opacity-40 blur-[64px]"
          />
          {output.kind === "video" ? (
            <video
              src={appPath(output.url)}
              poster={appPath(shareImage(item))}
              controls
              loop
              muted
              playsInline
              preload="metadata"
              aria-label={`Video: ${excerpt(item.prompt, 120)}`}
              className="max-h-[min(70svh,760px)] w-auto max-w-full rounded-xl shadow-2xl"
              style={{ aspectRatio: String(ratio) }}
            />
          ) : output.kind === "audio" ? (
            <audio src={appPath(output.url)} controls className="w-full max-w-[560px]" />
          ) : (
            <img
              src={appPath(output.url)}
              alt={
                excerpt(item.prompt, 200) ||
                `Image made with ${item.modelLabel}`
              }
              width={output.width}
              height={output.height}
              className="max-h-[min(70svh,760px)] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              style={{ aspectRatio: String(ratio) }}
            />
          )}
        </section>

        <aside className="flex flex-col gap-5 self-start rounded-3xl border border-hairline bg-panel p-5 md:p-6 lg:sticky lg:top-[76px]">
          <div className="flex items-center gap-3">
            <AuthorAvatar
              name={item.author.name}
              image={item.author.image}
              className="size-10 text-sm"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-medium">
                {item.author.name}
              </span>
              <span className="text-xs text-muted-foreground">
                Published{" "}
                <time dateTime={new Date(item.publishedAt).toISOString()}>
                  {formatDate(item.publishedAt)}
                </time>
              </span>
            </div>
          </div>

          <h1 className="sr-only">
            {item.surface === "video" ? "Video" : "Image"} by {item.author.name}{" "}
            made with {item.modelLabel}
          </h1>

          {item.prompt ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium tracking-wide text-[#a8a296] uppercase">
                  Prompt
                </h2>
                <CopyButton text={item.prompt} />
              </div>
              <p className="max-h-60 overflow-y-auto text-sm leading-6 break-words whitespace-pre-line text-foreground">
                {item.prompt}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-medium tracking-wide text-[#a8a296] uppercase">
              Details
            </h2>
            <dl className="flex flex-col divide-y divide-white/5 rounded-xl bg-surface px-3 text-sm">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <dt className="text-[#a8a296]">{row.label}</dt>
                  <dd className="truncate text-right tabular-nums">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <RecreateButton
              source={{
                surface: item.surface,
                modelId: item.modelId,
                prompt: item.prompt,
                settings: item.settings,
              }}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-2">
              <ReportButton
                generationId={item.id}
                className="h-11 w-full text-sm"
              />
              <span className="flex h-11 items-center justify-center rounded-xl bg-white/5 transition-colors hover:bg-white/10">
                <CopyButton
                  link
                  label="Copy link"
                  className="h-full w-full justify-center text-sm font-medium text-foreground"
                />
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
