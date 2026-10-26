import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.STUDIO_PREVIEW !== "true" || process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 })
  const { path } = await context.params
  if (path.some(part => part === "." || part === ".." || part.includes("/")))
    return new Response(null, { status: 400 })
  // Fixed loopback target. No caller-controlled URL or arbitrary proxy destination.
  const target = `http://127.0.0.1:4010/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`
  const response = await fetch(target, {
    method: request.method,
    headers: { "content-type": request.headers.get("content-type") ?? "application/octet-stream" },
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    redirect: "error",
  })
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/octet-stream", "cache-control": "no-store" },
  })
}
export { proxy as GET, proxy as PUT, proxy as POST }
