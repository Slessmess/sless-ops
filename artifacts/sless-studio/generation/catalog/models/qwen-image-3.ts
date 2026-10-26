// Qwen Image 3 — text to image, or edit 1–3 reference images.
// Sources:
//   https://docs.higgsfield.ai/docs/models/qwen-image-3
//   https://docs.higgsfield.ai/docs/models/qwen-image-3/text-to-image
//   https://docs.higgsfield.ai/docs/models/qwen-image-3/edit
// enable_thinking requires prompt_extend=true, so thinking is sent as false
// whenever prompt extension is off. Not exposed: seed, negative_prompt,
// prompt_extend_mode (API default "direct").
import { compact, requirePrompt, urls } from "../mappers"
import { QWEN_ASPECT } from "../tokens"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/qwen-image-3"

const qwenImage3: ModelEntry = {
  id: "qwen-image-3",
  surface: "image",
  family: "Qwen",
  provider: "Alibaba",
  icon: "qwen",
  label: "Qwen Image 3",
  description:
    "Reasoning-aided image generation that also edits one to three of your pictures from a written instruction.",
  bestFor: "Instruction edits and prompt-faithful scenes",
  badges: ["NEW"],
  category: "GENERAL",
  roles: { reference: 3 },
  requirePrompt: true,
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
      default: true,
      label: "Enhance prompt",
      hint: "Rewrites the prompt with more detail before generating.",
    },
    thinking: {
      type: "boolean",
      default: true,
      label: "Thinking",
      hint: "Reasons about the prompt first. Needs Enhance prompt.",
    },
  },
  enhanceSetting: "promptExtend",
  order: 40,
  docs: [DOCS, `${DOCS}/text-to-image`, `${DOCS}/edit`],
  toPlatform: (plane) => {
    const refs = urls(plane, "reference")
    const extend = plane.settings.promptExtend === true
    const body = compact({
      prompt: requirePrompt(plane, "Qwen Image 3"),
      resolution: plane.settings.resolution,
      aspect_ratio: plane.settings.aspectRatio,
      prompt_extend: extend,
      enable_thinking: extend ? plane.settings.thinking === true : false,
    })
    if (refs.length)
      return {
        path: "alibaba/qwen-image-3/edit",
        body: { ...body, image_urls: refs },
      }
    return { path: "alibaba/qwen-image-3/text-to-image", body }
  },
}

export default qwenImage3
