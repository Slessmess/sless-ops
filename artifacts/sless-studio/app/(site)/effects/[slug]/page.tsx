import type { Metadata } from "next"
import Link from "next/link"
import { notFound, unstable_rethrow } from "next/navigation"
import { ChevronLeft, ImageIcon, Sparkles, Video } from "lucide-react"

import { Atmosphere } from "@/components/marketing/atmosphere"
import { loadEffects } from "@/components/marketing/data"
import { toEffectCard, type EffectCard } from "@/components/marketing/effects"
import { EffectTile, TileMedia } from "@/components/marketing/media-tile"
import { SectionHeader } from "@/components/marketing/section-header"
import { getPreset } from "@/lib/presets"
import { appPath } from "@/lib/paths"

type Params = Promise<{ slug: string }>

async function load(slug: string): Promise<EffectCard | null> {
  try {
    const preset = await getPreset(slug)
    return preset ? toEffectCard(preset, 0) : null
  } catch (error) {
    unstable_rethrow(error)
    console.error(
      "[effects] preset unavailable",
      error instanceof Error ? error.message : error
    )
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const effect = await load(slug)
  if (!effect) return { title: "Effect not found" }
  return {
    title: `${effect.title} effect`,
    description: effect.description,
    openGraph: {
      title: `${effect.title} · Visual effect`,
      description: effect.description,
      images: [effect.image],
    },
  }
}

export default async function EffectPage({ params }: { params: Params }) {
  const { slug } = await params
  const effect = await load(slug)
  if (!effect) notFound()

  const more = (await loadEffects())
    .filter((item) => item.slug !== effect.slug)
    .sort(
      (a, b) =>
        Number(b.category === effect.category) -
        Number(a.category === effect.category)
    )
    .slice(0, 4)
  const SurfaceIcon = effect.surface === "video" ? Video : ImageIcon
  const useHref = `/${effect.surface}?preset=${encodeURIComponent(effect.slug)}`
  // The detail view shows video loops at their own ratio and stills at 3:4.
  const heroAspect = effect.video ? effect.aspect : 3 / 4

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <section
        aria-labelledby="effect-title"
        className="relative isolate overflow-hidden bg-gradient-to-b from-black from-50% to-page"
      >
        <Atmosphere glow="top" className="-z-10" />
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 pt-8 pb-4 md:px-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:grid-rows-[1fr_auto_1fr] lg:gap-x-16 lg:gap-y-6">
          <div className="flex flex-col items-start gap-5 lg:col-start-1 lg:row-start-2">
            <Link
              href="/effects"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 pr-3 pl-2 text-sm text-foreground transition-colors hover:bg-white/5"
            >
              <ChevronLeft className="size-4" aria-hidden /> Back
            </Link>
            <h1
              id="effect-title"
              className="font-display text-[44px] leading-[0.95] text-white md:text-[72px] md:leading-[0.95]"
            >
              {effect.title}
            </h1>
            <p className="max-w-[620px] text-sm leading-6 text-white/80 md:text-base">
              {effect.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-white/85">
                <SurfaceIcon className="size-3.5" aria-hidden />
                {effect.surface === "video" ? "Video effect" : "Image effect"}
              </span>
              <span className="inline-flex h-7 items-center rounded-lg bg-white/5 px-2.5 text-white/85">
                Runs on {effect.modelLabel}
              </span>
              <span className="inline-flex h-7 items-center rounded-lg bg-white/5 px-2.5 text-white/60">
                {effect.category}
              </span>
            </div>
            <Link
              href={useHref}
              className="btn-keycap mt-1 inline-flex h-12 items-center gap-2 px-6 text-sm"
            >
              <Sparkles className="size-4" aria-hidden /> Use effect
            </Link>
          </div>
          <ol
            aria-label="How to use this effect"
            className="order-last grid w-full max-w-[620px] gap-2 self-start sm:grid-cols-3 lg:order-none lg:col-start-1 lg:row-start-3"
          >
            {[
              ["1", "Open it", "Use effect loads the look into the generator."],
              [
                "2",
                "Add your subject",
                "Describe who or what is in the shot, or add a reference.",
              ],
              [
                "3",
                "Generate",
                "The cost shows on the button before you press it.",
              ],
            ].map(([step, title, body]) => (
              <li
                key={step}
                className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface/70 p-3"
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  Step {step}
                </span>
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-xs leading-[18px] text-muted-foreground">
                  {body}
                </span>
              </li>
            ))}
          </ol>
          <div
            className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center"
            style={{
              aspectRatio: String(heroAspect),
              // Full width, but never taller than ~78% of the viewport.
              width: `min(100%, 560px, calc(min(78svh, 760px) * ${heroAspect.toFixed(4)}))`,
            }}
          >
            <TileMedia
              image={effect.image}
              video={effect.video}
              poster={appPath(effect.poster)}
              alt={`${effect.title} example`}
              eager
            />
          </div>
        </div>
      </section>

      {more.length > 0 ? (
        <section
          aria-labelledby="more-title"
          className="mx-auto w-full max-w-[1440px] px-4 md:px-8"
        >
          <SectionHeader
            id="more-title"
            title="More effects"
            description="Other looks worth a try."
            action={
              <Link
                href="/effects"
                className="inline-flex h-10 items-center rounded-xl bg-white/5 px-4 text-sm font-medium transition-colors hover:bg-white/10"
              >
                See all effects
              </Link>
            }
          />
          <ul role="list" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {more.map((item) => (
              <li key={item.slug}>
                <EffectTile effect={item} aspect={3 / 4} cta="Use effect" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
