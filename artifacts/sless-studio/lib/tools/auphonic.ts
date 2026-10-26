import "server-only"

import { readFile, writeFile } from "node:fs/promises"

import { env } from "@/lib/env"

import type { Strength } from "./audio-filters"
import { ToolError } from "./errors"

/**
 * Auphonic Studio Voice: an AI model that "reconstructs a clear, studio-quality
 * voice" and repairs "distorted or clipped voices from overdriven microphones"
 * (https://auphonic.com/help/algorithms/singletrack.html). That is distortion
 * baked into the voice itself — the case filters can't fix.
 *
 * One production per job (https://auphonic.com/help/api/details.html):
 *   POST   /api/productions.json               create, with algorithms + output_files
 *   POST   /api/production/{uuid}/upload.json  multipart field `input_file`
 *   POST   /api/production/{uuid}/start.json
 *   GET    /api/production/{uuid}/status.json  until status 3 ("Done")
 *   GET    /api/production/{uuid}.json         output_files[].download_url
 *   DELETE /api/production/{uuid}.json         afterwards, so no copy of the
 *                                              user's audio stays with Auphonic
 *                                              (https://auphonic.com/help/api/update.html)
 * Auth: `Authorization: bearer {api_key}`. Billed on input length, at least
 * 3 minutes per production (https://auphonic.com/help/web/pricing_faq.html).
 */

const UNAVAILABLE =
  "Fixing distorted voices is unavailable right now. Try again later."
const UNREADABLE = "Fixing distorted voices couldn't read this video's sound."

const STATUS_DONE = 3
const STATUS_ERROR = 2

export function voiceRestorationConfigured(): boolean {
  return Boolean(env().AUPHONIC_API_KEY)
}

/**
 * Studio Voice always runs; Strength sets how much background goes with it.
 * Loudness is left to our own finishing pass (the same -16 LUFS as every
 * other Audio Cleanup mode), so only documented on/off values are sent here.
 */
export function studioVoiceAlgorithms(
  strength: Strength
): Record<string, string | number | boolean> {
  const base = {
    filtering: true,
    filtermethod: "studiovoice",
    leveler: true,
    normloudness: false,
  }
  if (strength === "light") return { ...base, denoise: false }
  return {
    ...base,
    denoise: true,
    // Dynamic Denoiser: fast-changing noise and echo out, speech kept.
    // Speech Isolation: keeps only speech (crowd and music go too).
    denoisemethod: strength === "strong" ? "speech_isolation" : "dynamic",
    denoiseamount: 0,
    deverbamount: 0,
  }
}

export type RestoreOptions = {
  fetch?: typeof fetch
  /** Wait between status checks. */
  pollMs?: number
  /** Give up on a production that hasn't finished by then. */
  timeoutMs?: number
}

type Json = Record<string, unknown>

