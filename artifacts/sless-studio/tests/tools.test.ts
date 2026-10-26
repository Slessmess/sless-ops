import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import ffmpegStatic from "ffmpeg-static"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  balanceOf,
  clearDatabase,
  createUser,
  installFakeHiggsfield,
  setupEnv,
  startDatabase,
  stopDatabase,
  type FakeHiggsfield,
} from "./support/harness"

setupEnv()
Object.assign(process.env, {
  ELEVENLABS_API_KEY: "el-test-key",
  ELEVENLABS_API_BASE_URL: "https://el.test",
  AUPHONIC_API_KEY: "aup-test-key",
  AUPHONIC_API_BASE_URL: "https://auphonic.test",
})

const {
  cleanupChain,
  declipChain,
  preIsolationChain,
  restoredChain,
  strengthOf,
  CLIPPED_SHARE,
} = await import("@/lib/tools/audio-filters")
const { studioVoiceAlgorithms } = await import("@/lib/tools/auphonic")
const { parseMediaInfo, profileFromHistogram } =
  await import("@/lib/tools/ffmpeg")

/* ── Pure pieces ─────────────────────────────────────────────────────────── */

describe("audio filter chains", () => {
  it("de-clips only when the analysis finds clipping", () => {
    expect(declipChain(null)).toEqual([])
    expect(declipChain({ top: 0.7, share: 0.0004 })).toEqual([])
    expect(declipChain({ top: 0.99, share: 0.015 })).toEqual([
      "asoftclip=type=hard:threshold=0.8910",
      "adeclip=t=1",
    ])
    // AAC overshoot above full scale still re-clips just under it.
    expect(declipChain({ top: 1.2, share: 0.06 })[0]).toBe(
      "asoftclip=type=hard:threshold=0.9900"
    )
    expect(CLIPPED_SHARE).toBeGreaterThan(0.0004)
  })

  it("builds the repair chain per strength, ending at -16 LUFS", () => {
    const clip = { top: 0.99, share: 0.02 }
    const standard = cleanupChain("standard", { clip })
    expect(standard.split(",")).toEqual([
      "aresample=out_chlayout=mono:rematrix_maxval=1",
      "aformat=channel_layouts=mono",
      "asoftclip=type=hard:threshold=0.8910",
      "adeclip=t=1",
      "highpass=f=80",
      "lowpass=f=14000",
      "loudnorm=I=-16:TP=-1.5:LRA=20",
      "aresample=48000",
    ])
    expect(cleanupChain("strong", { clip })).toContain("afftdn=")
    expect(cleanupChain("light")).not.toContain("lowpass")
    expect(cleanupChain("standard")).not.toContain("adeclip")
  })

  it("finishes isolated audio without de-clipping or denoising again", () => {
    const after = cleanupChain("strong", {
      clip: { top: 1, share: 0.1 },
      afterIsolation: true,
    })
    expect(after).not.toContain("adeclip")
    expect(after).not.toContain("afftdn")
    expect(after).toContain("loudnorm")
    expect(preIsolationChain(null)).toBe(
      "aresample=out_chlayout=mono:rematrix_maxval=1,aformat=channel_layouts=mono"
    )
  })

  it("asks Auphonic for Studio Voice at every strength, with more denoising as it goes up", () => {
    for (const strength of ["light", "standard", "strong"] as const)
      expect(studioVoiceAlgorithms(strength)).toMatchObject({
        filtering: true,
        filtermethod: "studiovoice",
        normloudness: false,
      })
    expect(studioVoiceAlgorithms("light").denoise).toBe(false)
    expect(studioVoiceAlgorithms("standard")).toMatchObject({
      denoise: true,
      denoisemethod: "dynamic",
    })
    expect(studioVoiceAlgorithms("strong")).toMatchObject({
      denoise: true,
      denoisemethod: "speech_isolation",
    })
    // Restored audio keeps its rebuilt highs: only mono and loudness after.
    expect(restoredChain()).toContain("loudnorm=I=-16")
    expect(restoredChain()).not.toContain("lowpass")
    expect(restoredChain()).not.toContain("adeclip")
  })

  it("reads strength defensively", () => {
    expect(strengthOf("strong")).toBe("strong")
    expect(strengthOf("bogus")).toBe("standard")
  })

  it("profiles a histogram: clean speech vs a clipped plateau", () => {
    const bins = 8192
    // Speech amplitudes fall off steeply: few samples near the loudest peak.
    const clean = new Float64Array(bins)
    for (let bin = 0; bin < 3000; bin++)
      clean[bin] = Math.round(1e6 * Math.exp(-bin / 250))
    const total = clean.reduce((sum, n) => sum + n, 0)
    const profile = profileFromHistogram(clean, total)!
    expect(profile.share).toBeLessThan(CLIPPED_SHARE)

    // The same speech overdriven: everything loud piles up just under 1.0.
    const clipped = new Float64Array(bins)
    for (let bin = 0; bin < 3900; bin++)
      clipped[bin] = Math.round(1e6 * Math.exp(-bin / 900))
    for (let bin = 3900; bin < 4060; bin++) clipped[bin] = 40_000
    const clippedTotal = clipped.reduce((sum, n) => sum + n, 0)
    const result = profileFromHistogram(clipped, clippedTotal)!
    expect(result.top).toBeGreaterThan(0.98)
    expect(result.share).toBeGreaterThan(CLIPPED_SHARE)
    expect(profileFromHistogram(new Float64Array(bins), 0)).toBeNull()
  })

  it("parses ffmpeg's banner, including rotated phone video", () => {
    const log = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'in.mp4':
  Duration: 00:01:02.50, start: 0.000000, bitrate: 2000 kb/s
  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1920x1080, 30 fps
      Side data:
        displaymatrix: rotation of -90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC), 48000 Hz, stereo, fltp`
    expect(parseMediaInfo(log)).toEqual({
      durationSec: 62.5,
      width: 1080,
      height: 1920,
      hasVideo: true,
      hasAudio: true,
    })
    expect(parseMediaInfo("  Stream #0:0: Video: h264, 640x360").hasAudio).toBe(
      false
    )
  })
})

/* ── End to end: submit → job → ffmpeg → storage → finalize → billing ───── */

const ffmpeg = process.env.FFMPEG_PATH ?? ffmpegStatic
const haveFfmpeg = Boolean(ffmpeg && existsSync(ffmpeg))

const { submitGeneration } = await import("@/lib/generations/submit")
const { cancelGeneration } = await import("@/lib/generations/cancel")
const { finalizeGeneration } = await import("@/lib/generations/finalize")
const { generationStatuses } = await import("@/lib/generations/library")
const { runToolJobs } = await import("@/lib/tools/jobs")
const { runAudioCleanup } = await import("@/lib/tools/audio-cleanup")
const { restoreVoice } = await import("@/lib/tools/auphonic")
const { isolateVoice } = await import("@/lib/tools/elevenlabs")

/** The real pipeline, polling the fake Auphonic every 10 ms instead of 5 s. */
const fastRunner: Parameters<typeof runToolJobs>[0] = {
  runner: (job) =>
    runAudioCleanup(job, {
      isolate: isolateVoice,
      restore: (from, to, strength) =>
        restoreVoice(from, to, strength, { pollMs: 10 }),
      fetch: globalThis.fetch,
    }),
}

type AuphonicCall = { method: string; path: string; auth: string | null }
const { collections } = await import("@/lib/db/collections")
const { localPathFor } = await import("@/lib/storage")
const { ObjectId } = await import("mongodb")

describe.skipIf(!haveFfmpeg)("Audio Cleanup jobs", () => {
  let fake: FakeHiggsfield
  let dir = ""
  let clippedClip: Uint8Array<ArrayBuffer>
  let silentClip: Uint8Array<ArrayBuffer>
  let isolatorCalls = 0
  let auphonic: {
    calls: AuphonicCall[]
    created: Record<string, unknown>[]
    uploaded?: Blob
    statusChecks: number
    fail: boolean
  }

  beforeAll(async () => {
    await startDatabase()
    dir = mkdtempSync(join(tmpdir(), "sless-tools-"))
    const run = (args: string[]) =>
      execFileSync(ffmpeg!, ["-hide_banner", "-loglevel", "error", ...args])
    // 4 s: a tone plus noise, overdriven so the AAC track is clipped.
    run([
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=15:duration=4",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=4,volume=4",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=pink:amplitude=0.2:duration=4",
      "-filter_complex",
      "[1:a][2:a]amix=inputs=2:normalize=0,aformat=sample_fmts=s16[a]",
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      "-y",
      join(dir, "clipped.mp4"),
    ])
    run([
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=15:duration=2",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-y",
      join(dir, "silent.mp4"),
    ])
    clippedClip = new Uint8Array(readFileSync(join(dir, "clipped.mp4")))
    silentClip = new Uint8Array(readFileSync(join(dir, "silent.mp4")))
  }, 120_000)
  afterAll(stopDatabase)
  beforeEach(async () => {
    await clearDatabase()
    fake = await installFakeHiggsfield()
    isolatorCalls = 0
    auphonic = { calls: [], created: [], statusChecks: 0, fail: false }
    // The fake platform also stands in for ElevenLabs (echo the audio back)
    // and Auphonic (a production that finishes on the second status check).
    const platformFetch = fake.fetch
    vi.stubGlobal("fetch", (async (input, init) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.startsWith("https://auphonic.test/")) {
        const method = init?.method ?? "GET"
        const path = new URL(url).pathname
        auphonic.calls.push({
          method,
          path,
          auth: new Headers(init?.headers).get("authorization"),
        })
        const ok = (data: unknown) =>
          Response.json({ status_code: 200, error_message: "", data })
        if (path === "/api/productions.json") {
          auphonic.created.push(JSON.parse(String(init?.body)))
          return ok({ uuid: "prod1" })
        }
        if (path === "/api/production/prod1/upload.json") {
          auphonic.uploaded = (init?.body as FormData).get("input_file") as Blob
          return ok({ uuid: "prod1" })
        }
        if (path === "/api/production/prod1/start.json") return ok({})
        if (path === "/api/production/prod1/status.json") {
          auphonic.statusChecks++
          if (auphonic.fail) return ok({ status: 2, status_string: "Error" })
          return ok(
            auphonic.statusChecks < 2
              ? { status: 4, status_string: "Audio Processing" }
              : { status: 3, status_string: "Done" }
          )
        }
        if (path === "/api/production/prod1.json" && method === "GET")
          return ok({
            uuid: "prod1",
            error_message: auphonic.fail ? "Unsupported audio" : "",
            output_files: [
              {
                format: "flac",
                download_url:
                  "https://auphonic.test/api/download/audio-result/prod1/out.flac",
              },
            ],
          })
        if (path === "/api/download/audio-result/prod1/out.flac")
          return new Response(await auphonic.uploaded!.arrayBuffer(), {
            headers: { "content-type": "audio/flac" },
          })
        if (path === "/api/production/prod1.json" && method === "DELETE")
          return ok({})
        return new Response("not found", { status: 404 })
      }
      if (url === "https://el.test/v1/audio-isolation") {
        isolatorCalls++
        expect(new Headers(init?.headers).get("xi-api-key")).toBe("el-test-key")
        const audio = (init?.body as FormData).get("audio") as Blob
        return new Response(await audio.arrayBuffer(), {
          headers: { "content-type": "audio/flac" },
        })
      }
      return platformFetch(input, init)
    }) as typeof fetch)
  })

  async function uploadFor(
    userId: InstanceType<typeof ObjectId>,
    clip: Uint8Array<ArrayBuffer>,
    seconds: number
  ) {
    const { uploads } = await collections()
    const url = `https://cdn.hf.test/uploads/${randomUUID()}.mp4`
    fake.cdn.set(url, { body: clip, type: "video/mp4" })
    await uploads.insertOne({
      _id: new ObjectId(),
      userId,
      kind: "video",
      url,
      platformUrl: url,
      contentType: "video/mp4",
      bytes: clip.byteLength,
      durationSec: seconds,
      name: "match.mp4",
      createdAt: new Date(),
    })
    return url
  }

  const cleanup = (url: string, settings: Record<string, unknown> = {}) => ({
    submitKey: randomUUID(),
    modelId: "audio-cleanup",
    prompt: "",
    settings,
    media: [{ role: "source" as const, url }],
  })

  it("repairs the sound on our servers, never on the platform, for 1 credit", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 4)
    const view = await submitGeneration(user, cleanup(url))
    expect(view.cost).toBe(1)
    expect(view.status).toBe("queued")
    expect(fake.submits).toHaveLength(0)

    expect(await runToolJobs()).toBe(1)
    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("completed")
    const output = done!.outputs[0]!
    expect(output.kind).toBe("video")
    expect(output.durationSec).toBeGreaterThan(3.5)
    expect(output.width).toBe(320)
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 99,
    })

    // The stored file keeps the picture and carries the repaired AAC track.
    const { generations } = await collections()
    const doc = await generations.findOne({ _id: new ObjectId(view.id) })
    const file = localPathFor(doc!.outputs[0]!.key)
    const banner = execFileSync(
      ffmpeg!,
      ["-hide_banner", "-i", file, "-f", "null", "-"],
      {
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
      }
    )
    expect(banner).toBeDefined()
  }, 60_000)

  it("runs AI voice isolation and bills it per second of video", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 4)
    const view = await submitGeneration(
      user,
      cleanup(url, { cleanup: "isolate" })
    )
    // 4 s × $0.002 × 2 / $0.01 = 1.6, plus the 1-credit repair pass → 3.
    expect(view.cost).toBe(3)
    await runToolJobs()
    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("completed")
    expect(isolatorCalls).toBe(1)
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 97,
    })
  }, 60_000)

  it("fixes distorted voices with Auphonic Studio Voice, billed per second plus its minimum", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 4)
    const view = await submitGeneration(
      user,
      cleanup(url, { cleanup: "restore", strength: "strong" })
    )
    // ($0.11 + 4 s × $0.0006) × 2 / $0.01 = 22.5 → 23 credits.
    expect(view.cost).toBe(23)
    expect(fake.submits).toHaveLength(0)
    expect(await runToolJobs(fastRunner)).toBe(1)

    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("completed")
    expect(done!.outputs[0]!.width).toBe(320)
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 77,
    })
    // Create → upload → start → poll until Done → details → download → delete,
    // every call with our key.
    expect(auphonic.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /api/productions.json",
      "POST /api/production/prod1/upload.json",
      "POST /api/production/prod1/start.json",
      "GET /api/production/prod1/status.json",
      "GET /api/production/prod1/status.json",
      "GET /api/production/prod1.json",
      "GET /api/download/audio-result/prod1/out.flac",
      "DELETE /api/production/prod1.json",
    ])
    expect(new Set(auphonic.calls.map((c) => c.auth))).toEqual(
      new Set(["bearer aup-test-key"])
    )
    expect(auphonic.created[0]).toMatchObject({
      algorithms: {
        filtermethod: "studiovoice",
        denoisemethod: "speech_isolation",
      },
      output_files: [{ format: "flac" }],
    })
    // The model gets the sound as recorded: lossless, not pre-filtered.
    const head = new Uint8Array(await auphonic.uploaded!.arrayBuffer()).slice(
      0,
      4
    )
    expect(new TextDecoder().decode(head)).toBe("fLaC")
  }, 60_000)

  it("refunds a failed Auphonic production and still deletes it", async () => {
    auphonic.fail = true
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 4)
    const view = await submitGeneration(
      user,
      cleanup(url, { cleanup: "restore" })
    )
    await runToolJobs(fastRunner)
    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("failed")
    expect(done!.error).toContain("couldn't read this video's sound")
    expect(auphonic.calls.at(-1)).toMatchObject({
      method: "DELETE",
      path: "/api/production/prod1.json",
    })
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 100,
    })
  }, 60_000)

  it("refunds a video with no sound, with a clear message", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, silentClip, 2)
    const view = await submitGeneration(user, cleanup(url))
    await runToolJobs()
    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("failed")
    expect(done!.error).toContain("no sound track")
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 100,
    })
  }, 60_000)

  it("rejects clips over five minutes before charging", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 301)
    await expect(submitGeneration(user, cleanup(url))).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 100,
    })
  })

  it("cancels a job that hasn't started and refunds it", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 4)
    const view = await submitGeneration(user, cleanup(url))
    await cancelGeneration(user.objectId, new ObjectId(view.id))
    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("canceled")
    expect(await runToolJobs()).toBe(0)
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 100,
    })
  })

  it("fails and refunds a job whose worker died twice", async () => {
    const user = await createUser({ topup: 100 })
    const url = await uploadFor(user.objectId, clippedClip, 4)
    const view = await submitGeneration(user, cleanup(url))
    const { toolJobs } = await collections()
    await toolJobs.updateOne(
      { generationId: new ObjectId(view.id) },
      {
        $set: {
          status: "in_progress",
          attempts: 2,
          leaseUntil: new Date(Date.now() - 1000),
        },
      }
    )
    expect(await runToolJobs()).toBe(0)
    await finalizeGeneration(new ObjectId(view.id))
    const [done] = await generationStatuses(user.objectId, [view.id])
    expect(done!.status).toBe("failed")
    expect(await balanceOf(user.objectId)).toEqual({
      subscription: 0,
      topup: 100,
    })
  })

  it("hides AI isolation when no ElevenLabs key is set", async () => {
    const { resetEnvForTests } = await import("@/lib/env")
    const { invalidatePricing } = await import("@/lib/billing/pricing")
    const key = process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    resetEnvForTests()
    invalidatePricing()
    try {
      const user = await createUser({ topup: 100 })
      const url = await uploadFor(user.objectId, clippedClip, 4)
      await expect(
        submitGeneration(user, cleanup(url, { cleanup: "isolate" }))
      ).rejects.toMatchObject({ code: "UNPRICED" })
      expect(await balanceOf(user.objectId)).toEqual({
        subscription: 0,
        topup: 100,
      })
    } finally {
      process.env.ELEVENLABS_API_KEY = key
      resetEnvForTests()
      invalidatePricing()
    }
  })

  it("hides Fix distorted voices when no Auphonic key is set", async () => {
    const { resetEnvForTests } = await import("@/lib/env")
    const { invalidatePricing } = await import("@/lib/billing/pricing")
    const key = process.env.AUPHONIC_API_KEY
    delete process.env.AUPHONIC_API_KEY
    resetEnvForTests()
    invalidatePricing()
    try {
      const user = await createUser({ topup: 100 })
      const url = await uploadFor(user.objectId, clippedClip, 4)
      await expect(
        submitGeneration(user, cleanup(url, { cleanup: "restore" }))
      ).rejects.toMatchObject({ code: "UNPRICED" })
      // The free repair still works.
      await expect(submitGeneration(user, cleanup(url))).resolves.toMatchObject(
        { cost: 1 }
      )
    } finally {
      process.env.AUPHONIC_API_KEY = key
      resetEnvForTests()
      invalidatePricing()
    }
  })
})
