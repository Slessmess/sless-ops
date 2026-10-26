import "server-only"

import { spawn } from "node:child_process"

import ffmpegStatic from "ffmpeg-static"

import { env } from "@/lib/env"

import { MONO } from "./audio-filters"

/**
 * Thin wrapper around the ffmpeg binary: the one bundled by `ffmpeg-static`
 * (shipped with each serverless function, see next.config.ts) or a system
 * ffmpeg named by FFMPEG_PATH.
 */

export class FfmpegError extends Error {
  constructor(
    message: string,
    /** The last lines of ffmpeg's log, for operators (never shown to users). */
    readonly log: string
  ) {
    super(message)
    this.name = "FfmpegError"
  }
}

export function ffmpegPath(): string {
  const path = env().FFMPEG_PATH ?? ffmpegStatic
  if (!path) throw new FfmpegError("No ffmpeg binary for this platform", "")
  return path
}

function tail(text: string, lines = 12): string {
  return text.trim().split("\n").slice(-lines).join("\n")
}

/** Run ffmpeg; resolves with its log, rejects on a non-zero exit or timeout. */
export function runFfmpeg(
  args: string[],
  options: { timeoutMs?: number; allowFailure?: boolean } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 8 * 60_000
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath(),
      ["-hide_banner", "-nostdin", "-loglevel", "info", ...args],
      { stdio: ["ignore", "ignore", "pipe"] }
    )
    let log = ""
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      log += chunk
      // Keep memory flat on long runs: progress lines repeat forever.
      if (log.length > 200_000) log = log.slice(-100_000)
    })
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new FfmpegError("ffmpeg timed out", tail(log)))
    }, timeoutMs)
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(new FfmpegError(`ffmpeg could not start: ${error.message}`, ""))
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0 || options.allowFailure) resolve(log)
      else reject(new FfmpegError(`ffmpeg exited with ${code}`, tail(log)))
    })
  })
}

export type MediaInfo = {
  durationSec?: number
  width?: number
  height?: number
  hasVideo: boolean
  hasAudio: boolean
}

/** Read duration, picture size and which streams exist from ffmpeg's banner. */
export function parseMediaInfo(log: string): MediaInfo {
  const duration = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log)
  const video =
    /Stream #\d+:\d+[^\n]*?: Video: [^\n]*?(\d{2,5})x(\d{2,5})/.exec(log)
  const rotated = /rotat(?:e|ion)[^\n]*?-?(90|270)(?:\.0+)?/i.test(log)
  const info: MediaInfo = {
    hasVideo: /Stream #\d+:\d+[^\n]*?: Video: /.test(log),
    hasAudio: /Stream #\d+:\d+[^\n]*?: Audio: /.test(log),
  }
  if (duration) {
    const [, h, m, s] = duration
    info.durationSec =
      Number(h) * 3600 + Number(m) * 60 + Math.round(Number(s) * 100) / 100
  }
  if (video) {
    const w = Number(video[1])
    const h = Number(video[2])
    info.width = rotated ? h : w
    info.height = rotated ? w : h
  }
  return info
}

/** Probe a local file (ffmpeg with no output exits non-zero; that's expected). */
export async function probeFile(path: string): Promise<MediaInfo> {
  const log = await runFfmpeg(["-i", path], {
    allowFailure: true,
    timeoutMs: 60_000,
  })
  return parseMediaInfo(log)
}

export type ClipProfile = {
  /** |sample| at the 99.99th percentile: the clip level of a clipped track. */
  top: number
  /** Share of samples at or above 90 % of `top`. */
  share: number
}

const BINS = 8192
const BIN_MAX = 2

/**
 * Stream the first audio track as raw float samples and build an amplitude
 * histogram (the mono downmix the cleanup chain works on, at the original
 * sample rate: resampling would move the peaks). Clean speech keeps ~0.04 % of samples near its loudest level; a
 * clipped track piles them up there.
 */
export function clippingProfile(
  path: string,
  options: { timeoutMs?: number } = {}
): Promise<ClipProfile | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath(),
      [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-i",
        path,
        "-map",
        "0:a:0",
        "-af",
        MONO,
        "-f",
        "f32le",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    )
    const histogram = new Float64Array(BINS)
    let total = 0
    let carry: Buffer = Buffer.alloc(0)
    let log = ""
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      if (log.length < 20_000) log += chunk
    })
    child.stdout.on("data", (chunk: Buffer) => {
      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk
      const usable = data.length - (data.length % 4)
      for (let offset = 0; offset < usable; offset += 4) {
        const value = Math.abs(data.readFloatLE(offset))
        if (!Number.isFinite(value)) continue
        const bin = Math.min(BINS - 1, Math.floor((value / BIN_MAX) * BINS))
        histogram[bin]! += 1
        total++
      }
      carry = data.subarray(usable)
    })
    const timer = setTimeout(
      () => {
        child.kill("SIGKILL")
        reject(new FfmpegError("ffmpeg timed out", tail(log)))
      },
      options.timeoutMs ?? 4 * 60_000
    )
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(new FfmpegError(`ffmpeg could not start: ${error.message}`, ""))
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new FfmpegError(`ffmpeg exited with ${code}`, tail(log)))
        return
      }
      resolve(profileFromHistogram(histogram, total))
    })
  })
}

/** Exported for tests. */
export function profileFromHistogram(
  histogram: ArrayLike<number>,
  total: number
): ClipProfile | null {
  if (!total) return null
  const binWidth = BIN_MAX / histogram.length
  let above = 0
  let topBin = 0
  for (let bin = histogram.length - 1; bin >= 0; bin--) {
    above += histogram[bin] ?? 0
    if (above >= total * 0.0001) {
      topBin = bin
      break
    }
  }
  const top = (topBin + 1) * binWidth
  const from = Math.floor((top * 0.9) / binWidth)
  let near = 0
  for (let bin = from; bin < histogram.length; bin++)
    near += histogram[bin] ?? 0
  return { top, share: near / total }
}
