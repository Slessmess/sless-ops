"use client"

import { useState } from "react"
import { Check, Copy, Link2 } from "lucide-react"

import { useToast } from "@/components/providers/app-providers"
import { cn } from "@/lib/utils"

/**
 * Copies `text` (or, with `link`, the current page URL) to the clipboard and
 * confirms inline.
 */
export function CopyButton({
  text,
  link = false,
  label = "Copy",
  className,
}: {
  text?: string
  link?: boolean
  label?: string
  className?: string
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const Icon = copied ? Check : link ? Link2 : Copy
  return (
    <button
      type="button"
      onClick={() => {
        const value = link ? window.location.href : (text ?? "")
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1400)
          })
          .catch(() =>
            toast.error(
              "Couldn't copy",
              "Your browser blocked clipboard access."
            )
          )
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <Icon className={cn("size-3.5", copied && "text-brand")} aria-hidden />
      {copied ? "Copied" : label}
    </button>
  )
}
