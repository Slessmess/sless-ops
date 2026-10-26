// Seedance 2.5 — text / image / reference-to-video, edit and extend.
// Sources:
//   https://docs.higgsfield.ai/docs/models/seedance-2-5
//   https://docs.higgsfield.ai/docs/models/seedance-2-5/image-to-video
//   https://docs.higgsfield.ai/docs/models/seedance-2-5/reference-to-video
//   https://docs.higgsfield.ai/docs/models/seedance-2-5/video-edit
//   https://docs.higgsfield.ai/docs/models/seedance-2-5/video-extend
// Text-to-video body follows the template mapper, matching the fields its sibling pages document.
import { mapSeedance, mapSeedanceSource } from "../mappers"
import { SEEDANCE_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/seedance-2-5"

const shared = {
  resolution: {
    type: "enum",
    values: ["480p", "720p"],
    default: "720p",
    label: "Resolution",
  },
  generateAudio: {
    type: "boolean",
    default: true,
    label: "Generate audio",
    hint: "Native soundtrack and effects.",
  },
  bitrateMode: {
    type: "enum",
    values: ["standard", "high"],
    default: "high",
    label: "Bitrate",
    labels: { standard: "Standard", high: "High" },
  },
} as const satisfies ModelEntry["settings"]

const duration = {
  type: "range",
  min: 4,
  max: 30,
  default: 5,
  unit: "s",
  label: "Duration",
} as const satisfies ModelEntry["settings"][string]

const meta = {
  surface: "video",
  family: "Seedance",
  provider: "ByteDance",
  icon: "seedance",
} as const

export const seedance25: ModelEntry = {
  ...meta,
  id: "seedance-2.5",
  label: "Seedance 2.5",
  description:
    "Our most capable all-round video model: 4–30 s shots from text, frames or up to 50 references.",
  bestFor: "Cinematic, multi-reference production shots",
  badges: ["TOP", "NEW", "AUDIO"],
  category: "GENERAL",
  roles: { start: 1, end: 1, reference: 30, video: 10, audio: 10 },
  maxTotalMedia: 50,
  mediaModes: [
    { id: "frames", label: "Frames", roles: { start: 1, end: 1 } },
    {
      id: "references",
      label: "References",
      roles: { reference: 30, video: 10, audio: 10 },
      requireAny: true,
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
    duration,
    ...shared,
  },
  order: 100,
  docs: [DOCS, `${DOCS}/image-to-video`, `${DOCS}/reference-to-video`],
  toPlatform: (plane) => mapSeedance(plane, "bytedance/seedance-2.5"),
}

export const seedance25Edit: ModelEntry = {
  ...meta,
  id: "seedance-2.5-edit",
  label: "Seedance 2.5 Edit",
  tab: "edit",
  description:
    "Rewrite what happens in a clip — restyle, swap or add elements — while keeping its framing.",
  bestFor: "Changing an existing video with a prompt",
  badges: ["NEW"],
  category: "EDIT",
  // The source video counts toward the 10-video limit, so 9 extra video references.
  roles: { source: 1, video: 9, reference: 30, audio: 10 },
  requiredRoles: ["source"],
  requirePrompt: true,
  maxTotalMedia: 50,
  settings: shared,
  order: 101,
  docs: [`${DOCS}/video-edit`],
  toPlatform: (plane) =>
    mapSeedanceSource(plane, "bytedance/seedance-2.5/video-edit", false),
}

export const seedance25Extend: ModelEntry = {
  ...meta,
  id: "seedance-2.5-extend",
  label: "Seedance 2.5 Extend",
  tab: "edit",
  description:
    "Continue a clip for up to 30 more seconds, directed by a prompt.",
  bestFor: "Making a shot longer",
  badges: ["NEW"],
  category: "EXTEND",
  roles: { source: 1, video: 9, reference: 30, audio: 10 },
  requiredRoles: ["source"],
  requirePrompt: true,
  maxTotalMedia: 50,
  settings: { duration, ...shared },
  order: 102,
  docs: [`${DOCS}/video-extend`],
  toPlatform: (plane) =>
    mapSeedanceSource(plane, "bytedance/seedance-2.5/video-extend", true),
}

const models = [seedance25, seedance25Edit, seedance25Extend]
export default models
