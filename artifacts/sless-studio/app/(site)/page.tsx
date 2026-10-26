import Link from "next/link"
import { ArrowRight, Check, ImageIcon, Users, Video } from "lucide-react"

import { ModelBadge, ModelGlyph } from "@/components/marketing/badges"
import { CommunityWall } from "@/components/marketing/community-wall"
import { loadEffects, loadPublic } from "@/components/marketing/data"
import { EmptyCard } from "@/components/marketing/empty-card"
import { Masonry, MasonryItem } from "@/components/marketing/masonry"
import { EffectTile, TileMedia } from "@/components/marketing/media-tile"
import { ScrollRow } from "@/components/marketing/scroll-row"
import {
  FadeClamp,
  SectionHeader,
  ViewAllPill,
} from "@/components/marketing/section-header"
import { findModel, MODELS } from "@/generation/catalog"
import type { ModelEntry } from "@/generation/catalog/types"
import { BRAND } from "@/lib/brand"
import { CORNERS, FAMILY_LOOPS, familyCover } from "@/lib/showcase"
import { appPath } from "@/lib/paths"

/** Featured models, in display order. */
const CARD_IDS = [
  "seedance-2.5",
  "kling-3-std",
  "soul-2",
  "cinema-studio-4",
  "genjutsu-motion",
  "marketing-image-flare",
] as const

function generatorHref(model: ModelEntry): string {
  return `/${model.surface}?model=${encodeURIComponent(model.id)}`
}

/** One card per model family and surface, video first, each pointing at its lead model. */
function families(): { lead: ModelEntry; count: number }[] {
  const sorted = [...MODELS]
    .filter((model) => model.surface !== "audio")
    .sort(
      (a, b) =>
        (a.surface === "video" ? 0 : 1) - (b.surface === "video" ? 0 : 1) ||
        (a.order ?? 999) - (b.order ?? 999)
    )
  const byKey = new Map<string, { lead: ModelEntry; count: number }>()
  for (const model of sorted) {
    const key = `${model.surface}:${model.family}`
    const entry = byKey.get(key)
    if (entry) entry.count += 1
    else byKey.set(key, { lead: model, count: 1 })
  }
  return [...byKey.values()]
}

