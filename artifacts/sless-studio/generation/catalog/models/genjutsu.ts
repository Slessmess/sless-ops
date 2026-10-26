// Genjutsu — motion transfer and object swap on a source video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/genjutsu
//   https://docs.higgsfield.ai/docs/models/genjutsu/motion-transfer
//   https://docs.higgsfield.ai/docs/models/genjutsu/object-swap
// Both take the source video (`source` → video_url, at least 4 s; trimmed to
// 30 s) and 1–8 image references (image_urls). The prompt is optional and the
// output length follows the source video.
import { compact, first, promptText, urls } from "../mappers"
import type { GenerationPlane, ModelEntry, PlatformRequest } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/genjutsu"

function mapGenjutsu(plane: GenerationPlane, path: string): PlatformRequest {
  const video = first(plane, "source")
  const refs = urls(plane, "reference")
  if (!video) throw new Error("Add a source video of at least 4 seconds.")
  if (!refs.length) throw new Error("Add at least one reference image.")
  return {
    path,
    body: compact({
      prompt: promptText(plane),
      video_url: video,
      image_urls: refs,
      resolution: plane.settings.resolution,
    }),
  }
}

const meta = {
  surface: "video",
  family: "Genjutsu",
  provider: "Higgsfield",
  icon: "higgsfield",
  roles: { source: 1, reference: 8 },
  requiredRoles: ["source", "reference"],
  roleLabels: { source: "Source video", reference: "Character image" },
  maxPromptLength: 10000,
  settings: {
    resolution: {
      type: "enum",
      values: ["720p", "480p"],
      default: "720p",
      label: "Resolution",
    },
  },
} satisfies Partial<ModelEntry>

export const genjutsuMotion: ModelEntry = {
  ...meta,
  id: "genjutsu-motion",
  tab: "motion",
  label: "Genjutsu Motion Transfer",
  description:
    "Re-cast a clip: the people or characters in your 1–8 images perform the motion of the source video.",
  bestFor: "Swapping who performs a clip's motion",
  badges: ["NEW"],
  category: "MOTION",
  order: 314,
  docs: [DOCS, `${DOCS}/motion-transfer`],
  toPlatform: (plane) =>
    mapGenjutsu(plane, "higgsfield/genjutsu/motion-transfer/v1.0"),
}

export const genjutsuSwap: ModelEntry = {
  ...meta,
  roleLabels: { source: "Source video", reference: "Replacement image" },
  id: "genjutsu-swap",
  tab: "edit",
  label: "Genjutsu Object Swap",
  description:
    "Replace an object in a clip with one from your images while the rest of the footage stays put.",
  bestFor: "Product and prop replacement in video",
  badges: ["NEW"],
  category: "EDIT",
  order: 302,
  docs: [DOCS, `${DOCS}/object-swap`],
  toPlatform: (plane) =>
    mapGenjutsu(plane, "higgsfield/genjutsu/object-swap/v1.0"),
}

const models = [genjutsuMotion, genjutsuSwap]
export default models
