import Link from "next/link"
import { Sparkles } from "lucide-react"

import { Logo } from "@/components/site/logo"

import { Atmosphere } from "./atmosphere"

/** The 404 body, shared by the root not-found and the (site) one (which has layout chrome). */
export function NotFoundContent({ logo = false }: { logo?: boolean }) {
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-20 md:py-28">
      <Atmosphere glow="center" className="-z-10" />
      <div className="flex max-w-[520px] flex-col items-center gap-5 text-center">
        {logo ? <Logo className="mb-2" /> : null}
        <p
          aria-hidden
          className="font-display text-[120px] leading-none text-brand md:text-[180px]"
        >
          404
        </p>
        <h1 className="font-display text-[44px] text-paper md:text-[56px]">
          This frame didn&apos;t render
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          The page you&apos;re looking for doesn&apos;t exist, was unpublished,
          or moved somewhere else.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-keycap inline-flex h-12 items-center justify-center gap-2 px-6 text-sm"
          >
            <Sparkles className="size-4" aria-hidden /> Back to Explore
          </Link>
          <Link
            href="/effects"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 px-6 text-base font-medium transition-colors hover:bg-white/5"
          >
            Browse effects
          </Link>
        </div>
      </div>
    </div>
  )
}
