import { Footer } from "@/components/site/footer"
import { PromoBar } from "@/components/site/promo-bar"
import { TopNav } from "@/components/site/top-nav"

/** Marketing pages: expanded nav, scrolling content, yellow footer. */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PromoBar />
      <TopNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
