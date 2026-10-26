import type { Metadata } from "next"

import { Atmosphere } from "@/components/marketing/atmosphere"
import { CommunityFeed } from "@/components/marketing/community-feed"
import { loadPublic } from "@/components/marketing/data"

export const metadata: Metadata = {
  title: "Community",
  description:
    "Images and videos published by creators. Open any piece to see the prompt, model and settings, then recreate it.",
}

export default async function CommunityPage() {
  const page = await loadPublic({ limit: 24 })
  return (
    <div className="relative isolate">
      <Atmosphere glow="top" className="-z-10 h-[420px]" />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 pt-12 md:px-6 md:pt-20">
        <header className="flex flex-col items-start gap-3">
          <p className="eyebrow">Community</p>
          <h1 className="font-display text-[56px] text-paper md:text-[96px]">
            Community <span className="text-brand">showcase.</span>
          </h1>
          <p className="max-w-[560px] text-[15px] text-muted-foreground md:text-lg">
            Work creators chose to share. Open a piece to see exactly how it was
            made, then make it your own.
          </p>
        </header>
        <CommunityFeed
          initial={page.items}
          initialCursor={page.nextCursor}
          initialError={page.failed}
        />
      </div>
    </div>
  )
}
