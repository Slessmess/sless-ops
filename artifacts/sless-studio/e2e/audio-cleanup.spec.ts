import { fileURLToPath } from "node:url"

import { expect, test } from "./fixtures"

import { balance, dismissCookies, signIn, uniqueEmail } from "./helpers"

const CLIP = fileURLToPath(
  new URL("./media/clipped-speech.mp4", import.meta.url)
)

test("Audio Cleanup repairs an uploaded clip for 1 credit and keeps it in History", async ({
  page,
}) => {
  await signIn(page, uniqueEmail("audio"), "/video?model=audio-cleanup")
  await page.goto("/video?model=audio-cleanup")
  await dismissCookies(page)
  const before = await balance(page)

  // No prompt box: this tool only needs the video.
  await expect(page.getByRole("textbox", { name: /Describe/ })).toHaveCount(0)
  await page.getByRole("button", { name: /Video with sound/ }).click()
  await page.locator('input[type="file"]').setInputFiles(CLIP)
  await expect(
    page.getByRole("button", { name: /Replace video with sound/ })
  ).toBeVisible({ timeout: 30_000 })

  const generate = page.getByRole("button", { name: /^Generate/ }).first()
  await expect(generate).toContainText("1")
  await generate.click()
  await expect.poll(() => balance(page)).toBe(before - 1)

  const tile = page.getByRole("button", {
    name: /Open generation: Audio Cleanup/,
  })
  await expect(tile.first()).toBeVisible({ timeout: 90_000 })
  // Still there after a refresh: the repaired file is in our storage.
  await page.reload()
  await expect(tile.first()).toBeVisible()
})

test("Fix distorted voices (AI) sends the clip to the AI repair and bills it", async ({
  page,
}) => {
  await signIn(page, uniqueEmail("restore"), "/video?model=audio-cleanup")
  await page.goto("/video?model=audio-cleanup")
  await dismissCookies(page)
  const before = await balance(page)

  await page.getByRole("button", { name: /Video with sound/ }).click()
  await page.locator('input[type="file"]').setInputFiles(CLIP)
  await expect(
    page.getByRole("button", { name: /Replace video with sound/ })
  ).toBeVisible({ timeout: 30_000 })

  await page.getByLabel("Cleanup", { exact: true }).click()
  await page.getByRole("option", { name: "Fix distorted voices (AI)" }).click()
  const generate = page.getByRole("button", { name: /^Generate/ }).first()
  // ($0.11 + 4.6 s × $0.0006) × 2 / $0.01 → 23 credits.
  await expect(generate).toContainText("23")
  await generate.click()
  await expect.poll(() => balance(page)).toBe(before - 23)

  await expect(
    page.getByRole("button", { name: /Open generation: Audio Cleanup/ }).first()
  ).toBeVisible({ timeout: 90_000 })
})
