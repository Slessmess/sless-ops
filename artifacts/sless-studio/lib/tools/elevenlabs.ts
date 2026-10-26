import "server-only"

import { readFile, writeFile } from "node:fs/promises"

import { env } from "@/lib/env"

import { ToolError } from "./errors"

/**
 * ElevenLabs Voice Isolator: POST /v1/audio-isolation (multipart, field
 * `audio`), answers with the isolated audio. $0.12 per minute of audio, up to
 * 500 MB / 1 hour per file.
 * https://elevenlabs.io/docs/api-reference/audio-isolation/convert
 */

const UNAVAILABLE =
  "AI voice isolation is unavailable right now. Try Repair, or try again later."

export function voiceIsolationConfigured(): boolean {
  return Boolean(env().ELEVENLABS_API_KEY)
}

export async function isolateVoice(
  inputPath: string,
  outputPath: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const { ELEVENLABS_API_KEY: key, ELEVENLABS_API_BASE_URL: base } = env()
  if (!key)
    throw new ToolError(
      "AI voice isolation isn't set up on this site.",
      "ELEVENLABS_API_KEY is not set"
    )
  const form = new FormData()
  form.append(
    "audio",
    new Blob([new Uint8Array(await readFile(inputPath))], {
      type: "audio/flac",
    }),
    "audio.flac"
  )
  form.append("file_format", "other")

  let lastDetail = ""
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: Response
    try {
      response = await fetchImpl(
        `${base.replace(/\/$/, "")}/v1/audio-isolation`,
        {
          method: "POST",
          headers: { "xi-api-key": key },
          body: form,
          signal: AbortSignal.timeout(240_000),
        }
      )
    } catch (error) {
      lastDetail = `network: ${error instanceof Error ? error.message : String(error)}`
      await pause(attempt)
      continue
    }
    if (response.ok) {
      const audio = Buffer.from(await response.arrayBuffer())
      if (audio.length < 64)
        throw new ToolError(UNAVAILABLE, "ElevenLabs returned an empty file")
      await writeFile(outputPath, audio)
      return
    }
    const body = (await response.text().catch(() => "")).slice(0, 300)
    lastDetail = `ElevenLabs ${response.status}: ${body}`
    if (response.status === 429 || response.status >= 500) {
      await pause(attempt)
      continue
    }
    if (response.status === 401 || response.status === 403)
      throw new ToolError(
        UNAVAILABLE,
        `${lastDetail} (check ELEVENLABS_API_KEY and its credits)`
      )
    throw new ToolError(
      "AI voice isolation couldn't read this video's sound.",
      lastDetail
    )
  }
  throw new ToolError(UNAVAILABLE, lastDetail)
}

function pause(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
}
