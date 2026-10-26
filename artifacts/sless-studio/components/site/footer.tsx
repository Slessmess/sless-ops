"use client"

import Link from "next/link"

import { BRAND } from "@/lib/brand"

import { LogoMark } from "./logo"

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Create",
    links: [
      { label: "Image", href: "/image" },
      { label: "Video", href: "/video" },
      { label: "Edit video", href: "/video?tab=edit" },
      { label: "Motion control", href: "/video?tab=motion" },
      { label: "Effects", href: "/effects" },
    ],
  },
  {
    title: "Video models",
    links: [
      { label: "Seedance 2.5", href: "/video?model=seedance-2.5" },
      { label: "Kling 3.0", href: "/video?model=kling-3-std" },
      { label: "Wan 3.0", href: "/video?model=wan-3" },
      { label: "Cinema Studio 4.0", href: "/video?model=cinema-studio-4" },
      { label: "MiniMax H3", href: "/video?model=minimax-h3" },
    ],
  },
  {
    title: "Image models",
    links: [
      { label: "Soul 2", href: "/image?model=soul-2" },
      { label: "Soul Cinema", href: "/image?model=soul-cinema" },
      { label: "Grok Image 2.0", href: "/image?model=grok-image-2" },
      { label: "Ideogram 4.0", href: "/image?model=ideogram-4" },
      { label: "Recraft V4.1", href: "/image?model=recraft-4.1" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Community", href: "/community" },
      { label: "Support", href: `mailto:${BRAND.supportEmail}` },
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-24">
      {/* CTA band — the slessismore.org "Start where the action is." strip. */}
      <div className="bg-stripes border-y border-hairline bg-[#11100d]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center md:px-6 md:py-14">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">{BRAND.parent}</p>
            <p className="font-display text-[40px] text-paper md:text-[56px]">
              Start where the action is.
            </p>
          </div>
          <Link
            href="/video"
            className="btn-keycap inline-flex h-14 shrink-0 items-center px-7 text-sm"
          >
            Open the studio
          </Link>
        </div>
      </div>

      <div className="bg-[#141414] py-14">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 md:px-6 lg:grid-cols-[1.1fr_2fr]">
          <div className="flex flex-col gap-5">
            <LogoMark className="size-12" />
            <p className="font-display text-4xl text-paper md:text-5xl">
              Every model.
              <br />
              <span className="text-brand">One studio.</span>
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              The AI image and video studio from{" "}
              <a
                href={BRAND.parentUrl}
                className="text-brand underline underline-offset-4 hover:text-paper"
              >
                {BRAND.parent}
              </a>
              . Leading image and video models with one credit balance and one
              library.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <p className="eyebrow !text-[11px] !tracking-[0.2em]">
                  {column.title}
                </p>
                {column.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-[15px] text-paper/80 transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-hairline bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-4 py-5 text-sm text-muted-foreground md:flex-row md:items-center md:px-6">
          <p>
            © {new Date().getFullYear()} {BRAND.name} · {BRAND.parent}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-paper/85">
            <Link href="/legal/terms" className="hover:text-brand">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-brand">
              Privacy
            </Link>
            <Link href="/legal/acceptable-use" className="hover:text-brand">
              Acceptable use
            </Link>
            <button
              type="button"
              className="hover:text-brand"
              onClick={() =>
                window.dispatchEvent(new Event("sless:cookie-preferences"))
              }
            >
              Cookie settings
            </button>
            <a href={BRAND.parentUrl} className="hover:text-brand">
              slessismore.org ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
