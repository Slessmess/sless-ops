import type { Metadata } from "next"

import { NotFoundContent } from "@/components/marketing/not-found-content"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

/**
 * 404 for unmatched URLs and for notFound() in route groups without their own
 * boundary. It can render inside a group layout that already has a nav, so it
 * brings only a logo link, not a second header.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-60px)] flex-1 flex-col">
      <NotFoundContent logo />
    </div>
  )
}
