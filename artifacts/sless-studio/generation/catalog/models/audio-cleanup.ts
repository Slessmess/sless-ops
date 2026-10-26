// Audio Cleanup — a Sless Studio tool, run on our own servers (lib/tools),
// not on Higgsfield. It cleans up the sound track of a video the user uploads:
//   • Fix distorted voices (AI): Auphonic Studio Voice rebuilds speech that
//     crackles or breaks up because the mic was overloaded — distortion baked
//     into the voice, which no filter can take out
//     (https://auphonic.com/help/algorithms/singletrack.html).
//   • Remove background noise (AI): ElevenLabs Voice Isolator
//     (POST /v1/audio-isolation) strips crowd and music and keeps speech.
//   • Quick repair: FFmpeg filters — rebuilds flat-topped (hard-clipped)
//     peaks, cuts rumble and hiss and sets a steady volume
//     (https://ffmpeg.org/ffmpeg-filters.html). It can't undo heavy distortion.
// The picture is copied untouched; the output is an MP4 as long as the input.
import { first } from "../mappers"
import type { ModelEntry } from "../types"

/**
 * Longest clip we process in one run (also the provisional billing cap).
 * Rebuilding heavily clipped sound runs at about real time on one CPU, and a
 * serverless function gets 800 s, so five minutes leaves a safe margin.
 */
export const AUDIO_CLEANUP_MAX_SECONDS = 300

export const AUDIO_CLEANUP_PATHS = {
  repair: "sless/audio-cleanup/repair",
  restore: "sless/audio-cleanup/restore",
  isolate: "sless/audio-cleanup/isolate",
} as const

export type AudioCleanupMode = keyof typeof AUDIO_CLEANUP_PATHS

function modeOf(value: unknown): AudioCleanupMode {
  return value === "restore" || value === "isolate" ? value : "repair"
}

export const audioCleanup: ModelEntry = {
  id: "audio-cleanup",
  surface: "video",
  tab: "edit",
  runner: "local",
  noPrompt: true,
  label: "Audio Cleanup",
  family: "Sless Tools",
  provider: "Sless Studio",
  icon: "sless-audio",
  description:
    "Makes speech in your video easy to understand. Fix distorted voices uses AI to rebuild voices that crackle or break up because the mic was set too loud. Remove background noise strips crowd and music. The picture stays exactly as it is.",
  bestFor: "Voices that are distorted, buried or hard to make out",
  badges: ["NEW", "AUDIO"],
  category: "AUDIO",
  order: 303,
  roles: { source: 1 },
  requiredRoles: ["source"],
  roleLabels: { source: "Video with sound" },
  roleHints: { source: "MP4 · up to 5 min" },
  settings: {
    cleanup: {
      type: "enum",
      values: ["repair", "restore", "isolate"],
      default: "repair",
      labels: {
        repair: "Quick repair",
        restore: "Fix distorted voices (AI)",
        isolate: "Remove background noise (AI)",
      },
      label: "Cleanup",
      hint: "Fix distorted voices rebuilds speech that crackles or breaks up because the mic was too loud. Remove background noise strips crowd and music. Quick repair only evens out the volume, hiss and light clipping.",
    },
    strength: {
      type: "enum",
      values: ["light", "standard", "strong"],
      default: "standard",
      labels: { light: "Light", standard: "Standard", strong: "Strong" },
      label: "Strength",
      hint: "How much background to take out. Strong keeps only the voice; it can sound a little processed.",
    },
  },
  optionPaths: { cleanup: { ...AUDIO_CLEANUP_PATHS } },
  docs: [
    "https://auphonic.com/help/api/details.html",
    "https://elevenlabs.io/docs/api-reference/audio-isolation/convert",
    "https://ffmpeg.org/ffmpeg-filters.html#adeclip",
  ],
  toPlatform: (plane) => {
    const video = first(plane, "source")
    if (!video) throw new Error("Add the video you want to clean up.")
    const seconds = plane.media.source?.[0]?.durationSec
    if (seconds && seconds > AUDIO_CLEANUP_MAX_SECONDS)
      throw new Error(
        `Audio Cleanup works on clips up to ${AUDIO_CLEANUP_MAX_SECONDS / 60} minutes. Trim the video and try again.`
      )
    const strength =
      plane.settings.strength === "light" ||
      plane.settings.strength === "strong"
        ? plane.settings.strength
        : "standard"
    return {
      path: AUDIO_CLEANUP_PATHS[modeOf(plane.settings.cleanup)],
      body: { video_url: video, strength },
    }
  },
}

const models = [audioCleanup]
export default models
