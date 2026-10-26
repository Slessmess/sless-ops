import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * Sless Studio mark: a yellow square with a heavy condensed "S" — a placeholder
 * in the slessismore.org style until final brand assets arrive. Swap the SVG
 * here (and app/icon.svg, public/icon.svg) to rebrand.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" fill="#FFD700" />
      <path
        d="M22.2 11.1c-.4-2.4-2.3-3.9-6.1-3.9-3.9 0-6.3 1.9-6.3 4.9 0 3.4 2.6 4.4 5.9 5.3 2 .5 2.6.9 2.6 1.8 0 .9-.8 1.4-2.1 1.4-1.6 0-2.4-.7-2.6-2.1H9.4c.2 3.2 2.5 5.3 6.6 5.3 4.2 0 6.6-2 6.6-5.2 0-3.3-2.4-4.4-5.8-5.3-2.1-.6-2.7-.9-2.7-1.7 0-.8.7-1.2 1.8-1.2 1.3 0 2 .6 2.2 1.7h4.1z"
        fill="#11100D"
      />
      <rect x="9.4" y="26.2" width="13.2" height="1.6" fill="#11100D" />
    </svg>
  )
}

/** Wordmark: "SLESS" in Anton + a yellow wide-tracked "STUDIO" kicker. */
export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const [first, ...rest] = BRAND.name.split(" ")
  return (
    <Link
      href="/"
      aria-label={`${BRAND.name} home`}
      className={cn("flex shrink-0 items-center gap-2.5", className)}
    >
      <LogoMark className={compact ? "size-7" : "size-9"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-paper",
            compact ? "text-[19px]" : "text-[23px]"
          )}
        >
          {first}
        </span>
        {rest.length > 0 ? (
          <span
            className={cn(
              "eyebrow -mt-0.5 !tracking-[0.34em]",
              compact ? "!text-[8px] !leading-3" : "!text-[9px] !leading-3"
            )}
          >
            {rest.join(" ")}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
