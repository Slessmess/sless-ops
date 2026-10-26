import { expect, type Page } from "@playwright/test"

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`
}

/**
 * Sign in through Auth.js' own endpoints and the dev mailbox (E2E_TEST_MODE):
 * CSRF → POST /api/auth/signin/resend → follow the magic link.
 */
export async function signIn(
  page: Page,
  email: string,
  callbackUrl = "/"
): Promise<void> {
  const csrf = await (await page.request.get("/api/auth/csrf")).json()
  const response = await page.request.post("/api/auth/signin/resend", {
    form: { email, csrfToken: csrf.csrfToken, callbackUrl },
    maxRedirects: 0,
  })
  // Auth.js answers with a redirect to the "check your email" page.
  expect(response.status()).toBe(302)
  expect(response.headers().location).toContain("verify-request")
  let link: string | undefined
  await expect
    .poll(async () => {
      const mail = await page.request.get(
        `/api/test/mailbox?to=${encodeURIComponent(email)}`,
        {
          headers: process.env.E2E_SECRET
            ? { "x-e2e-secret": process.env.E2E_SECRET }
            : {},
        }
      )
      if (!mail.ok()) return false
      link = ((await mail.json()) as { url: string }).url
      return true
    })
    .toBe(true)
  await page.goto(link!)
  await expect(
    page.getByRole("link", { name: /credits — account/ })
  ).toBeVisible()
}

export async function balance(page: Page): Promise<number> {
  const me = (await (await page.request.get("/api/me")).json()) as {
    total?: number
  }
  return me.total ?? -1
}

export async function dismissCookies(page: Page): Promise<void> {
  const reject = page.getByRole("button", {
    name: "Reject non-essential cookies",
  })
  if (await reject.isVisible().catch(() => false)) await reject.click()
}
