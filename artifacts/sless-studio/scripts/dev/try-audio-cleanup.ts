/**
 * Run Audio Cleanup on a local file without the app (for tuning the filters).
 *   pnpm exec tsx --conditions=react-server scripts/dev/try-audio-cleanup.ts \
 *     input.mp4 [repair|restore|isolate] [light|standard|strong]
 * The result lands in .data/media (or LOCAL_MEDIA_DIR). The AI modes call
 * Auphonic (restore) or ElevenLabs (isolate) when AUPHONIC_API_KEY /
 * ELEVENLABS_API_KEY is set, and otherwise pass the audio through unchanged.
 */
import { copyFile, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const [input, mode = "repair", strength = "standard"] = process.argv.slice(2)
if (!input) {
  console.error(
    "usage: try-audio-cleanup.ts input.mp4 [repair|restore|isolate] [strength]"
  )
  process.exit(1)
}
const { runAudioCleanup } = await import("../../lib/tools/audio-cleanup")
const { isolateVoice } = await import("../../lib/tools/elevenlabs")
const { restoreVoice } = await import("../../lib/tools/auphonic")
const { AUDIO_CLEANUP_PATHS } =
  await import("../../generation/catalog/models/audio-cleanup")

const path =
  mode === "isolate" || mode === "restore"
    ? AUDIO_CLEANUP_PATHS[mode]
    : AUDIO_CLEANUP_PATHS.repair
const passthrough = async (from: string, to: string) => copyFile(from, to)
const file = resolve(input)
const started = Date.now()
const result = await runAudioCleanup(
  {
    path,
    body: { video_url: `file://${file}`, strength },
    keyBase: `try/${mode}-${strength}-${Date.now()}`,
  },
  {
    fetch: (async () => new Response(await readFile(file))) as typeof fetch,
    isolate: process.env.ELEVENLABS_API_KEY ? isolateVoice : passthrough,
    restore: process.env.AUPHONIC_API_KEY ? restoreVoice : passthrough,
  }
)
console.log(
  JSON.stringify({ ...result, seconds: (Date.now() - started) / 1000 }, null, 2)
)
