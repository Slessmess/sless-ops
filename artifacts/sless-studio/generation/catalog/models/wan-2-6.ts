// Wan 2.6 — text / image / reference to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/wan-2-6
//   https://docs.higgsfield.ai/docs/models/wan-2-6/text-to-video
//   https://docs.higgsfield.ai/docs/models/wan-2-6/image-to-video
//   https://docs.higgsfield.ai/docs/models/wan-2-6/reference-to-video
// Text and image workflows take 5 / 10 / 15 s, an optional driving audio_url,
// multi_shots and prompt_extend, and have no aspect_ratio. The reference
// workflow takes 1–3 videos, 5 / 10 s and aspect_ratio only. Resolution is
// limited to the 720p / 1080p tiers all three accept. Not exposed: seed,
// negative_prompt.
import {
  assertFramesOrReferences,
  compact,
  first,
  int,
  requirePrompt,
  urls,
} from "../mappers"
import { WAN_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/wan-2-6"

const wan26: ModelEntry = {
  id: "wan-2.6",
  surface: "video",
  family: "Wan",
  provider: "Alibaba",
  icon: "wan",
  label: "Wan 2.6",
  description:
    "An inexpensive, artsy option: clips from text, a start frame or up to 3 reference videos, optionally driven by audio.",
  bestFor: "Stylized experiments on a budget",
  category: "STYLIZED",
  roles: { start: 1, audio: 1, video: 3 },
  mediaModes: [
    { id: "frames", label: "Start frame", roles: { start: 1, audio: 1 } },
    {
      id: "references",
      label: "Video references",
      roles: { video: 3 },
      requireAny: true,
    },
  ],
  requirePrompt: true,
  settings: {
    aspectRatio: {
      type: "enum",
      values: WAN_ASPECT,
      default: "16:9",
      label: "Aspect ratio",
      hint: "Used with video references only.",
    },
    duration: {
      type: "enum",
      values: ["5", "10", "15"],
      default: "5",
      label: "Duration",
      labels: { "5": "5s", "10": "10s", "15": "15s" },
      hint: "Video references allow 5 or 10 s.",
    },
    resolution: {
      type: "enum",
      values: ["720p", "1080p"],
      default: "720p",
      label: "Resolution",
    },
    multiShots: {
      type: "boolean",
      default: false,
      label: "Multi-shot",
      hint: "Cuts between several shots; also turns on Enhance prompt.",
    },
    promptExtend: {
      type: "boolean",
      default: false,
      label: "Enhance prompt",
      hint: "Rewrites the prompt with more detail before generating.",
    },
  },
  enhanceSetting: "promptExtend",
  order: 240,
  docs: [
    DOCS,
    `${DOCS}/text-to-video`,
    `${DOCS}/image-to-video`,
    `${DOCS}/reference-to-video`,
  ],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane, ["video"])
    const prompt = requirePrompt(plane, "Wan 2.6")
    const duration = int(plane.settings.duration)
    const start = first(plane, "start")
    const videos = urls(plane, "video")
    if (videos.length) {
      if (first(plane, "audio"))
        throw new Error(
          "Wan 2.6 can't combine driving audio with video references. Remove one of them."
        )
      if (duration === 15)
        throw new Error(
          "Wan 2.6 video references support 5 or 10 seconds. Choose a shorter duration."
        )
      return {
        path: "wan/v2.6/reference-to-video",
        body: compact({
          prompt,
          duration,
          resolution: plane.settings.resolution,
          aspect_ratio: plane.settings.aspectRatio,
          video_urls: videos,
        }),
      }
    }
    const shared = {
      prompt,
      duration,
      resolution: plane.settings.resolution,
      audio_url: first(plane, "audio"),
      multi_shots: plane.settings.multiShots,
      prompt_extend: plane.settings.promptExtend,
    }
    if (start)
      return {
        path: "wan/v2.6/image-to-video",
        body: compact({ ...shared, image_url: start }),
      }
    return { path: "wan/v2.6/text-to-video", body: compact(shared) }
  },
}

export default wan26
