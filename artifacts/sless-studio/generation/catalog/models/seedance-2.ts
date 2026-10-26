// Seedance 2.0 — text / image / reference-to-video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/seedance-2
//   https://docs.higgsfield.ai/docs/models/seedance-2/text-to-video
//   https://docs.higgsfield.ai/docs/models/seedance-2/image-to-video
//   https://docs.higgsfield.ai/docs/models/seedance-2/reference-to-video
// Same body shape as Seedance 2.5 without bitrate_mode; references need at
// least one image or video (audio alone is rejected).
import { assertAnyOf, hasAny, mapSeedance } from "../mappers"
import { SEEDANCE_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/seedance-2"

const seedance2: ModelEntry = {
  id: "seedance-2",
  surface: "video",
  family: "Seedance",
  provider: "ByteDance",
  icon: "seedance",
  label: "Seedance 2.0",
  description:
    "The previous Seedance generation, still the pick when you need native 4K: 4–15 s from text, frames or references.",
  bestFor: "Native 4K shots with sound",
  badges: ["4K", "AUDIO"],
  category: "GENERAL",
  roles: { start: 1, end: 1, reference: 9, video: 3, audio: 3 },
  mediaModes: [
    { id: "frames", label: "Frames", roles: { start: 1, end: 1 } },
    {
      id: "references",
      label: "References",
      roles: { reference: 9, video: 3, audio: 3 },
      requireAnyOf: ["reference", "video"],
    },
  ],
  settings: {
    aspectRatio: {
      type: "enum",
      values: SEEDANCE_ASPECT,
      default: "16:9",
      label: "Aspect ratio",
      hint: "Frames follow the start image instead.",
    },
    duration: {
      type: "range",
      min: 4,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    resolution: {
      type: "enum",
      values: ["480p", "720p", "1080p", "4k"],
      default: "720p",
      label: "Resolution",
      labels: { "4k": "4K" },
    },
    generateAudio: {
      type: "boolean",
      default: true,
      label: "Generate audio",
      hint: "Native soundtrack and effects.",
    },
  },
  order: 103,
  docs: [
    DOCS,
    `${DOCS}/text-to-video`,
    `${DOCS}/image-to-video`,
    `${DOCS}/reference-to-video`,
  ],
  toPlatform: (plane) => {
    if (hasAny(plane, ["audio"]))
      assertAnyOf(
        plane,
        ["start", "reference", "video"],
        "Audio references need at least one image or video reference."
      )
    return mapSeedance(plane, "bytedance/seedance-2.0")
  },
}

export default seedance2
