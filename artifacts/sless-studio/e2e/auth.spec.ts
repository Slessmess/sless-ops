import { expect, test } from "@playwright/test"

import { dismissCookies, uniqueEmail } from "./helpers"

test("sign up by magic link from the auth modal and receive the bonus", async ({
  page,
}) => {
  const email = uniqueEmail("signup")
  await page.goto("/video")
  await dismissCookies(page)
  await page.getByRole("button", { name: "Sign up" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Sign up" })
  await dialog.getByPlaceholder("you@example.com").fill(email)
  await dialog.getByRole("checkbox", { name: /agree/ }).check()
  await dialog.getByRole("button", { name: "Continue with email" }).click()
  await expect(dialog.getByText("Check your email")).toBeVisible()

  const mail = await page.request.get(
    `/api/test/mailbox?to=${encodeURIComponent(email)}`
  )
  expect(mail.ok()).toBeTruthy()
  const { url, subject } = (await mail.json()) as {
    url: string
    subject: string
  }
  expect(subject).toContain("Sign in to")
  await page.goto(url)
  await expect(page).toHaveURL(/\/video/)
  const pill = page.getByRole("link", { name: /credits — account/ })
  await expect(pill).toBeVisible()
  await expect(pill).not.toContainText("—")

  // Sign out from the avatar menu.
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(
    page.getByRole("button", { name: "Sign up" }).first()
  ).toBeVisible()
})

test("protected pages redirect signed-out visitors to /login", async ({
  page,
}) => {
  await page.goto("/assets")
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fassets/)
})
