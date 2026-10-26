// Kling O3 — first/last frame, image reference, video edit, video reference.
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-o3
//   https://docs.higgsfield.ai/docs/models/kling-o3/first-last-frame
//   https://docs.higgsfield.ai/docs/models/kling-o3/image-reference
//   https://docs.higgsfield.ai/docs/models/kling-o3/video-edit
//   https://docs.higgsfield.ai/docs/models/kling-o3/video-reference
// Frames → first-last-frame (first_frame_url required); image references (or
// text alone, image_urls being optional) → image-reference. The docs set no
// image_urls maximum on image-reference; 7 is our UI cap. Not exposed:
// elements, multi_prompt / multi_shots (multi_shots=true requires
// multi_prompt), shot_type. Prompts are required and kept within the
// documented 2,500 characters.
import {
  assertFramesOrReferences,
  compact,
  first,
  onOff,
  requirePrompt,
  urls,
} from "../mappers"
import { KLING_ASPECT } from "../tokens"
import type { ModelEntry, SettingField } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-o3"

const meta = {
  surface: "video",
  family: "Kling",
  provider: "Kuaishou",
  icon: "kling",
  requirePrompt: true,
  maxPromptLength: 2500,
} as const

const MODE_LABELS = { std: "Standard", pro: "Pro", "4k": "4K" } as const

function mode(values: readonly (keyof typeof MODE_LABELS)[]): SettingField {
  return {
    type: "enum",
    values,
    default: "pro",
    label: "Mode",
    labels: Object.fromEntries(
      values.map((value) => [value, MODE_LABELS[value]])
    ),
  }
}

const aspectRatio = {
  type: "enum",
  values: KLING_ASPECT,
  default: "16:9",
  label: "Aspect ratio",
} as const satisfies SettingField

export const klingO3: ModelEntry = {
  ...meta,
  id: "kling-o3",
  label: "Kling O3",
  description:
    "Kling's all-in-one model: steer a 3–15 s shot with first and last frames or a set of reference images.",
  bestFor: "Character-consistent shots from references",
  badges: ["4K"],
  category: "GENERAL",
  roles: { start: 1, end: 1, reference: 7 },
  mediaModes: [
    { id: "frames", label: "Frames", roles: { start: 1, end: 1 } },
    { id: "references", label: "References", roles: { reference: 7 } },
  ],
  settings: {
    aspectRatio,
    duration: {
      type: "range",
      min: 3,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    mode: mode(["std", "pro", "4k"]),
    generateAudio: {
      type: "boolean",
      default: false,
      label: "Generate audio",
      hint: "Native sound for the clip.",
    },
  },
  order: 140,
  docs: [DOCS, `${DOCS}/first-last-frame`, `${DOCS}/image-reference`],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane)
    const start = first(plane, "start")
    const refs = urls(plane, "reference")
    const shared = {
      prompt: requirePrompt(plane, "Kling O3"),
      mode: plane.settings.mode,
      duration: plane.settings.duration,
      aspect_ratio: plane.settings.aspectRatio,
      sound: onOff(plane.settings.generateAudio),
    }
    if (start)
      return {
        path: "kling-video/o3/first-last-frame",
        body: compact({
          ...shared,
          first_frame_url: start,
          last_frame_url: first(plane, "end"),
        }),
      }
    return {
      path: "kling-video/o3/image-reference",
      body: compact({
        ...shared,
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

export const klingO3VideoRef: ModelEntry = {
  ...meta,
  id: "kling-o3-video-ref",
  label: "Kling O3 Video Reference",
  description:
    "Generate a new 3–10 s shot that borrows camera work and action from one reference video, plus up to 4 images.",
  bestFor: "Recreating a shot's movement with new content",
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
    mode: mode(["std", "pro"]),
  },
  order: 141,
  docs: [DOCS, `${DOCS}/video-reference`],
  toPlatform: (plane) => {
    const video = first(plane, "video")
    if (!video) throw new Error("Add a reference video to use Kling O3.")
    const refs = urls(plane, "reference")
    return {
      path: "kling-video/o3/video-reference",
      body: compact({
        prompt: requirePrompt(plane, "Kling O3 Video Reference"),
        mode: plane.settings.mode,
        duration: plane.settings.duration,
        aspect_ratio: plane.settings.aspectRatio,
        video_urls: [video],
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

export const klingO3Edit: ModelEntry = {
  ...meta,
  id: "kling-o3-edit",
  tab: "edit",
  label: "Kling O3 Edit",
  description:
    "Rework a 3–15 s clip with words: swap subjects, restyle or change the setting, optionally guided by up to 4 images.",
  bestFor: "Prompt-driven edits of an existing clip",
  badges: ["4K"],
  category: "EDIT",
  roles: { source: 1, reference: 4 },
  requiredRoles: ["source"],
  settings: { mode: mode(["std", "pro", "4k"]) },
  order: 300,
  docs: [DOCS, `${DOCS}/video-edit`],
  toPlatform: (plane) => {
    const video = first(plane, "source")
    if (!video) throw new Error("Add a source video to edit.")
    const refs = urls(plane, "reference")
    return {
      path: "kling-video/o3/video-edit",
      body: compact({
        prompt: requirePrompt(plane, "Kling O3 Edit"),
        mode: plane.settings.mode,
        video_urls: [video],
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

const models = [klingO3, klingO3VideoRef, klingO3Edit]
export default models
