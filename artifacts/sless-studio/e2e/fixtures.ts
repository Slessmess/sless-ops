import { test as base } from "@playwright/test"

/** Every page starts with a stored "reject non-essential" cookie choice. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem(
          "sless.consent.v1",
          JSON.stringify({
            essential: true,
            analytics: false,
            marketing: false,
            at: 0,
          })
        )
      } catch {}
    })
    await use(context)
  },
})

export { expect } from "@playwright/test"
