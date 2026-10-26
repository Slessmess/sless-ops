// PixVerse V6 — text and image to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/pixverse-v6
//   https://docs.higgsfield.ai/docs/models/pixverse-v6/text-to-video
//   https://docs.higgsfield.ai/docs/models/pixverse-v6/image-to-video
// Image-to-video has no aspect_ratio (framing follows the start frame) and
// takes an optional end frame. duration is a number 1–15; we offer whole
// seconds. Not exposed: seed, negative_prompt.
import {
  assertFramesOrReferences,
  compact,
  first,
  requirePrompt,
} from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/pixverse-v6"

const pixverseV6: ModelEntry = {
  id: "pixverse-v6",
  surface: "video",
  family: "PixVerse",
  provider: "PixVerse",
  icon: "pixverse",
  label: "PixVerse V6",
  description:
    "Flexible 1–15 s clips with sound, from 360p previews to 1080p, starting from text or start and end frames.",
  bestFor: "Short social clips at any length",
  badges: ["AUDIO"],
  category: "GENERAL",
  roles: { start: 1, end: 1 },
  requirePrompt: true,
  maxPromptLength: 5000,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ["16:9", "4:3", "1:1", "3:4", "9:16"],
      default: "16:9",
      label: "Aspect ratio",
      hint: "A start frame sets the framing instead.",
    },
    duration: {
      type: "range",
      min: 1,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    resolution: {
      type: "enum",
      values: ["360p", "540p", "720p", "1080p"],
      default: "720p",
      label: "Resolution",
    },
    generateAudio: {
      type: "boolean",
      default: true,
      label: "Generate audio",
      hint: "Native soundtrack and effects.",
    },
  },
  order: 220,
  docs: [DOCS, `${DOCS}/text-to-video`, `${DOCS}/image-to-video`],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane)
    const start = first(plane, "start")
    const shared = {
      prompt: requirePrompt(plane, "PixVerse V6"),
      duration: plane.settings.duration,
      resolution: plane.settings.resolution,
      generate_audio: plane.settings.generateAudio,
    }
    if (start)
      return {
        path: "pixverse/v6/image-to-video",
        body: compact({
          ...shared,
          image_url: start,
          end_image_url: first(plane, "end"),
        }),
      }
    return {
      path: "pixverse/v6/text-to-video",
      body: compact({ ...shared, aspect_ratio: plane.settings.aspectRatio }),
    }
  },
}

export default pixverseV6
