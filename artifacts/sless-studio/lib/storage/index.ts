import "server-only"

import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, normalize, sep } from "node:path"

import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"

import { env, r2Configured } from "@/lib/env"

import { probeMedia, type ProbeResult } from "./probe"

/**
 * Media storage. Production: Cloudflare R2 (S3 API). Development without R2
 * credentials: files under .data/media served by /api/media. Every finished
 * output is copied here because the platform keeps outputs "at least seven
 * days" (docs: concepts/billing-and-retention).
 */

export class MediaTooLargeError extends Error {
  constructor() {
    super("Media file is larger than allowed")
    this.name = "MediaTooLargeError"
  }
}

/** Read a body into memory, aborting as soon as it exceeds `maxBytes`. */
export async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new MediaTooLargeError()
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export type StoredObject = ProbeResult & {
  key: string
  url: string
  contentType: string
  bytes: number
  storage: "r2" | "local"
}

// Dev-only disk storage; excluded from Turbopack's output file tracing.
export const LOCAL_MEDIA_ROOT =
  process.env.LOCAL_MEDIA_DIR ??
  join(/*turbopackIgnore: true*/ process.cwd(), ".data", "media")
/** Largest file we buffer to probe; bigger files stream straight through. */
const PROBE_LIMIT_BYTES = 300 * 1024 * 1024
const MAX_COPY_BYTES = 2 * 1024 * 1024 * 1024

let s3: S3Client | undefined

function r2(): S3Client {
  const value = env()
  s3 ??= new S3Client({
    region: "auto",
    endpoint:
      value.R2_ENDPOINT ??
      `https://${value.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(value.R2_ENDPOINT),
    credentials: {
      accessKeyId: value.R2_ACCESS_KEY_ID!,
      secretAccessKey: value.R2_SECRET_ACCESS_KEY!,
    },
  })
  return s3
}

export function storageDriver(): "r2" | "local" {
  return r2Configured() ? "r2" : "local"
}

export function publicUrlFor(key: string): string {
  const value = env()
  if (storageDriver() === "r2")
    return `${value.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`
  return `${value.APP_URL.replace(/\/$/, "")}/api/media/${key}`
}

/** Resolve a local key safely inside LOCAL_MEDIA_ROOT (no traversal). */
export function localPathFor(key: string): string {
  const path = normalize(join(/*turbopackIgnore: true*/ LOCAL_MEDIA_ROOT, key))
  if (!path.startsWith(LOCAL_MEDIA_ROOT + sep)) throw new Error("Invalid key")
  return path
}

export async function putObject(
  key: string,
  body: Buffer | ReadableStream<Uint8Array>,
  contentType: string
): Promise<{ bytes?: number }> {
  if (storageDriver() === "r2") {
    await new Upload({
      client: r2(),
      params: {
        Bucket: env().R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    }).done()
    return { bytes: Buffer.isBuffer(body) ? body.length : undefined }
  }
  const path = localPathFor(key)
  await mkdir(dirname(path), { recursive: true })
  const bytes = Buffer.isBuffer(body)
    ? body
    : Buffer.from(await new Response(body).arrayBuffer())
  await writeFile(path, bytes)
  return { bytes: bytes.length }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return
  if (storageDriver() === "r2") {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: env().R2_BUCKET!,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      })
    )
    return
  }
  await Promise.all(keys.map((key) => rm(localPathFor(key), { force: true })))
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "application/zip": "zip",
}

export function extensionFor(contentType: string, url?: string): string {
  const known = EXTENSIONS[contentType.split(";")[0]!.trim().toLowerCase()]
  if (known) return known
  const fromUrl = url ? new URL(url).pathname.split(".").pop() : undefined
  return fromUrl && /^[a-z0-9]{2,5}$/i.test(fromUrl)
    ? fromUrl.toLowerCase()
    : "bin"
}

function guessType(url: string, fallback: string): string {
  const ext = new URL(url).pathname.split(".").pop()?.toLowerCase()
  const byExt = Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0]
  return byExt ?? fallback
}

/**
 * Stream a remote file into storage at `keyBase.{ext}` and probe it.
 * Signed or temporary URLs are never logged.
 */
export async function copyFromUrl(
  sourceUrl: string,
  keyBase: string,
  options: {
    contentType?: string
    maxBytes?: number
    fetch?: typeof fetch
  } = {}
): Promise<StoredObject> {
  const hintContentType = options.contentType
  const maxBytes = options.maxBytes ?? MAX_COPY_BYTES
  const response = await (options.fetch ?? fetch)(sourceUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok || !response.body)
    throw new Error(`Media download failed (${response.status})`)
  const header = response.headers.get("content-type")?.split(";")[0]?.trim()
  const contentType =
    header &&
    header !== "application/octet-stream" &&
    header !== "binary/octet-stream"
      ? header
      : guessType(sourceUrl, hintContentType ?? "application/octet-stream")
  const declared = Number(response.headers.get("content-length") ?? "0")
  if (declared > maxBytes) throw new MediaTooLargeError()
  const key = `${keyBase}.${extensionFor(contentType, sourceUrl)}`

  if (declared > PROBE_LIMIT_BYTES) {
    await putObject(key, response.body, contentType)
    return {
      key,
      url: publicUrlFor(key),
      contentType,
      bytes: declared,
      storage: storageDriver(),
    }
  }
  const buffer = await readCapped(response.body, maxBytes)
  await putObject(key, buffer, contentType)
  return {
    key,
    url: publicUrlFor(key),
    contentType,
    bytes: buffer.length,
    storage: storageDriver(),
    ...probeMedia(buffer, contentType),
  }
}
