// Kling 3.0 — Standard, Pro, 4K and Turbo, text and image to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-3
//   https://docs.higgsfield.ai/docs/models/kling-3/standard-text-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/standard-image-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/pro-text-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/pro-image-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/4k-text-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/4k-image-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/turbo-text-to-video
//   https://docs.higgsfield.ai/docs/models/kling-3/turbo-image-to-video
// Image-to-video has no aspect_ratio (framing follows the start frame). Turbo
// has no sound, cfg_scale, multi_shots or last frame. Not exposed: elements,
// multi_prompt. The docs ask for a non-empty prompt within 2,500 characters
// (longer prompts are truncated), so both are enforced here.
import {
  assertFramesOrReferences,
  compact,
  first,
  onOff,
  requirePrompt,
} from "../mappers"
import { KLING_ASPECT } from "../tokens"
import type { GenerationPlane, ModelEntry, PlatformRequest } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-3"

const meta = {
  surface: "video",
  family: "Kling",
  provider: "Kuaishou",
  icon: "kling",
  requirePrompt: true,
  maxPromptLength: 2500,
} as const

const aspectRatio = {
  type: "enum",
  values: KLING_ASPECT,
  default: "16:9",
  label: "Aspect ratio",
  hint: "A start frame sets the framing instead.",
} as const satisfies ModelEntry["settings"][string]

const duration = {
  type: "range",
  min: 3,
  max: 15,
  default: 5,
  unit: "s",
  label: "Duration",
} as const satisfies ModelEntry["settings"][string]

const tierSettings = {
  aspectRatio,
  duration,
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
  multiShots: {
    type: "boolean",
    default: false,
    label: "Multi-shot",
    hint: "Lets the model cut between several shots.",
  },
} as const satisfies ModelEntry["settings"]

function mapTier(plane: GenerationPlane, tier: string): PlatformRequest {
  assertFramesOrReferences(plane)
  const start = first(plane, "start")
  const shared = {
    prompt: requirePrompt(plane, "Kling 3.0"),
    duration: plane.settings.duration,
    sound: onOff(plane.settings.generateAudio),
    cfg_scale: plane.settings.cfgScale,
    multi_shots: plane.settings.multiShots,
  }
  if (start)
    return {
      path: `kling-video/v3.0/${tier}/image-to-video`,
      body: compact({
        ...shared,
        image_url: start,
        last_image_url: first(plane, "end"),
      }),
    }
  return {
    path: `kling-video/v3.0/${tier}/text-to-video`,
    body: compact({ ...shared, aspect_ratio: plane.settings.aspectRatio }),
  }
}

function tierDocs(tier: string): string[] {
  return [
    DOCS,
    `${DOCS}/${tier}-text-to-video`,
    `${DOCS}/${tier}-image-to-video`,
  ]
}

export const kling3Std: ModelEntry = {
  ...meta,
  id: "kling-3-std",
  label: "Kling 3.0",
  description:
    "Dependable, lower-cost motion for simple scenes, with native sound and optional start and end frames.",
  bestFor: "Straightforward shots on a budget",
  badges: ["AUDIO"],
  category: "GENERAL",
  roles: { start: 1, end: 1 },
  settings: tierSettings,
  order: 110,
  docs: tierDocs("standard"),
  toPlatform: (plane) => mapTier(plane, "std"),
}

export const kling3Pro: ModelEntry = {
  ...meta,
  id: "kling-3-pro",
  label: "Kling 3.0 Pro",
  description:
    "Kling 3.0 at higher fidelity: sharper detail and steadier motion, with sound and frame control.",
  bestFor: "Polished shots with native sound",
  badges: ["TOP", "PRO", "AUDIO"],
  category: "CINEMATIC",
  roles: { start: 1, end: 1 },
  settings: tierSettings,
  order: 111,
  docs: tierDocs("pro"),
  toPlatform: (plane) => mapTier(plane, "pro"),
}

export const kling34k: ModelEntry = {
  ...meta,
  id: "kling-3-4k",
  label: "Kling 3.0 4K",
  description:
    "The Kling 3.0 pipeline rendered at 4K for footage that holds up on big screens.",
  bestFor: "Deliverables that need 4K",
  badges: ["4K", "AUDIO"],
  category: "CINEMATIC",
  roles: { start: 1, end: 1 },
  settings: tierSettings,
  order: 112,
  docs: tierDocs("4k"),
  toPlatform: (plane) => mapTier(plane, "4k"),
}

export const kling3Turbo: ModelEntry = {
  ...meta,
  id: "kling-3-turbo",
  label: "Kling 3.0 Turbo",
  description:
    "A quick, cheaper Kling 3.0 for simple motion from a prompt or a single start frame.",
  bestFor: "Fast drafts and simple animation",
  badges: ["FAST"],
  category: "FAST",
  roles: { start: 1 },
  settings: {
    aspectRatio,
    duration,
    resolution: {
      type: "enum",
      values: ["720p", "1080p"],
      default: "720p",
      label: "Resolution",
    },
  },
  order: 113,
  docs: tierDocs("turbo"),
  toPlatform: (plane) => {
    const start = first(plane, "start")
    const shared = {
      prompt: requirePrompt(plane, "Kling 3.0 Turbo"),
      duration: plane.settings.duration,
      resolution: plane.settings.resolution,
    }
    if (start)
      return {
        path: "kling-video/v3.0-turbo/image-to-video",
        body: compact({ ...shared, image_url: start }),
      }
    return {
      path: "kling-video/v3.0-turbo/text-to-video",
      body: compact({ ...shared, aspect_ratio: plane.settings.aspectRatio }),
    }
  },
}

const models = [kling3Std, kling3Pro, kling34k, kling3Turbo]
export default models
