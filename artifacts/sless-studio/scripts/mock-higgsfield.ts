/**
 * A local stand-in for the Higgsfield REST API (docs.higgsfield.ai), for
 * development and E2E tests without a platform key. Implements the documented
 * shapes: submit (+ hf_webhook), status, cancel, signed uploads and estimate.
 *
 *   pnpm mock:higgsfield            # http://localhost:4010
 *   HF_API_BASE_URL=http://localhost:4010  HF_CREDENTIALS=mock:mock
 *
 * Also stands in for ElevenLabs Voice Isolator (POST /v1/audio-isolation,
 * echoes the uploaded audio back) when ELEVENLABS_API_BASE_URL points here,
 * and for Auphonic's production API (create → upload → start → status →
 * download → delete; the "restored" file is the uploaded one, ready ~3 s
 * after start) when AUPHONIC_API_BASE_URL points here.
 *
 * Prompt tokens steer outcomes: "[fail]" → failed, "[nsfw]" → nsfw,
 * "[slow]" → stays queued 20 s (cancelable), otherwise completes in ~6 s.
 * Outputs are our own sample media from /public/media.
 */
import { randomUUID } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { extname, join } from "node:path"

const PORT = Number(process.env.MOCK_HF_PORT ?? 4010)
const BASE = process.env.MOCK_PUBLIC_BASE ?? `http://localhost:${PORT}`
const PUBLIC = join(process.cwd(), "public", "media")

type Request = {
  status:
    "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled"
  path: string
  body: Record<string, unknown>
  webhook?: string
  createdAt: number
  outcome: "completed" | "failed" | "nsfw"
  slow: boolean
}

const requests = new Map<string, Request>()
const uploads = new Map<string, { type: string; body: Buffer }>()
const productions = new Map<
  string,
  { file?: Buffer; doneAt?: number; algorithms: unknown }
>()
const images = [
  ...readdirSync(join(PUBLIC, "presets")).map((f) => `presets/${f}`),
  ...readdirSync(join(PUBLIC, "showcase")).map((f) => `showcase/${f}`),
].filter((f) => f.endsWith(".jpg"))
const videos = readdirSync(join(PUBLIC, "loops"))
  .filter((f) => f.endsWith(".mp4"))
  .map((f) => `loops/${f}`)

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
}

function send(res: ServerResponse, status: number, data?: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    "x-correlation-id": randomUUID(),
  })
  res.end(data === undefined ? "" : JSON.stringify(data))
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

function isVideoPath(path: string): boolean {
  return /video|kling|seedance|wan|minimax|hailuo|happy-horse|ltx|pixverse|cinema-studio|genjutsu/.test(
    path
  )
}

function statusOf(id: string, request: Request): Record<string, unknown> {
  const age = Date.now() - request.createdAt
  if (request.status === "queued" && age > (request.slow ? 20_000 : 1_500))
    request.status = "in_progress"
  if (
    request.status === "in_progress" &&
    age > (request.slow ? 26_000 : 6_000)
  ) {
    request.status = request.outcome
    void deliverWebhook(id, request)
  }
  const out: Record<string, unknown> = {
    status: request.status,
    request_id: id,
    status_url: `${BASE}/requests/${id}/status`,
    cancel_url: `${BASE}/requests/${id}/cancel`,
  }
  if (request.status === "completed") {
    const seed = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0)
    if (isVideoPath(request.path))
      out.video = { url: `${BASE}/samples/${videos[seed % videos.length]}` }
    else {
      const count = Number(request.body.batch_size ?? 1) || 1
      out.images = Array.from({ length: count }, (_, i) => ({
        url: `${BASE}/samples/${images[(seed + i) % images.length]}`,
      }))
    }
  }
  if (request.status === "failed") out.error = "Generation failed (mock)"
  return out
}