function SurfaceChip({ surface }: { surface: ModelEntry["surface"] }) {
  const Icon = surface === "video" ? Video : ImageIcon
  return (
    <span className="font-label inline-flex h-6 shrink-0 items-center gap-1 border border-hairline px-2 text-[10px] text-paper/80">
      <Icon className="size-3" aria-hidden />
      {surface === "video" ? "Video" : "Image"}
    </span>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export default async function ExplorePage() {
  const [effects, community] = await Promise.all([
    loadEffects(),
    loadPublic({ limit: 12 }),
  ])
  const card = CARD_IDS.map((id) => findModel(id)).filter(
    (model): model is ModelEntry => Boolean(model)
  )
  const modelFamilies = families()
  const modelCount = MODELS.filter((model) => model.surface !== "audio").length

  return (
    <div className="flex flex-col gap-20 md:gap-28">
      {/* ── Hero: headline left, pitch right, three numbered entry cards ── */}
      <section
        aria-labelledby="hero-title"
        className="bg-stripes border-b border-hairline bg-[#11100d]"
      >
        <div className="mx-auto max-w-[1400px] px-4 pt-14 pb-16 md:px-6 md:pt-20 md:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.45fr_1fr] lg:items-end">
            <div className="flex flex-col gap-4">
              <p className="eyebrow">{BRAND.name} · AI image and video</p>
              <h1
                id="hero-title"
                className="font-display text-[60px] text-paper sm:text-[88px] md:text-[112px] xl:text-[136px]"
              >
                <span className="block whitespace-nowrap">Create with</span>
                <span className="block whitespace-nowrap text-brand">
                  every model.
                </span>
              </h1>
            </div>
            <div className="flex flex-col gap-6 lg:pb-3">
              <p className="max-w-[460px] text-base leading-relaxed text-paper/80 md:text-lg">
                Generate images and video with Seedance, Kling, Soul and{" "}
                {modelCount - 3}+ more leading models, from one workspace, one
                credit balance and one library.
              </p>
              <ul className="flex flex-col gap-2 text-sm text-paper/75">
                {[
                  "One credit balance for every model",
                  "Failed runs refunded automatically",
                  "Top-up credits never expire",
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2.5">
                    <Check className="size-4 text-brand" aria-hidden /> {line}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/video"
                  className="btn-keycap inline-flex h-14 items-center justify-center px-7 text-sm"
                >
                  Start creating
                </Link>
                <Link
                  href="/effects"
                  className="btn-outline inline-flex h-14 items-center justify-center px-7 text-sm"
                >
                  Explore effects
                </Link>
              </div>
            </div>
          </div>

          {/* Entry points — numbered "paper" cards in the slessismore.org style. */}
          <h2 className="sr-only">Get started</h2>
          <ul
            role="list"
            className="mt-14 grid gap-8 pr-[10px] pb-[10px] md:mt-20 md:grid-cols-3"
          >
            {CORNERS.map((corner, index) => (
              <li key={corner.href}>
                <Link
                  href={corner.href}
                  className="card-offset group flex h-full flex-col bg-paper text-ink"
                >
                  <span className="relative m-3 mb-0 block aspect-[4/3] overflow-hidden bg-ink">
                    <TileMedia
                      image={corner.image}
                      video={corner.video}
                      poster={appPath(corner.image)}
                      eager={index === 0}
                      className="object-[50%_30%] transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="tag-number absolute top-3 left-3 text-[34px]">
                      {pad(index + 1)}
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-2 p-5 pt-4">
                    <span className="font-label text-[11px] text-ink/60">
                      {corner.kicker}
                    </span>
                    <span className="font-display text-[34px]">
                      {corner.title}
                    </span>
                    <span className="text-[15px] leading-snug text-ink/75">
                      {corner.body}
                    </span>
                    <span className="font-label mt-auto inline-flex items-center gap-2 pt-3 text-[12px]">
                      {corner.cta}
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-1"
                        aria-hidden
                      />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Featured models: a numbered list ─────────────────────────────── */}
      <section
        aria-labelledby="card-title"
        className="mx-auto w-full max-w-[1400px] px-4 md:px-6"
      >
        <SectionHeader
          id="card-title"
          eyebrow="Top models"
          title="Featured models."
          description="Our most-used models. Each one opens in the generator with sensible defaults."
        />
        <ol
          role="list"
          className="grid border-t border-hairline md:grid-cols-2 md:gap-x-10"
        >
          {card.map((model, index) => (
            <li key={model.id} className="border-b border-hairline">
              <Link
                href={generatorHref(model)}
                className="group flex items-center gap-4 py-5 md:gap-6"
              >
                <span className="font-display w-12 shrink-0 text-[40px] text-brand md:w-14 md:text-[48px]">
                  {pad(index + 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <ModelGlyph model={model} className="size-4" />
                    <span className="font-display text-[26px] text-paper transition-colors group-hover:text-brand md:text-[30px]">
                      {model.label}
                    </span>
                    <ModelBadge model={model} />
                  </span>
                  <span className="line-clamp-1 text-sm text-muted-foreground">
                    {model.bestFor ?? model.description}
                  </span>
                </span>
                <SurfaceChip surface={model.surface} />
                <ArrowRight
                  className="hidden size-5 shrink-0 text-brand transition-transform group-hover:translate-x-1 sm:block"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <section
        aria-label="Why Sless Studio"
        className="border-y border-hairline bg-[#141414]"
      >
        <dl className="mx-auto grid max-w-[1400px] grid-cols-1 divide-y divide-hairline px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 md:px-6">
          {[
            { value: `${modelCount}+`, label: "Models in one studio" },
            { value: "1", label: "Credit balance across all models" },
            { value: "0", label: "Credits charged for failed runs" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-baseline gap-4 py-8 sm:flex-col sm:gap-2 sm:px-8 sm:first:pl-0"
            >
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-display text-[56px] text-brand md:text-[72px]">
                {stat.value}
              </dd>
              <dd className="font-label text-[12px] text-paper/80">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Effects ─────────────────────────────────────────────────────── */}
      {effects.length > 0 ? (
        <section
          aria-labelledby="effects-title"
          className="mx-auto w-full max-w-[1400px] px-4 md:px-6"
        >
          <SectionHeader
            id="effects-title"
            eyebrow="Presets"
            title="Visual effects."
            description="Ready-made styles and camera moves. Choose a preset, add your subject and generate."
            action={
              <Link
                href="/effects"
                className="btn-keycap inline-flex h-12 items-center px-6 text-[12px]"
              >
                Browse effects
              </Link>
            }
          />
          <FadeClamp
            href="/effects"
            label="All effects"
            className="max-h-[720px] md:max-h-[880px]"
          >
            <Masonry columns={5} label="Effects">
              {effects.slice(0, 12).map((effect) => (
                <MasonryItem key={effect.slug}>
                  <EffectTile effect={effect} cta="Recreate" />
                </MasonryItem>
              ))}
            </Masonry>
          </FadeClamp>
        </section>
      ) : null}

      {/* ── Model families ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="models-title"
        className="mx-auto w-full max-w-[1400px] px-4 md:px-6"
      >
        <SectionHeader
          id="models-title"
          eyebrow="Model library"
          title="All models."
          description="Every image and video model family we support. Select one to open it in the generator."
        />
        <ScrollRow label="Model families">
          {modelFamilies.map(({ lead, count }) => {
            const loop =
              lead.surface === "video" ? FAMILY_LOOPS[lead.family] : undefined
            const cover = familyCover(lead.family, lead.surface)
            return (
              <li
                key={`${lead.surface}:${lead.family}`}
                className="w-[260px] shrink-0 snap-start md:w-[300px]"
              >
                <Link
                  href={generatorHref(lead)}
                  className="group flex h-full flex-col overflow-hidden border border-hairline bg-surface transition-colors duration-200 hover:border-brand"
                >
                  <span className="relative block aspect-video overflow-hidden bg-raised">
                    <TileMedia
                      image={cover}
                      video={loop}
                      poster={appPath(cover)}
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </span>
                  <span className="flex flex-1 flex-col gap-2 p-4">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <ModelGlyph model={lead} className="size-4" />
                        <span className="font-display truncate text-[22px] text-paper">
                          {lead.family}
                        </span>
                      </span>
                      <SurfaceChip surface={lead.surface} />
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-[18px] text-muted-foreground">
                      {lead.bestFor ?? lead.description}
                    </span>
                    <span className="mt-auto pt-1 text-xs text-paper/50">
                      {count} {count === 1 ? "model" : "models"} · starts with{" "}
                      {lead.label}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ScrollRow>
      </section>

      {/* ── Community ───────────────────────────────────────────────────── */}
      <section
        aria-labelledby="community-title"
        className="mx-auto w-full max-w-[1400px] px-4 md:px-6"
      >
        <SectionHeader
          id="community-title"
          eyebrow="Community"
          title="Community showcase."
          description="Fresh from creators who chose to publish. Open any piece to see its prompt and recreate it."
          action={
            community.items.length > 0 ? (
              <Link href="/community" className="link-arrow h-12 text-[12px]">
                Explore community <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null
          }
        />
        {community.items.length >= 8 ? (
          <FadeClamp
            href="/community"
            label="Explore community"
            className="max-h-[720px] md:max-h-[900px]"
          >
            <CommunityWall items={community.items} columns={4} eagerCount={0} />
          </FadeClamp>
        ) : community.items.length > 0 ? (
          <div className="flex flex-col items-center gap-6">
            <div className="w-full">
              <CommunityWall
                items={community.items}
                columns={4}
                eagerCount={0}
              />
            </div>
            <ViewAllPill href="/community">Explore community</ViewAllPill>
          </div>
        ) : (
          <EmptyCard
            headingLevel={3}
            icon={<Users className="size-5" aria-hidden />}
            title={
              community.failed
                ? "Community is unavailable"
                : "Nothing published yet"
            }
            body={
              community.failed
                ? "We couldn't load published work right now. Check back in a minute."
                : "Nothing has been published yet. Open any finished generation in your library and choose Publish to feature it here."
            }
            action={
              <Link
                href="/video"
                className="btn-keycap inline-flex h-11 items-center px-5 text-[12px]"
              >
                Start creating
              </Link>
            }
          />
        )}
      </section>
    </div>
  )
}
