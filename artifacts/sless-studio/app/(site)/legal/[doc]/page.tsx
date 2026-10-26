import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { TriangleAlert } from "lucide-react"

import { BRAND } from "@/lib/brand"

type Section = { id: string; title: string; body: string[] }
type LegalDoc = { title: string; summary: string; sections: Section[] }

const name = BRAND.name

/**
 * PLACEHOLDER legal copy. It describes how the product works so the pages are
 * useful in development, but it has not been reviewed by a lawyer and must be
 * replaced before launch.
 */
const DOCS: Record<string, LegalDoc> = {
  terms: {
    title: "Terms of Service",
    summary: `The rules for using ${name}: your account, credits and plans, and what you can do with what you make.`,
    sections: [
      {
        id: "agreement",
        title: "1. The agreement",
        body: [
          `These terms are an agreement between you and ${name} about your use of our website, studio and related services. By creating an account or using ${name} you accept them.`,
          "If you use the service for a company, you confirm you can accept these terms on its behalf.",
        ],
      },
      {
        id: "account",
        title: "2. Your account",
        body: [
          "You sign in with a link sent to your email address. Keep access to that inbox secure; anyone who can open it can sign in as you.",
          "You must be at least 18 years old, or the age of majority where you live, to create an account.",
        ],
      },
      {
        id: "credits",
        title: "3. Credits, plans and payments",
        body: [
          "Generations are paid for with credits. The price of each run is shown before you start it. Credits for failed, canceled or filtered runs are returned automatically.",
          "Plan credits are refilled at each monthly renewal and do not carry over. Top-up credits do not expire. Credits have no cash value and cannot be transferred.",
          "Subscriptions renew automatically until canceled. You can cancel at any time; your plan remains active until the end of the paid period.",
        ],
      },
      {
        id: "content",
        title: "4. What you create",
        body: [
          "You keep your rights in the prompts and files you upload. Subject to these terms and your plan, you may use the images and videos you generate, including commercially on paid plans.",
          "If you publish a generation to Community, you allow other visitors to view it and to reuse its prompt and settings to make their own work.",
        ],
      },
      {
        id: "use",
        title: "5. Acceptable use",
        body: [
          "You agree to follow our Acceptable Use Policy. We may block, remove or unpublish content, and suspend accounts, that break it.",
        ],
      },
      {
        id: "service",
        title: "6. The service",
        body: [
          `${name} relies on third-party AI models. Results vary, models change, and we may add, update or retire models and features.`,
          "We work to keep the service available but do not promise it will be uninterrupted or error-free.",
        ],
      },
      {
        id: "liability",
        title: "7. Disclaimers and liability",
        body: [
          "The service is provided as is. To the extent the law allows, our total liability is limited to the amount you paid us in the twelve months before the claim.",
        ],
      },
      {
        id: "changes",
        title: "8. Changes and contact",
        body: [
          "We may update these terms. If a change is material we will tell you before it takes effect.",
          `Questions? Write to ${BRAND.supportEmail}.`,
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: `What ${name} collects, why, who it is shared with and the choices you have.`,
    sections: [
      {
        id: "collect",
        title: "1. What we collect",
        body: [
          "Account data: your email address and, if you add them, a name and profile picture.",
          "Creative data: the prompts, settings and reference files you submit and the media we generate for you.",
          "Billing data: plan, purchase history and credit balance. Card details are handled by our payment processor and never reach our servers.",
          "Technical data: basic logs such as IP address, browser and error reports, used to keep the service secure and working.",
        ],
      },
      {
        id: "use",
        title: "2. How we use it",
        body: [
          "To run the service: generate media, keep your library, charge and refund credits, and send sign-in and billing emails.",
          "To keep it safe: rate limiting, fraud prevention and content moderation, including reviewing reports from other users.",
        ],
      },
      {
        id: "sharing",
        title: "3. Who we share it with",
        body: [
          "Model providers receive the prompts and files needed to produce each generation.",
          "Infrastructure providers host our database, media storage and email delivery. Our payment processor handles checkout.",
          "We do not sell your personal data.",
        ],
      },
      {
        id: "public",
        title: "4. Public content",
        body: [
          "Generations are private unless you publish them. Published work shows your display name and avatar, never your email address. You can unpublish at any time.",
        ],
      },
      {
        id: "cookies",
        title: "5. Cookies",
        body: [
          "We use essential cookies to keep you signed in and secure. Analytics or marketing cookies are only set if you allow them in Cookie settings.",
        ],
      },
      {
        id: "rights",
        title: "6. Retention and your rights",
        body: [
          "We keep your data while your account is active and delete it within a reasonable period after you close it, except where the law requires us to keep records such as invoices.",
          `You can ask for a copy of your data, correct it or delete it by writing to ${BRAND.supportEmail}.`,
        ],
      },
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    summary: `What you can't make or do with ${name}, and what happens when someone does.`,
    sections: [
      {
        id: "never",
        title: "1. Never allowed",
        body: [
          "Sexual content involving minors, or content that sexualises minors in any way.",
          "Sexual or intimate imagery of a real person without their consent.",
          "Content that impersonates real people to deceive, including fake endorsements and misleading deepfakes.",
        ],
      },
      {
        id: "harm",
        title: "2. Harmful content",
        body: [
          "Content that promotes violence, terrorism or self-harm, or that harasses or threatens people.",
          "Hateful content that attacks people for who they are.",
          "Instructions or imagery meant to help someone cause serious harm.",
        ],
      },
      {
        id: "rights",
        title: "3. Other people's rights",
        body: [
          "Only upload references you have the right to use. Don't use the service to copy someone else's copyrighted work, trademark or likeness without permission.",
        ],
      },
      {
        id: "platform",
        title: "4. Respect the platform",
        body: [
          "No spam, scams or malware. No attempts to get around content filters, rate limits or credit charges, and no automated scraping of the site.",
        ],
      },
      {
        id: "enforcement",
        title: "5. Reporting and enforcement",
        body: [
          "Use the Report button on any public generation to flag it. Our team reviews reports and may unpublish content, remove it or suspend accounts.",
          `For urgent concerns, write to ${BRAND.supportEmail}.`,
        ],
      },
    ],
  },
}

const SLUGS = Object.keys(DOCS)

export const dynamicParams = false

export function generateStaticParams(): { doc: string }[] {
  return SLUGS.map((doc) => ({ doc }))
}

type Params = Promise<{ doc: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { doc } = await params
  const entry = Object.hasOwn(DOCS, doc) ? DOCS[doc] : undefined
  if (!entry) return { title: "Not found" }
  return {
    title: entry.title,
    description: entry.summary,
    robots: { index: false },
  }
}

export default async function LegalPage({ params }: { params: Params }) {
  const { doc } = await params
  const entry = Object.hasOwn(DOCS, doc) ? DOCS[doc] : undefined
  if (!entry) notFound()

  return (
    <div className="mx-auto flex w-full max-w-[1096px] flex-col gap-8 px-4 pt-10 md:pt-14">
      <div
        role="note"
        className="flex items-start gap-3 rounded-2xl border border-[#ffbe4c]/30 bg-[#ffbe4c]/10 p-4 text-sm text-[#ffd98a]"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">
            Placeholder — replace before launch.
          </strong>{" "}
          This text outlines how {name} works but has not been reviewed by a
          lawyer.
        </p>
      </div>

      <nav aria-label="Legal documents" className="flex flex-wrap gap-2">
        {SLUGS.map((slug) => (
          <Link
            key={slug}
            href={`/legal/${slug}`}
            aria-current={slug === doc ? "page" : undefined}
            className={
              slug === doc
                ? "inline-flex h-8 items-center rounded-lg bg-white/10 px-3 text-sm font-medium text-white"
                : "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            }
          >
            {DOCS[slug]!.title}
          </Link>
        ))}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 flex flex-col gap-1 text-sm"
          >
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              On this page
            </p>
            {entry.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-md py-1 text-white/60 transition-colors hover:text-white"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>
        <article className="flex max-w-[720px] flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="font-display text-[48px] text-paper md:text-[64px]">
              {entry.title}
            </h1>
            <p className="text-base text-muted-foreground">{entry.summary}</p>
            <p className="text-xs text-white/40">
              Last updated: not yet published
            </p>
          </header>
          {entry.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24"
            >
              <h2
                id={`${section.id}-title`}
                className="mb-3 text-lg font-semibold"
              >
                {section.title}
              </h2>
              <div className="flex flex-col gap-3 text-[15px] leading-7 text-white/75">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}
