/**
 * Capture our pages at 1440 and 390 px into docs/screens/sless-<page>-<width>.png
 * for side-by-side comparison with the reference captures (docs/screens/<page>-<width>.png).
 *   BASE_URL=http://localhost:3000 pnpm exec tsx scripts/screenshots.ts
 * Optional: CHROME_PATH (a Chromium binary instead of installed Chrome),
 * SHOT_DIR (output folder), FULL=1 (full-page captures), ONLY=home,video.
 */
import { chromium } from "@playwright/test"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const PAGES: [name: string, path: string][] = [
  ["home", "/"],
  ["image", "/image"],
  ["video", "/video"],
  ["effects", "/effects"],
  ["effects-detail", "/effects/neon-noir"],
  ["community", "/community"],
  ["pricing", "/pricing"],
  ["login", "/login"],
]

const OUT = process.env.SHOT_DIR ?? "docs/screens"
const FULL = process.env.FULL === "1"
const ONLY = process.env.ONLY?.split(",")
const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: "chrome" }
)
for (const width of [1440, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    deviceScaleFactor: width === 390 ? 2 : 1,
    isMobile: width === 390,
    hasTouch: width === 390,
  })
  await context.addInitScript(() =>
    localStorage.setItem(
      "sless.consent.v1",
      JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
        at: 0,
      })
    )
  )
  const page = await context.newPage()
  for (const [name, path] of PAGES) {
    if (ONLY && !ONLY.includes(name)) continue
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    await page.screenshot({
      path: `${OUT}/sless-${name}-${width}.png`,
      fullPage: FULL,
    })
    console.log(`captured ${name} @ ${width}`)
  }
  await context.close()
}
await browser.close()
