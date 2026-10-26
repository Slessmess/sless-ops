/**
 * Cost-free compatibility probe: real five-minute 1080p MP4, real Quick repair,
 * real local output. No database, account, AI-provider or Stripe calls.
 */
import { spawnSync } from "node:child_process"
import { mkdir, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Readable } from "node:stream"
import { createReadStream } from "node:fs"

Object.assign(process.env, { NODE_ENV: "development" })
process.env.LOCAL_MEDIA_DIR = resolve(".data/compatibility/results")
process.env.FFMPEG_PATH = spawnSync("which", ["ffmpeg"], { encoding: "utf8" }).stdout.trim()
for (const name of ["HF_CREDENTIALS", "STRIPE_SECRET_KEY", "AUPHONIC_API_KEY", "ELEVENLABS_API_KEY",
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"])
  delete process.env[name]

const dir = resolve(".data/compatibility")
await mkdir(dir, { recursive: true })
function ffmpeg(args: string[]) {
  const result = spawnSync(process.env.FFMPEG_PATH!, ["-hide_banner", "-nostdin", "-loglevel", "error", ...args], {
    encoding: "utf8", timeout: 180000,
  })
  if (result.status !== 0) throw new Error(`FFmpeg failed: ${result.stderr.slice(-1200)}`)
}
ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30:d=1",
  "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", "-y", join(dir, "picture.mp4")])
const input = join(dir, "input-5min.mp4")
ffmpeg(["-stream_loop", "-1", "-i", join(dir, "picture.mp4"),
  "-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=48000:duration=300:amplitude=0.12:seed=42",
  "-map", "0:v:0", "-map", "1:a:0", "-t", "300", "-c:v", "copy", "-c:a", "aac",
  "-movflags", "+faststart", "-y", input])
const { runAudioCleanup } = await import("../lib/tools/audio-cleanup")
const { probeFile } = await import("../lib/tools/ffmpeg")
const { AUDIO_CLEANUP_PATHS } = await import("../generation/catalog/models/audio-cleanup")
const jobs = []
for (const strength of ["standard", "strong"]) {
  const start = performance.now()
  const result = await runAudioCleanup({
    path: AUDIO_CLEANUP_PATHS.repair,
    body: { video_url: "https://test.invalid/fixture.mp4", strength },
    keyBase: strength,
  }, {
    fetch: (async () => new Response(Readable.toWeb(createReadStream(input)) as ReadableStream<Uint8Array>)) as typeof fetch,
    isolate: async () => { throw new Error("External AI forbidden in this test") },
    restore: async () => { throw new Error("External AI forbidden in this test") },
  })
  const output = join(process.env.LOCAL_MEDIA_DIR!, `${strength}.mp4`)
  const info = await probeFile(output)
  if (!info.hasAudio || !info.hasVideo || Math.abs((info.durationSec ?? 0) - 300) > 1 ||
      info.width !== 1920 || info.height !== 1080)
    throw new Error("Output stream/duration verification failed")
  jobs.push({ strength, elapsedSeconds: Math.round((performance.now() - start) / 100) / 10,
    bytes: (await stat(output)).size, ...info, outputStorage: result.storage })
}
const report = {
  kind: "development-workspace-only", node: process.version,
  input: "Synthetic 5-minute 1080p H.264 MP4 with 48 kHz pink noise, not a real wrestling clip",
  limitation: "An earlier constant-tone de-clipping stress probe was stopped after >7 minutes; this is not a worst-case performance guarantee or quality assessment.",
  paidProviderCalls: 0, productionVmTested: false, jobs,
}
await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2))
console.info(JSON.stringify(report, null, 2))
