// MiniMax H3 — text / image / reference to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/minimax-h3
//   https://docs.higgsfield.ai/docs/models/minimax-h3/text-to-video
//   https://docs.higgsfield.ai/docs/models/minimax-h3/image-to-video
//   https://docs.higgsfield.ai/docs/models/minimax-h3/reference-to-video
// resolution is fixed to the case-sensitive "2K", so it is always sent and
// never shown. Audio references need an image or video reference. The
// provider reads only the first 7,000 prompt characters, enforced here.
// Not exposed: aigc_watermark (omitted).
import {
  assertAnyOf,
  assertFramesOrReferences,
  compact,
  first,
  hasAny,
  requirePrompt,
  urls,
} from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/minimax-h3"

const minimaxH3: ModelEntry = {
  id: "minimax-h3",
  surface: "video",
  family: "MiniMax",
  provider: "MiniMax",
  icon: "minimax",
  label: "MiniMax H3",
  description:
    "Crisp 2K clips of 5–15 s from text, start and end frames, or image and video references with optional audio.",
  bestFor: "Sharp 2K output from mixed references",
  badges: ["NEW"],
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
  requirePrompt: true,
  maxPromptLength: 7000,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ["auto", "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
      default: "auto",
      label: "Aspect ratio",
      labels: { auto: "Auto", adaptive: "Adaptive" },
      hint: "Frames follow the start image; text-only Auto is 16:9.",
    },
    duration: {
      type: "range",
      min: 5,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
    },
  },
  order: 180,
  docs: [
    DOCS,
    `${DOCS}/text-to-video`,
    `${DOCS}/image-to-video`,
    `${DOCS}/reference-to-video`,
  ],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane)
    const start = first(plane, "start")
    const refs = urls(plane, "reference")
    const videos = urls(plane, "video")
    const audios = urls(plane, "audio")
    const shared = {
      prompt: requirePrompt(plane, "MiniMax H3"),
      duration: plane.settings.duration,
      resolution: "2K",
      aspect_ratio: plane.settings.aspectRatio,
    }
    if (start)
      return {
        path: "minimax/h3/image-to-video",
        body: compact({
          ...shared,
          image_url: start,
          end_image_url: first(plane, "end"),
        }),
      }
    if (hasAny(plane, ["reference", "video", "audio"])) {
      assertAnyOf(
        plane,
        ["reference", "video"],
        "Audio references need at least one image or video reference."
      )
      return {
        path: "minimax/h3/reference-to-video",
        body: compact({
          ...shared,
          image_urls: refs.length ? refs : undefined,
          video_urls: videos.length ? videos : undefined,
          audio_urls: audios.length ? audios : undefined,
        }),
      }
    }
    return { path: "minimax/h3/text-to-video", body: compact(shared) }
  },
}

export default minimaxH3
