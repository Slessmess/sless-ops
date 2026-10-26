// Z-Image Turbo — text to image.
// Sources:
//   https://docs.higgsfield.ai/docs/models/z-image-turbo
//   https://docs.higgsfield.ai/docs/models/z-image-turbo/generate
// Not exposed: seed.
import { compact, requirePrompt } from "../mappers"
import { QWEN_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/z-image-turbo"

const zImageTurbo: ModelEntry = {
  id: "z-image-turbo",
  surface: "image",
  family: "Z-Image",
  provider: "Alibaba",
  icon: "z-image",
  label: "Z-Image Turbo",
  description:
    "The quickest way from idea to picture: cheap, fast drafts you can iterate on in seconds.",
  bestFor: "Rapid drafts and cheap iteration",
  badges: ["FAST"],
  category: "FAST",
  roles: {},
  requirePrompt: true,
  maxPromptLength: 800,
  settings: {
    aspectRatio: {
      type: "enum",
      values: QWEN_ASPECT,
      default: "1:1",
      label: "Aspect ratio",
    },
    resolution: {
      type: "enum",
      values: ["1k", "2k"],
      default: "1k",
      label: "Resolution",
      labels: { "1k": "1K", "2k": "2K" },
    },
    promptExtend: {
      type: "boolean",
      default: false,
      label: "Enhance prompt",
      hint: "Adds detail to the prompt; billed at the enhanced rate.",
    },
  },
  enhanceSetting: "promptExtend",
  order: 60,
  docs: [DOCS, `${DOCS}/generate`],
  toPlatform: (plane) => ({
    path: "z-image/turbo",
    body: compact({
      prompt: requirePrompt(plane, "Z-Image Turbo"),
      resolution: plane.settings.resolution,
      aspect_ratio: plane.settings.aspectRatio,
      prompt_extend: plane.settings.promptExtend,
    }),
  }),
}

export default zImageTurbo
