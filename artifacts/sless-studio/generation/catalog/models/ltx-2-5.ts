// LTX-2.5 — Fast and Pro, text and image to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/ltx-2-5
//   https://docs.higgsfield.ai/docs/models/ltx-2-5/text-to-video-fast
//   https://docs.higgsfield.ai/docs/models/ltx-2-5/image-to-video-fast
//   https://docs.higgsfield.ai/docs/models/ltx-2-5/text-to-video-pro
//   https://docs.higgsfield.ai/docs/models/ltx-2-5/image-to-video-pro
// Fast allows 720p–4k and 24/25/48/50 fps; Pro allows 720p/1080p and
// 24/25/50 fps. Image-to-video takes a start frame plus optional end frame;
// both workflows document aspect_ratio.
import {
  assertFramesOrReferences,
  autoEnum,
  compact,
  first,
  int,
  labelsFor,
  requirePrompt,
  unlessAuto,
} from "../mappers"
import type { GenerationPlane, ModelEntry, PlatformRequest } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/ltx-2-5"

function settings(
  resolutions: readonly string[],
  fps: readonly string[]
): ModelEntry["settings"] {
  return {
    aspectRatio: {
      type: "enum",
      values: ["16:9", "9:16"],
      default: "16:9",
      label: "Aspect ratio",
    },
    duration: {
      type: "enum",
      values: ["6", "8", "10"],
      default: "6",
      label: "Duration",
      labels: { "6": "6s", "8": "8s", "10": "10s" },
    },
    resolution: {
      type: "enum",
      values: resolutions,
      default: "720p",
      label: "Resolution",
      labels: labelsFor(resolutions, { "2k": "2K", "4k": "4K" }),
    },
    fps: {
      type: "enum",
      values: fps,
      default: "25",
      label: "Frame rate",
      labels: Object.fromEntries(fps.map((value) => [value, `${value} fps`])),
    },
    generateAudio: {
      type: "boolean",
      default: true,
      label: "Generate audio",
      hint: "Native soundtrack and effects.",
    },
    cameraMovement: autoEnum(
      [
        "dolly_in",
        "dolly_out",
        "dolly_left",
        "dolly_right",
        "jib_up",
        "jib_down",
        "static",
        "focus_shift",
      ],
      "Camera movement"
    ),
  }
}

function mapLtx(
  plane: GenerationPlane,
  tier: "fast" | "pro",
  label: string
): PlatformRequest {
  assertFramesOrReferences(plane)
  const start = first(plane, "start")
  const body = compact({
    prompt: requirePrompt(plane, label),
    duration: int(plane.settings.duration),
    resolution: plane.settings.resolution,
    fps: int(plane.settings.fps),
    aspect_ratio: plane.settings.aspectRatio,
    generate_audio: plane.settings.generateAudio,
    camera_movement: unlessAuto(plane.settings.cameraMovement),
  })
  if (start)
    return {
      path: `lightricks/ltx-2.5/image-to-video/${tier}`,
      body: compact({
        ...body,
        image_url: start,
        end_image_url: first(plane, "end"),
      }),
    }
  return { path: `lightricks/ltx-2.5/text-to-video/${tier}`, body }
}

const meta = {
  surface: "video",
  family: "LTX",
  provider: "Lightricks",
  icon: "ltx",
  roles: { start: 1, end: 1 },
  requirePrompt: true,
  maxPromptLength: 5000,
} satisfies Partial<ModelEntry>

export const ltx25Fast: ModelEntry = {
  ...meta,
  id: "ltx-2.5-fast",
  label: "LTX-2.5 Fast",
  description:
    "Quick 6–10 s clips up to 4K and 50 fps, with sound and simple camera moves, from text or frames.",
  bestFor: "Fast high-resolution drafts",
  badges: ["FAST", "4K", "AUDIO"],
  category: "FAST",
  settings: settings(["720p", "1080p", "2k", "4k"], ["24", "25", "48", "50"]),
  order: 210,
  docs: [DOCS, `${DOCS}/text-to-video-fast`, `${DOCS}/image-to-video-fast`],
  toPlatform: (plane) => mapLtx(plane, "fast", "LTX-2.5 Fast"),
}

export const ltx25Pro: ModelEntry = {
  ...meta,
  id: "ltx-2.5-pro",
  label: "LTX-2.5 Pro",
  description:
    "The higher-quality LTX-2.5 tier for 720p or 1080p clips with sound, from text or start and end frames.",
  bestFor: "Clean 1080p clips with camera moves",
  badges: ["PRO", "AUDIO"],
  category: "GENERAL",
  settings: settings(["720p", "1080p"], ["24", "25", "50"]),
  order: 211,
  docs: [DOCS, `${DOCS}/text-to-video-pro`, `${DOCS}/image-to-video-pro`],
  toPlatform: (plane) => mapLtx(plane, "pro", "LTX-2.5 Pro"),
}

const models = [ltx25Fast, ltx25Pro]
export default models
