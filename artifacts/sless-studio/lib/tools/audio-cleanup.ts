import "server-only"

import { createReadStream, createWriteStream } from "node:fs"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

import {
  AUDIO_CLEANUP_MAX_SECONDS,
  AUDIO_CLEANUP_PATHS,
} from "@/generation/catalog/models/audio-cleanup"
import type { StoredMedia } from "@/lib/db/collections"
import { publicUrlFor, putObject, storageDriver } from "@/lib/storage"

import {
  cleanupChain,
  MONO,
  preIsolationChain,
  restoredChain,
  strengthOf,
} from "./audio-filters"
import { restoreVoice } from "./auphonic"
import { isolateVoice } from "./elevenlabs"
import { ToolError } from "./errors"
import { clippingProfile, FfmpegError, probeFile, runFfmpeg } from "./ffmpeg"

/** Largest source we download (uploads are capped at 200 MB). */
const MAX_SOURCE_BYTES = 300 * 1024 * 1024

export type AudioCleanupJob = {
  path: string
  body: Record<string, unknown>
  /** Storage key base for the result: u/{userId}/{generationId}/0 */
  keyBase: string
}

export type AudioCleanupDeps = {
  isolate: typeof isolateVoice
  restore: typeof restoreVoice
  fetch: typeof fetch
}

/**
 * Download the source video, rebuild its sound track and store the result as
 * an MP4 next to the user's other outputs. The picture is stream-copied.
 */
export async function runAudioCleanup(
  job: AudioCleanupJob,
  deps: AudioCleanupDeps = {
    isolate: isolateVoice,
    restore: restoreVoice,
    fetch,
  }
): Promise<StoredMedia> {
  const sourceUrl = job.body.video_url
  if (typeof sourceUrl !== "string")
    throw new ToolError("This video is no longer available.", "no video_url")
  const strength = strengthOf(job.body.strength)
  const isolate = job.path === AUDIO_CLEANUP_PATHS.isolate
  const restore = job.path === AUDIO_CLEANUP_PATHS.restore
  const dir = await mkdtemp(join(tmpdir(), "sless-audio-"))
  try {
    const input = join(dir, "input.mp4")
    await download(sourceUrl, input, deps.fetch)

    const info = await probeFile(input)
    if (!info.hasAudio)
      throw new ToolError("This video has no sound track to clean up.")
    if (info.durationSec && info.durationSec > AUDIO_CLEANUP_MAX_SECONDS + 1)
      throw new ToolError(
        `Audio Cleanup works on clips up to ${AUDIO_CLEANUP_MAX_SECONDS / 60} minutes. Trim the video and try again.`
      )

    const output = join(dir, "output.mp4")
    const encode = [
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-y",
      output,
    ]
    try {
      if (restore) {
        // The AI model gets the sound as recorded (mono, lossless): our own
        // de-clipping would only hide the damage it's trained to rebuild.
        const original = join(dir, "original.flac")
        const restored = join(dir, "restored.audio")
        await runFfmpeg([
          "-i",
          input,
          "-vn",
          "-map",
          "0:a:0",
          "-af",
          MONO,
          "-ar",
          "48000",
          "-c:a",
          "flac",
          "-y",
          original,
        ])
        await deps.restore(original, restored, strength)
        await runFfmpeg([
          "-i",
          input,
          "-i",
          restored,
          "-map",
          "0:v:0?",
          "-map",
          "1:a:0",
          "-af",
          restoredChain(),
          ...encode,
        ])
      } else if (isolate) {
        // Find the clip level, so de-clipping only runs on clipped sound.
        const clip = await clippingProfile(input)
        const declipped = join(dir, "declipped.flac")
        const isolated = join(dir, "isolated.audio")
        await runFfmpeg([
          "-i",
          input,
          "-vn",
          "-map",
          "0:a:0",
          "-af",
          preIsolationChain(clip),
          "-ac",
          "1",
          "-ar",
          "44100",
          "-c:a",
          "flac",
          "-y",
          declipped,
        ])
        await deps.isolate(declipped, isolated)
        await runFfmpeg([
          "-i",
          input,
          "-i",
          isolated,
          "-map",
          "0:v:0?",
          "-map",
          "1:a:0",
          "-af",
          cleanupChain(strength, { afterIsolation: true }),
          ...encode,
        ])
      } else {
        const clip = await clippingProfile(input)
        await runFfmpeg([
          "-i",
          input,
          "-map",
          "0:v:0?",
          "-map",
          "0:a:0",
          "-af",
          cleanupChain(strength, { clip }),
          ...encode,
        ])
      }
    } catch (error) {
      if (error instanceof FfmpegError)
        throw new ToolError(
          "We couldn't process this video's sound.",
          `${error.message}\n${error.log}`
        )
      throw error
    }

    const result = await probeFile(output)
    const { size } = await stat(output)
    const key = `${job.keyBase}.mp4`
    await putObject(
      key,
      Readable.toWeb(createReadStream(output)) as ReadableStream<Uint8Array>,
      "video/mp4"
    )
    return {
      key,
      url: publicUrlFor(key),
      contentType: "video/mp4",
      bytes: size,
      storage: storageDriver(),
      ...(result.width ? { width: result.width } : {}),
      ...(result.height ? { height: result.height } : {}),
      ...(result.durationSec ? { durationSec: result.durationSec } : {}),
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function download(
  url: string,
  path: string,
  fetchImpl: typeof fetch
): Promise<void> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    })
  } catch (error) {
    throw new ToolError(
      "We couldn't read this video. Upload it again and retry.",
      `download failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (!response.ok || !response.body)
    throw new ToolError(
      "We couldn't read this video. Upload it again and retry.",
      `download failed: HTTP ${response.status}`
    )
  let total = 0
  const cap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length
      if (total > MAX_SOURCE_BYTES)
        callback(new ToolError("This video is too large to process."))
      else callback(null, chunk)
    },
  })
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    cap,
    createWriteStream(path)
  )
}
