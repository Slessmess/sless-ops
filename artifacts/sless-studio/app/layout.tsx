import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { unstable_rethrow } from "next/navigation"

import { AuthModal } from "@/components/auth/auth-modal"
import { UpgradeModal } from "@/components/billing/upgrade-modal"
import {
  AppProviders,
  type ClientUser,
} from "@/components/providers/app-providers"
import { CookieConsent } from "@/components/site/cookie-consent"
import { PreviewNotice } from "@/components/site/preview-notice"
import { getBalance } from "@/lib/account"
import { currentUser } from "@/lib/auth/session"
import { BRAND } from "@/lib/brand"
import { clientPricing, type ClientPricing } from "@/lib/billing/pricing"
import { cn } from "@/lib/utils"

import "./globals.css"

// Self-hosted (OFL, from Fontsource) so builds never depend on Google Fonts.
// styles/theme.css maps them onto the Quanta --hf-type-family-*-base slots:
// Anton = display headlines, Archivo (wide, heavy) = nav/buttons/eyebrows,
// Inter = body, IBM Plex Mono = numbers.
const anton = localFont({
  src: "./fonts/anton-latin-400-normal.woff2",
  weight: "400",
  variable: "--font-anton",
  display: "swap",
})
const archivo = localFont({
  src: [
    {
      path: "./fonts/archivo-latin-wdth-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/archivo-latin-wdth-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-archivo",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
})
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
})
const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? BRAND.productionUrl),
  title: {
    default: `${BRAND.name} — AI image & video, by Sless Is More`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  openGraph: {
    title: `${BRAND.name} — AI image & video studio`,
    description: BRAND.description,
    images: ["/media/hero/coast.jpg"],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
}

export const viewport: Viewport = {
  themeColor: "#0d0d0c",
  colorScheme: "dark",
}

/** Session, live balance and pricing for the client providers. Signed-out on DB errors. */
async function bootstrap(): Promise<{
  user: ClientUser | null
  credits: number | null
  pricing: ClientPricing
}> {
  const pricing = await clientPricing()
  try {
    const user = await currentUser()
    if (!user) return { user: null, credits: null, pricing }
    const balance = await getBalance(user.objectId)
    return {
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
      },
      credits: balance.total,
      pricing,
    }
  } catch (error) {
    // Let Next's own control-flow errors (dynamic rendering, redirects) through.
    unstable_rethrow(error)
    console.error(
      "[layout] session unavailable",
      error instanceof Error ? error.message : error
    )
    return { user: null, credits: null, pricing }
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, credits, pricing } = await bootstrap()
  return (
    <html
      lang="en"
      data-theme="default-dark"
      className={cn(
        "dark font-sans antialiased",
        anton.variable,
        archivo.variable,
        inter.variable,
        plexMono.variable
      )}
    >
      <body className="min-h-dvh bg-page text-foreground">
        <a
          href="#main"
          className="font-label sr-only z-[100] bg-brand px-3 py-2 text-xs text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <PreviewNotice />
        <AppProviders user={user} initialCredits={credits} pricing={pricing}>
          {children}
          <AuthModal />
          <UpgradeModal />
          <CookieConsent />
        </AppProviders>
      </body>
    </html>
  )
}
