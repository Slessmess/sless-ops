// Wan 2.7 — text / image / reference to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/wan-2-7
//   https://docs.higgsfield.ai/docs/models/wan-2-7/text-to-video
//   https://docs.higgsfield.ai/docs/models/wan-2-7/image-to-video
//   https://docs.higgsfield.ai/docs/models/wan-2-7/reference-to-video
// Text and image workflows take 2–15 s and an optional driving audio_url; the
// image workflow has no aspect_ratio and an optional prompt. References allow
// at most 5 images + videos combined, 2–10 s and 16:9 / 9:16 only. Not
// exposed: seed, negative_prompt.
import {
  assertFramesOrReferences,
  compact,
  first,
  promptText,
  requirePrompt,
  urls,
} from "../mappers"
import { WAN_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/wan-2-7"

const REFERENCE_ASPECT = ["16:9", "9:16"]

const wan27: ModelEntry = {
  id: "wan-2.7",
  surface: "video",
  family: "Wan",
  provider: "Alibaba",
  icon: "wan",
  label: "Wan 2.7",
  description:
    "Character-consistent clips that can follow a driving audio track, from text, frames or up to 5 references.",
  bestFor: "Stylized, audio-driven character clips",
  category: "STYLIZED",
  roles: { start: 1, end: 1, audio: 1, reference: 5, video: 5 },
  maxTotalMedia: 5,
  mediaModes: [
    {
      id: "frames",
      label: "Frames",
      roles: { start: 1, end: 1, audio: 1 },
    },
    {
      id: "references",
      label: "References",
      roles: { reference: 5, video: 5 },
      requireAny: true,
    },
  ],
  settings: {
    aspectRatio: {
      type: "enum",
      values: WAN_ASPECT,
      default: "16:9",
      label: "Aspect ratio",
      hint: "References allow 16:9 or 9:16; frames follow the start image.",
    },
    duration: {
      type: "range",
      min: 2,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
      hint: "References allow up to 10 s.",
    },
    resolution: {
      type: "enum",
      values: ["720p", "1080p"],
      default: "720p",
      label: "Resolution",
    },
    promptExtend: {
      type: "boolean",
      default: false,
      label: "Enhance prompt",
      hint: "Rewrites the prompt with more detail before generating.",
    },
  },
  enhanceSetting: "promptExtend",
  order: 230,
  docs: [
    DOCS,
    `${DOCS}/text-to-video`,
    `${DOCS}/image-to-video`,
    `${DOCS}/reference-to-video`,
  ],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane, ["reference", "video"])
    const start = first(plane, "start")
    const refs = urls(plane, "reference")
    const videos = urls(plane, "video")
    const shared = {
      duration: plane.settings.duration,
      resolution: plane.settings.resolution,
      prompt_extend: plane.settings.promptExtend,
    }
    if (start)
      return {
        path: "wan/v2.7/image-to-video",
        body: compact({
          ...shared,
          prompt: promptText(plane),
          image_url: start,
          end_image_url: first(plane, "end"),
          audio_url: first(plane, "audio"),
        }),
      }
    const prompt = requirePrompt(plane, "Wan 2.7")
    if (refs.length || videos.length) {
      if (first(plane, "audio"))
        throw new Error(
          "Wan 2.7 can't combine driving audio with references. Remove one of them."
        )
      if (refs.length + videos.length > 5)
        throw new Error(
          "Wan 2.7 accepts at most 5 image and video references combined."
        )
      const aspect = String(plane.settings.aspectRatio)
      if (!REFERENCE_ASPECT.includes(aspect))
        throw new Error(
          "Wan 2.7 references support 16:9 or 9:16 only. Change the aspect ratio."
        )
      if (
        typeof plane.settings.duration === "number" &&
        plane.settings.duration > 10
      )
        throw new Error(
          "Wan 2.7 references support up to 10 seconds. Choose a shorter duration."
        )
      return {
        path: "wan/v2.7/reference-to-video",
        body: compact({
          ...shared,
          prompt,
          aspect_ratio: aspect,
          image_urls: refs.length ? refs : undefined,
          video_urls: videos.length ? videos : undefined,
        }),
      }
    }
    return {
      path: "wan/v2.7/text-to-video",
      body: compact({
        ...shared,
        prompt,
        aspect_ratio: plane.settings.aspectRatio,
        audio_url: first(plane, "audio"),
      }),
    }
  },
}

export default wan27