async function deliverWebhook(id: string, request: Request) {
  if (!request.webhook) return
  const status = statusOf(id, request)
  try {
    await fetch(request.webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request_id: id,
        status: request.status,
        error: request.status === "failed" ? "Generation failed (mock)" : null,
        payload:
          request.status === "completed"
            ? { images: status.images, video: status.video }
            : null,
      }),
    })
  } catch {
    /* the reconciler will pick it up */
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", BASE)
  const method = req.method ?? "GET"
  try {
    if (method === "GET" && url.pathname.startsWith("/samples/")) {
      const file = join(PUBLIC, url.pathname.replace("/samples/", ""))
      if (!file.startsWith(PUBLIC))
        return send(res, 404, { detail: "Not found" })
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      })
      return res.end(readFileSync(file))
    }
    if (method === "PUT" && url.pathname.startsWith("/upload/")) {
      const id = url.pathname.split("/")[2]!
      uploads.set(id, {
        type: req.headers["content-type"] ?? "application/octet-stream",
        body: await readBody(req),
      })
      res.writeHead(200, { "access-control-allow-origin": "*" })
      return res.end()
    }
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "PUT",
        "access-control-allow-headers": "content-type, x-amz-tagging",
      })
      return res.end()
    }
    if (method === "GET" && url.pathname.startsWith("/files/")) {
      const file = uploads.get(url.pathname.split("/")[2]!)
      if (!file) return send(res, 404, { detail: "Not found" })
      res.writeHead(200, {
        "content-type": file.type,
        "content-length": file.body.length,
      })
      return res.end(file.body)
    }

    if (method === "POST" && url.pathname === "/v1/audio-isolation") {
      if (!req.headers["xi-api-key"])
        return send(res, 401, { detail: "Missing xi-api-key" })
      const audio = await multipartFile(req, "audio")
      if (!audio) return send(res, 422, { detail: "audio is required" })
      res.writeHead(200, { "content-type": "audio/flac" })
      return res.end(audio)
    }

    if (url.pathname.startsWith("/api/")) {
      if (!/^bearer \S+$/i.test(req.headers.authorization ?? ""))
        return send(res, 401, {
          status_code: 401,
          error_message: "Unauthorized",
        })
      const ok = (data: unknown) =>
        send(res, 200, { status_code: 200, error_message: "", data })
      if (method === "POST" && url.pathname === "/api/productions.json") {
        const body = JSON.parse((await readBody(req)).toString() || "{}") as {
          algorithms?: unknown
        }
        const uuid = randomUUID().replace(/-/g, "").slice(0, 22)
        productions.set(uuid, { algorithms: body.algorithms })
        return ok({ uuid, status: 9, status_string: "Incomplete" })
      }
      const match =
        /^\/api\/(?:production|download\/audio-result)\/([^/.]+)(\/[^?]*|\.json)$/.exec(
          url.pathname
        )
      const production = match ? productions.get(match[1]!) : undefined
      if (!match || !production)
        return send(res, 404, { status_code: 404, error_message: "Not found" })
      const [, uuid, rest] = match
      if (method === "POST" && rest === "/upload.json") {
        production.file = (await multipartFile(req, "input_file")) ?? undefined
        return production.file
          ? ok({ uuid })
          : send(res, 400, { status_code: 400, error_message: "No file" })
      }
      if (method === "POST" && rest === "/start.json") {
        if (!production.file)
          return send(res, 400, {
            status_code: 400,
            error_message: "Production has no input file",
          })
        production.doneAt = Date.now() + 3_000
        return ok({ uuid, status: 1, status_string: "Waiting" })
      }
      const done =
        production.doneAt !== undefined && Date.now() >= production.doneAt
      const state = done
        ? { status: 3, status_string: "Done" }
        : { status: 4, status_string: "Audio Processing" }
      if (method === "GET" && rest === "/status.json") return ok(state)
      if (method === "GET" && rest === ".json")
        return ok({
          uuid,
          ...state,
          algorithms: production.algorithms,
          output_files: done
            ? [
                {
                  format: "flac",
                  download_url: `${BASE}/api/download/audio-result/${uuid}/restored.flac`,
                },
              ]
            : [],
        })
      if (method === "GET" && rest === "/restored.flac" && done) {
        res.writeHead(200, { "content-type": "audio/flac" })
        return res.end(production.file)
      }
      if (method === "DELETE" && rest === ".json") {
        productions.delete(uuid!)
        return ok({})
      }
      return send(res, 404, { status_code: 404, error_message: "Not found" })
    }

    if (!/^Key [^:\s]+:[^:\s]+$/.test(req.headers.authorization ?? ""))
      return send(res, 401, { detail: "Invalid credentials" })

    if (method === "POST" && url.pathname === "/files/generate-upload-url") {
      const { content_type } = JSON.parse(
        (await readBody(req)).toString() || "{}"
      ) as { content_type?: string }
      const id = randomUUID()
      return send(res, 200, {
        upload_url: `${BASE}/upload/${id}`,
        public_url: `${BASE}/files/${id}`,
        content_type,
        upload_headers: {
          "Content-Type": content_type,
          "x-amz-tagging": "retention=temporary",
        },
      })
    }
    const statusMatch = url.pathname.match(/^\/requests\/([^/]+)\/status$/)
    if (method === "GET" && statusMatch) {
      const request = requests.get(statusMatch[1]!)
      return request
        ? send(res, 200, statusOf(statusMatch[1]!, request))
        : send(res, 404, { detail: "Request not found" })
    }
    const cancelMatch = url.pathname.match(/^\/requests\/([^/]+)\/cancel$/)
    if (method === "POST" && cancelMatch) {
      const request = requests.get(cancelMatch[1]!)
      if (!request) return send(res, 404, { detail: "Request not found" })
      statusOf(cancelMatch[1]!, request)
      if (request.status !== "queued")
        return send(res, 400, { detail: "Request already started" })
      request.status = "canceled"
      return send(res, 202)
    }
    // Free on the mock, so the price guard (lib/generations/submit.ts) never
    // refuses a local run: a flat $0.01 would exceed cheap models' basis
    // (e.g. Soul 2 at $0.004) and block them as "being repriced".
    if (method === "POST" && url.pathname.startsWith("/estimate/"))
      return send(res, 200, { credits: "0.000", usd: "0.000" })
    if (method === "POST") {
      const body = JSON.parse(
        (await readBody(req)).toString() || "{}"
      ) as Record<string, unknown>
      const prompt = String(body.prompt ?? "")
      const id = randomUUID()
      requests.set(id, {
        status: "queued",
        path: url.pathname.slice(1),
        body,
        webhook: url.searchParams.get("hf_webhook") ?? undefined,
        createdAt: Date.now(),
        outcome: prompt.includes("[fail]")
          ? "failed"
          : prompt.includes("[nsfw]")
            ? "nsfw"
            : "completed",
        slow: prompt.includes("[slow]"),
      })
      console.log(`[mock] ${url.pathname.slice(1)} → ${id}`)
      return send(res, 200, {
        status: "queued",
        request_id: id,
        status_url: `${BASE}/requests/${id}/status`,
        cancel_url: `${BASE}/requests/${id}/cancel`,
      })
    }
    return send(res, 404, { detail: "Not found" })
  } catch (error) {
    console.error(error)
    return send(res, 500, { detail: "Mock error" })
  }
})

server.listen(PORT, "127.0.0.1", () =>
  console.log(
    `Mock Higgsfield API on ${BASE} (${images.length} images, ${videos.length} videos)`
  )
)

/** The bytes of one file field in a multipart/form-data request. */
async function multipartFile(
  req: IncomingMessage,
  field: string
): Promise<Buffer | null> {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(
    req.headers["content-type"] ?? ""
  )
  const body = await readBody(req)
  const marker = boundary?.[1] ?? boundary?.[2]
  if (!marker) return null
  const delimiter = Buffer.from(`--${marker}`)
  let start = body.indexOf(delimiter)
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length)
    if (next === -1) break
    const part = body.subarray(start + delimiter.length + 2, next - 2)
    const split = part.indexOf("\r\n\r\n")
    const headers = part.subarray(0, split).toString()
    if (headers.includes(`name="${field}"`)) return part.subarray(split + 4)
    start = next
  }
  return null
}