export async function restoreVoice(
  inputPath: string,
  outputPath: string,
  strength: Strength,
  options: RestoreOptions = {}
): Promise<void> {
  const { AUPHONIC_API_KEY: key, AUPHONIC_API_BASE_URL: baseUrl } = env()
  if (!key)
    throw new ToolError(
      "Fixing distorted voices isn't set up on this site.",
      "AUPHONIC_API_KEY is not set"
    )
  const fetchImpl = options.fetch ?? fetch
  const pollMs = options.pollMs ?? 5_000
  const timeoutMs = options.timeoutMs ?? 9 * 60_000
  const base = baseUrl.replace(/\/$/, "")
  const auth = { authorization: `bearer ${key}` }

  async function api(
    path: string,
    init: { method?: string; body?: BodyInit; json?: Json } = {},
    attempts = 3
  ): Promise<Json> {
    let lastDetail = ""
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let response: Response
      try {
        response = await fetchImpl(`${base}${path}`, {
          method: init.method ?? "GET",
          headers: init.json
            ? { ...auth, "content-type": "application/json" }
            : auth,
          body: init.json ? JSON.stringify(init.json) : init.body,
          signal: AbortSignal.timeout(init.body ? 180_000 : 30_000),
        })
      } catch (error) {
        lastDetail = `${path} network: ${error instanceof Error ? error.message : String(error)}`
        await pause(attempt)
        continue
      }
      const text = await response.text().catch(() => "")
      if (response.ok) {
        const parsed = parseJson(text)
        const data = parsed?.data
        return isObject(data) ? data : {}
      }
      const message = errorMessage(parseJson(text)) || text.slice(0, 300)
      lastDetail = `Auphonic ${response.status} on ${path}: ${message}`
      if (response.status === 429 || response.status >= 500) {
        await pause(attempt)
        continue
      }
      if (response.status === 401 || response.status === 403)
        throw new ToolError(
          UNAVAILABLE,
          `${lastDetail} (check AUPHONIC_API_KEY)`
        )
      if (/credit/i.test(message))
        throw new ToolError(
          UNAVAILABLE,
          `${lastDetail} (top up Auphonic credits)`
        )
      throw new ToolError(UNREADABLE, lastDetail)
    }
    throw new ToolError(UNAVAILABLE, lastDetail)
  }

  let uuid: string | undefined
  try {
    const created = await api(
      "/api/productions.json",
      {
        method: "POST",
        json: {
          metadata: { title: "Sless Studio audio cleanup" },
          algorithms: studioVoiceAlgorithms(strength),
          output_files: [{ format: "flac" }],
        },
      },
      2
    )
    if (typeof created.uuid !== "string" || !created.uuid)
      throw new ToolError(UNAVAILABLE, "Auphonic returned no production uuid")
    uuid = created.uuid

    const form = new FormData()
    form.append(
      "input_file",
      new Blob([new Uint8Array(await readFile(inputPath))], {
        type: "audio/flac",
      }),
      "audio.flac"
    )
    await api(`/api/production/${uuid}/upload.json`, {
      method: "POST",
      body: form,
    })
    await api(`/api/production/${uuid}/start.json`, { method: "POST" }, 1)

    const deadline = Date.now() + timeoutMs
    for (;;) {
      const state = await api(`/api/production/${uuid}/status.json`)
      if (state.status === STATUS_DONE || state.status_string === "Done") break
      if (
        state.status === STATUS_ERROR ||
        state.status_string === "Error" ||
        errorMessage(state)
      ) {
        const details = await api(`/api/production/${uuid}.json`).catch(
          () => state
        )
        throw new ToolError(
          UNREADABLE,
          `Auphonic production failed: ${errorMessage(details) || errorMessage(state) || "no message"}`
        )
      }
      if (Date.now() > deadline)
        throw new ToolError(
          UNAVAILABLE,
          `Auphonic production still at "${String(state.status_string ?? state.status)}" after ${timeoutMs / 1000} s`
        )
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }

    const details = await api(`/api/production/${uuid}.json`)
    const files = Array.isArray(details.output_files)
      ? details.output_files.filter(isObject)
      : []
    const file =
      files.find((f) => f.format === "flac" && f.download_url) ??
      files.find((f) => typeof f.download_url === "string")
    const downloadUrl =
      typeof file?.download_url === "string" ? file.download_url : ""
    if (!downloadUrl)
      throw new ToolError(UNAVAILABLE, "Auphonic returned no output file")

    // The key only goes to Auphonic's own host; a redirect elsewhere (their
    // file storage) is followed without it.
    const sameHost = new URL(downloadUrl, base).origin === new URL(base).origin
    let audio: Buffer | undefined
    let lastDetail = ""
    for (let attempt = 1; attempt <= 3 && !audio; attempt++) {
      try {
        const response = await fetchImpl(new URL(downloadUrl, base), {
          headers: sameHost ? auth : {},
          redirect: "follow",
          signal: AbortSignal.timeout(180_000),
        })
        if (response.ok) audio = Buffer.from(await response.arrayBuffer())
        else lastDetail = `download HTTP ${response.status}`
      } catch (error) {
        lastDetail = `download: ${error instanceof Error ? error.message : String(error)}`
      }
      if (!audio) await pause(attempt)
    }
    if (!audio) throw new ToolError(UNAVAILABLE, lastDetail)
    if (audio.length < 64)
      throw new ToolError(UNAVAILABLE, "Auphonic returned an empty file")
    await writeFile(outputPath, audio)
  } finally {
    if (uuid)
      await api(`/api/production/${uuid}.json`, { method: "DELETE" }, 1).catch(
        (error: unknown) =>
          console.warn(
            "[tools] couldn't delete the Auphonic production",
            error instanceof ToolError ? error.operatorDetail : error
          )
      )
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseJson(text: string): Json | undefined {
  try {
    const value: unknown = JSON.parse(text)
    return isObject(value) ? value : undefined
  } catch {
    return undefined
  }
}

function errorMessage(value: Json | undefined): string {
  const message = value?.error_message
  return typeof message === "string" ? message.trim() : ""
}

function pause(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
}
