// Kling 2.6 — Pro text and image to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-2-6
//   https://docs.higgsfield.ai/docs/models/kling-2-6/pro-text-to-video
//   https://docs.higgsfield.ai/docs/models/kling-2-6/pro-image-to-video
// Both workflows document aspect_ratio, sound (on/off), cfg_scale and a 5 / 10 s
// duration.
import { compact, first, int, onOff, requirePrompt } from "../mappers"
import { KLING_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-2-6"

const kling26: ModelEntry = {
  id: "kling-2.6",
  surface: "video",
  family: "Kling",
  provider: "Kuaishou",
  icon: "kling",
  label: "Kling 2.6",
  description:
    "Physics-aware Kling motion with native sound, from a prompt or a start frame in 5 or 10 s clips.",
  bestFor: "Believable physical motion with sound",
  badges: ["AUDIO"],
  category: "CINEMATIC",
  roles: { start: 1 },
  requirePrompt: true,
  settings: {
    aspectRatio: {
      type: "enum",
      values: KLING_ASPECT,
      default: "16:9",
      label: "Aspect ratio",
    },
    duration: {
      type: "enum",
      values: ["5", "10"],
      default: "5",
      label: "Duration",
      labels: { "5": "5s", "10": "10s" },
    },
    generateAudio: {
      type: "boolean",
      default: true,
      label: "Generate audio",
      hint: "Native dialogue, music and effects.",
    },
    cfgScale: {
      type: "range",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.5,
      label: "Prompt adherence",
      hint: "Higher follows the prompt more literally.",
    },
  },
  order: 160,
  docs: [DOCS, `${DOCS}/pro-text-to-video`, `${DOCS}/pro-image-to-video`],
  toPlatform: (plane) => {
    const start = first(plane, "start")
    const body = compact({
      prompt: requirePrompt(plane, "Kling 2.6"),
      duration: int(plane.settings.duration),
      aspect_ratio: plane.settings.aspectRatio,
      sound: onOff(plane.settings.generateAudio),
      cfg_scale: plane.settings.cfgScale,
    })
    if (start)
      return {
        path: "kling-video/v2.6/pro/image-to-video",
        body: { ...body, image_url: start },
      }
    return { path: "kling-video/v2.6/pro/text-to-video", body }
  },
}

export default kling26
