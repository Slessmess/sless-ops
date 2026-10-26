// Kling Omni — first/last frame, image reference, video edit, video reference.
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-omni
//   https://docs.higgsfield.ai/docs/models/kling-omni/first-last-frame
//   https://docs.higgsfield.ai/docs/models/kling-omni/image-reference
//   https://docs.higgsfield.ai/docs/models/kling-omni/video-edit
//   https://docs.higgsfield.ai/docs/models/kling-omni/video-reference
// Frames → first-last-frame (first_frame_url required, duration 5 or 10);
// image references (or text alone) → image-reference (duration 3–10). The
// entry offers 5 / 10 s, valid on both. The docs set no image_urls maximum on
// image-reference; 7 is our UI cap. Not exposed: elements.
import {
  assertFramesOrReferences,
  compact,
  first,
  int,
  requirePrompt,
  urls,
} from "../mappers"
import { KLING_ASPECT } from "../tokens"
import type { ModelEntry, SettingField } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-omni"

const meta = {
  surface: "video",
  family: "Kling",
  provider: "Kuaishou",
  icon: "kling",
  requirePrompt: true,
  maxPromptLength: 2500,
} as const

const mode = {
  type: "enum",
  values: ["std", "pro"],
  default: "pro",
  label: "Mode",
  labels: { std: "Standard", pro: "Pro" },
} as const satisfies SettingField

const aspectRatio = {
  type: "enum",
  values: KLING_ASPECT,
  default: "16:9",
  label: "Aspect ratio",
} as const satisfies SettingField

export const klingOmni: ModelEntry = {
  ...meta,
  id: "kling-omni",
  label: "Kling Omni",
  description:
    "Kling's first unified model: build a shot from a start frame (and optional end frame) or a set of reference images.",
  bestFor: "Reference-driven shots at a lower price",
  category: "GENERAL",
  roles: { start: 1, end: 1, reference: 7 },
  mediaModes: [
    { id: "frames", label: "Frames", roles: { start: 1, end: 1 } },
    { id: "references", label: "References", roles: { reference: 7 } },
  ],
  settings: {
    aspectRatio,
    duration: {
      type: "enum",
      values: ["5", "10"],
      default: "5",
      label: "Duration",
      labels: { "5": "5s", "10": "10s" },
    },
    mode,
  },
  order: 150,
  docs: [DOCS, `${DOCS}/first-last-frame`, `${DOCS}/image-reference`],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane)
    const start = first(plane, "start")
    const refs = urls(plane, "reference")
    const shared = {
      prompt: requirePrompt(plane, "Kling Omni"),
      mode: plane.settings.mode,
      duration: int(plane.settings.duration),
      aspect_ratio: plane.settings.aspectRatio,
    }
    if (start)
      return {
        path: "kling-video/omni/first-last-frame",
        body: compact({
          ...shared,
          first_frame_url: start,
          last_frame_url: first(plane, "end"),
        }),
      }
    return {
      path: "kling-video/omni/image-reference",
      body: compact({
        ...shared,
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

export const klingOmniVideoRef: ModelEntry = {
  ...meta,
  id: "kling-omni-video-ref",
  label: "Kling Omni Video Reference",
  description:
    "A new 3–10 s shot modelled on one reference video, with up to 4 images for look and characters.",
  bestFor: "Borrowing motion from an existing shot",
  category: "GENERAL",
  roles: { video: 1, reference: 4 },
  requiredRoles: ["video"],
  settings: {
    aspectRatio,
    duration: {
      type: "range",
      min: 3,
      max: 10,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    mode,
  },
  order: 151,
  docs: [DOCS, `${DOCS}/video-reference`],
  toPlatform: (plane) => {
    const video = first(plane, "video")
    if (!video) throw new Error("Add a reference video to use Kling Omni.")
    const refs = urls(plane, "reference")
    return {
      path: "kling-video/omni/video-reference",
      body: compact({
        prompt: requirePrompt(plane, "Kling Omni Video Reference"),
        mode: plane.settings.mode,
        duration: plane.settings.duration,
        aspect_ratio: plane.settings.aspectRatio,
        video_urls: [video],
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

export const klingOmniEdit: ModelEntry = {
  ...meta,
  id: "kling-omni-edit",
  tab: "edit",
  label: "Kling Omni Edit",
  description:
    "Describe the change and Kling rewrites a 3–10 s clip, optionally matching up to 4 reference images.",
  bestFor: "Quick prompt edits of short clips",
  category: "EDIT",
  roles: { source: 1, reference: 4 },
  requiredRoles: ["source"],
  settings: { mode },
  order: 301,
  docs: [DOCS, `${DOCS}/video-edit`],
  toPlatform: (plane) => {
    const video = first(plane, "source")
    if (!video) throw new Error("Add a source video to edit.")
    const refs = urls(plane, "reference")
    return {
      path: "kling-video/omni/video-edit",
      body: compact({
        prompt: requirePrompt(plane, "Kling Omni Edit"),
        mode: plane.settings.mode,
        video_urls: [video],
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

const models = [klingOmni, klingOmniVideoRef, klingOmniEdit]
export default models
