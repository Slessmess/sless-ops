import "server-only"

/** A non-overlapping production-capable loop; DB leases serialize tool runners. */
export async function startBackgroundWorker(): Promise<void> {
  const state = globalThis as typeof globalThis & { __slessWorkerStarted?: boolean }
  if (state.__slessWorkerStarted) return
  state.__slessWorkerStarted = true
  const { runToolJobs } = await import("@/lib/tools/jobs")
  const { reconcile } = await import("@/lib/generations/reconcile")
  let stopping = false
  const stop = () => { stopping = true }
  process.once("SIGTERM", stop)
  process.once("SIGINT", stop)
  async function tick() {
    try {
      await runToolJobs({ max: 1 })
      await reconcile()
    } catch (error) {
      console.error("[studio-worker]", error instanceof Error ? error.message : "Worker failed")
    } finally {
      if (!stopping) setTimeout(() => void tick(), 5000).unref()
    }
  }
  void tick()
}
