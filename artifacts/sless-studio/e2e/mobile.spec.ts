import { expect, test } from "./fixtures"

import { dismissCookies } from "./helpers"

for (const path of [
  "/",
  "/image",
  "/video",
  "/effects",
  "/community",
  "/pricing",
  "/login",
]) {
  test(`no horizontal scroll at 390px: ${path}`, async ({ page }) => {
    await page.goto(path)
    await dismissCookies(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("Generate stays reachable on the video generator at 390px", async ({
  page,
}) => {
  await page.goto("/video")
  await dismissCookies(page)
  await expect(
    page.getByRole("button", { name: /^Generate/ }).last()
  ).toBeInViewport()
})
