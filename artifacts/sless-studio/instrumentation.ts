/** Keep Node-only packages out of Next's separate Edge instrumentation build. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./lib/runtime/register")
    await registerNode()
  }
}
