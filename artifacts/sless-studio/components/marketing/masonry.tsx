import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const COLUMNS = {
  3: "columns-2 md:columns-3",
  4: "columns-2 md:columns-3 lg:columns-4",
  5: "columns-2 md:columns-3 lg:columns-4 xl:columns-5",
} as const

const GAP = {
  sm: "gap-2 [&>li]:mb-2",
  md: "gap-2 md:gap-3 [&>li]:mb-2 md:[&>li]:mb-3",
} as const

/**
 * CSS-columns masonry (docs/ui-inventory.md §3.5): tiles keep their own
 * aspect ratio and flow top-to-bottom, column by column.
 */
export function Masonry({
  columns = 5,
  gap = "sm",
  label,
  className,
  children,
}: {
  columns?: keyof typeof COLUMNS
  gap?: keyof typeof GAP
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <ul
      role="list"
      aria-label={label}
      className={cn(COLUMNS[columns], GAP[gap], className)}
    >
      {children}
    </ul>
  )
}

export function MasonryItem({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <li className={cn("break-inside-avoid", className)}>{children}</li>
}
