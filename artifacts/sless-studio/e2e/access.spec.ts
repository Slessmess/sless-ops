import { expect, test } from "./fixtures"

import { dismissCookies, signIn, uniqueEmail } from "./helpers"

const consent = () =>
  localStorage.setItem(
    "sless.consent.v1",
    JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false,
      at: 0,
    })
  )

test("user B can't read user A's generation status or open A's project", async ({
  browser,
}) => {
  const a = await browser.newContext()
  await a.addInitScript(consent)
  const pageA = await a.newPage()
  await signIn(pageA, uniqueEmail("owner-a"), "/assets")
  await dismissCookies(pageA)
  // Retry until hydrated: a click on server-rendered HTML does nothing yet.
  const projectName = pageA.getByRole("textbox", { name: "Project name" })
  await expect(async () => {
    await pageA.getByRole("button", { name: "New project" }).click()
    await expect(projectName).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await projectName.fill("Private project")
  await pageA.getByRole("button", { name: "Create" }).click()
  await expect(pageA).toHaveURL(/\/projects\/[a-f0-9]{24}/)
  const projectUrl = pageA.url()

  await pageA.goto("/image")
  await pageA
    .getByRole("textbox", { name: /Describe the scene/ })
    .fill("Owner-only image")
  await pageA.getByRole("button", { name: /^Generate/ }).click()
  await expect
    .poll(
      async () =>
        (
          (await (await pageA.request.get("/api/generations")).json()) as {
            items: unknown[]
          }
        ).items.length
    )
    .toBeGreaterThan(0)
  const list = (await (await pageA.request.get("/api/generations")).json()) as {
    items: { id: string }[]
  }
  const id = list.items[0]!.id

  const b = await browser.newContext()
  await b.addInitScript(consent)
  const pageB = await b.newPage()
  await signIn(pageB, uniqueEmail("intruder-b"), "/video")
  const status = (await (
    await pageB.request.get(`/api/generations/status?ids=${id}`)
  ).json()) as { items: unknown[] }
  expect(status.items).toEqual([])
  const response = await pageB.goto(projectUrl)
  expect(response?.status()).toBe(404)
  const anonymous = await (
    await browser.newContext()
  ).request.get(
    new URL(`/api/generations/status?ids=${id}`, pageA.url()).toString()
  )
  expect(anonymous.status()).toBe(401)
  await a.close()
  await b.close()
})
