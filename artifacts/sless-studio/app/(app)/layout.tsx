import { PromoBar } from "@/components/site/promo-bar"
import { TopNav } from "@/components/site/top-nav"

/** Signed-in app pages that scroll (account, billing, admin): compact nav, no footer. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PromoBar />
      <TopNav compact />
      <main
        id="main"
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8"
      >
        {children}
      </main>
    </div>
  )
}
