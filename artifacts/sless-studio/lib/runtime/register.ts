import "server-only"
import { env } from "@/lib/env"

/** Node startup: initialize the existing Mongo schema, then start serial work. */
export async function registerNode() {
  const value = env()
  if (!value.MONGODB_URI) return
  if (process.env.DB_AUTO_INIT !== "false") {
    const state = globalThis as typeof globalThis & { __slessDbSetUp?: boolean }
    if (!state.__slessDbSetUp) {
      state.__slessDbSetUp = true
      try {
        const { db } = await import("@/lib/db/mongo")
        const { ensureIndexes } = await import("@/lib/db/indexes")
        const { seedPresets } = await import("@/lib/presets")
        await ensureIndexes(await db())
        await seedPresets()
      } catch (error) {
        state.__slessDbSetUp = false
        throw error
      }
    }
  }
  if (process.env.STUDIO_BACKGROUND_WORKER === "true") {
    const { startBackgroundWorker } = await import("./worker")
    await startBackgroundWorker()
  }
}
