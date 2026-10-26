import type { Metadata } from "next"
import Link from "next/link"
import { Sparkles, Wand2 } from "lucide-react"

import { loadEffects } from "@/components/marketing/data"
import { EffectsGallery } from "@/components/marketing/effects-gallery"
import { EmptyCard } from "@/components/marketing/empty-card"
import { PRESET_CATEGORIES } from "@/lib/presets/seed-data"

export const metadata: Metadata = {
  title: "Visual effects",
  description:
    "Ready-made looks and camera moves for image and video. Pick an effect, describe your subject and generate.",
  openGraph: { images: ["/media/presets/neon-noir.jpg"] },
}

export default async function EffectsPage() {
  const effects = await loadEffects()
  return (
    <div className="flex flex-col">
      <section
        aria-labelledby="effects-title"
        className="bg-stripes mb-10 border-b border-hairline bg-[#11100d]"
      >
        <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-5 px-4 pt-12 pb-12 md:px-6 md:pt-20 md:pb-16">
          <Link
            href="/video"
            className="eyebrow inline-flex items-center gap-2"
          >
            <Sparkles className="size-3.5" aria-hidden /> Presets for image and
            video
          </Link>
          <h1
            id="effects-title"
            className="font-display text-[56px] text-paper md:text-[112px]"
          >
            Visual
            <br />
            <span className="text-brand">effects.</span>
          </h1>
          <p className="max-w-[560px] text-[15px] text-muted-foreground md:text-lg">
            Ready-made looks and camera moves. Pick one, describe your subject,
            and the effect brings the lighting, lens and motion.
          </p>
        </div>
      </section>
      <section
        aria-label="Effects gallery"
        className="mx-auto w-full max-w-[1400px] px-4 md:px-6"
      >
        {effects.length > 0 ? (
          <EffectsGallery effects={effects} categories={PRESET_CATEGORIES} />
        ) : (
          <EmptyCard
            icon={<Wand2 className="size-5" aria-hidden />}
            title="Effects are warming up"
            body="We couldn't load the effects library just now. You can still generate from a prompt."
            action={
              <Link
                href="/video"
                className="btn-keycap inline-flex h-10 items-center gap-2 px-4 text-xs"
              >
                <Sparkles className="size-4" aria-hidden /> Open the generator
              </Link>
            }
          />
        )}
      </section>
    </div>
  )
}
