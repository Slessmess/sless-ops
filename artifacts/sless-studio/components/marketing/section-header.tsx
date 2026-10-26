import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Section heading in the slessismore.org pattern: optional yellow eyebrow, a
 * big cream Anton title ("Featured models."), a grey one-liner and an
 * optional right-hand action.
 */
export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  id?: string
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2
          id={id}
          className="font-display text-[38px] text-paper md:text-[52px]"
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-[640px] text-[15px] text-muted-foreground md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** The centred "View all →" button that sits on a section's bottom fade. */
export function ViewAllPill({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="btn-outline inline-flex h-11 items-center gap-2 bg-page/80 px-5 text-[12px] backdrop-blur-md"
    >
      {children} <ArrowRight className="size-4 text-brand" aria-hidden />
    </Link>
  )
}

/**
 * Clips a media wall to a fixed height and fades it into the page, with the
 * "View all" pill centred on the fade.
 */
export function FadeClamp({
  children,
  href,
  label,
  className,
}: {
  children: ReactNode
  href: string
  label: string
  className?: string
}) {
  return (
    <div className="relative">
      {/* 4px of slack so keyboard focus rings on edge tiles aren't clipped. */}
      <div className={cn("-m-1 overflow-hidden p-1", className)}>
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent via-page/70 to-page"
      />
      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <ViewAllPill href={href}>{label}</ViewAllPill>
      </div>
    </div>
  )
}
