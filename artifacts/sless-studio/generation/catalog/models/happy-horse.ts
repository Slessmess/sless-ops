// Happy Horse 1.0 and 1.1 — text / image / reference to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/happy-horse-1
//   https://docs.higgsfield.ai/docs/models/happy-horse-1/text-to-video
//   https://docs.higgsfield.ai/docs/models/happy-horse-1/image-to-video
//   https://docs.higgsfield.ai/docs/models/happy-horse-1/reference-to-video
//   https://docs.higgsfield.ai/docs/models/happy-horse-1-1
//   https://docs.higgsfield.ai/docs/models/happy-horse-1-1/text-to-video
//   https://docs.higgsfield.ai/docs/models/happy-horse-1-1/image-to-video
//   https://docs.higgsfield.ai/docs/models/happy-horse-1-1/reference-to-video
// Text-to-video takes 3–15 s and image/reference 2–15 s, so the entry offers
// 3–15 s. aspect_ratio exists on text-to-video only; the image endpoint has no
// last frame. The prompt is optional only with a start frame. Not exposed: seed.
import {
  assertFramesOrReferences,
  compact,
  first,
  promptText,
  requirePrompt,
  urls,
} from "../mappers"
import { WAN_ASPECT } from "../tokens"
import type { GenerationPlane, ModelEntry, PlatformRequest } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models"

function settings(resolution: "720p" | "1080p"): ModelEntry["settings"] {
  return {
    aspectRatio: {
      type: "enum",
      values: WAN_ASPECT,
      default: "16:9",
      label: "Aspect ratio",
      hint: "Text only; images set the framing.",
    },
    duration: {
      type: "range",
      min: 3,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    resolution: {
      type: "enum",
      values: ["720p", "1080p"],
      default: resolution,
      label: "Resolution",
    },
  }
}

function mapHappyHorse(
  plane: GenerationPlane,
  prefix: string,
  label: string
): PlatformRequest {
  assertFramesOrReferences(plane)
  const start = first(plane, "start")
  const refs = urls(plane, "reference")
  const shared = {
    duration: plane.settings.duration,
    resolution: plane.settings.resolution,
  }
  if (start)
    return {
      path: `${prefix}/image-to-video`,
      body: compact({ ...shared, prompt: promptText(plane), image_url: start }),
    }
  const prompt = requirePrompt(plane, label)
  if (refs.length)
    return {
      path: `${prefix}/reference-to-video`,
      body: compact({ ...shared, prompt, image_urls: refs }),
    }
  return {
    path: `${prefix}/text-to-video`,
    body: compact({
      ...shared,
      prompt,
      aspect_ratio: plane.settings.aspectRatio,
    }),
  }
}

const meta = {
  surface: "video",
  family: "Happy Horse",
  provider: "Alibaba",
  icon: "happy-horse",
  roles: { start: 1, reference: 9 },
  mediaModes: [
    { id: "frames", label: "Start frame", roles: { start: 1 } },
    {
      id: "references",
      label: "References",
      roles: { reference: 9 },
      requireAny: true,
    },
  ],
} satisfies Partial<ModelEntry>

export const happyHorse11: ModelEntry = {
  ...meta,
  id: "happy-horse-1.1",
  label: "Happy Horse 1.1",
  description:
    "The refreshed Happy Horse: lively 3–15 s clips in 1080p from text, a start frame or up to 9 references.",
  bestFor: "Playful, energetic clips from references",
  badges: ["NEW"],
  category: "GENERAL",
  settings: settings("1080p"),
  order: 200,
  docs: [
    `${DOCS}/happy-horse-1-1`,
    `${DOCS}/happy-horse-1-1/text-to-video`,
    `${DOCS}/happy-horse-1-1/image-to-video`,
    `${DOCS}/happy-horse-1-1/reference-to-video`,
  ],
  toPlatform: (plane) =>
    mapHappyHorse(plane, "alibaba/happy-horse/v1.1", "Happy Horse 1.1"),
}

export const happyHorse1: ModelEntry = {
  ...meta,
  id: "happy-horse-1",
  label: "Happy Horse 1.0",
  description:
    "The first Happy Horse release for quick clips from text, one start frame or a handful of reference images.",
  bestFor: "Affordable reference-to-video",
  category: "GENERAL",
  settings: settings("720p"),
  order: 201,
  docs: [
    `${DOCS}/happy-horse-1`,
    `${DOCS}/happy-horse-1/text-to-video`,
    `${DOCS}/happy-horse-1/image-to-video`,
    `${DOCS}/happy-horse-1/reference-to-video`,
  ],
  toPlatform: (plane) =>
    mapHappyHorse(plane, "alibaba/happy-horse", "Happy Horse 1.0"),
}

const models = [happyHorse11, happyHorse1]
export default models
