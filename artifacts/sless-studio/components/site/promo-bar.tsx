"use client"

import Link from "next/link"
import { Tag, X } from "lucide-react"

import { BRAND } from "@/lib/brand"
import { useLocalFlag } from "@/lib/studio/local-flag"

const KEY = `sless.promo.dismissed:${BRAND.promo}`

/** Optional dismissible promo bar; copy comes from NEXT_PUBLIC_PROMO_BAR. */
export function PromoBar() {
  const [dismissed, setDismissed, hydrated] = useLocalFlag(KEY)
  if (!BRAND.promo || !hydrated || dismissed === "1") return null
  return (
    <div className="font-label relative flex min-h-10 items-center justify-center gap-3 bg-brand px-10 py-2 text-center text-[11px] text-ink">
      <Tag className="hidden size-4 sm:block" aria-hidden />
      <span>{BRAND.promo}</span>
      <Link
        href={BRAND.promoHref}
        className="bg-ink px-2.5 py-1 text-[10px] whitespace-nowrap text-brand hover:bg-ink/85"
      >
        See offer
      </Link>
      <button
        type="button"
        aria-label="Dismiss promotion"
        className="absolute right-2 flex size-7 items-center justify-center hover:bg-black/10"
        onClick={() => setDismissed("1")}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
