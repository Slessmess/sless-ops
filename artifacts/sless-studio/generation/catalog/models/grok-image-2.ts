// Grok Image 2.0 — generate and edit.
// Sources:
//   https://docs.higgsfield.ai/docs/models/grok-image-2
//   https://docs.higgsfield.ai/docs/models/grok-image-2/generate-and-edit
import { compact, requirePrompt, urls } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/grok-image-2"

const ASPECT = [
  "auto",
  "1:1",
  "1:2",
  "2:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
] as const

const grokImage2: ModelEntry = {
  id: "grok-image-2",
  surface: "image",
  family: "Grok",
  provider: "xAI",
  icon: "grok",
  label: "Grok Image 2.0",
  description:
    "Bold, high-contrast pictures from a prompt, or edits guided by up to 10 reference images.",
  bestFor: "Stylized, punchy and anime-leaning looks",
  category: "STYLIZED",
  roles: { reference: 10 },
  requirePrompt: true,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ASPECT,
      default: "auto",
      label: "Aspect ratio",
      labels: { auto: "Auto" },
    },
    resolution: {
      type: "enum",
      values: ["1k", "2k"],
      default: "1k",
      label: "Resolution",
      labels: { "1k": "1K", "2k": "2K" },
    },
    quality: {
      type: "enum",
      values: ["low", "medium"],
      default: "medium",
      label: "Quality",
      labels: { low: "Low", medium: "Medium" },
    },
  },
  order: 20,
  docs: [DOCS, `${DOCS}/generate-and-edit`],
  toPlatform: (plane) => {
    const refs = urls(plane, "reference")
    return {
      path: "xai/grok-imagine-image-2.0",
      body: compact({
        prompt: requirePrompt(plane, "Grok Image 2.0"),
        quality: plane.settings.quality,
        resolution: plane.settings.resolution,
        aspect_ratio: plane.settings.aspectRatio,
        image_urls: refs.length ? refs : undefined,
      }),
    }
  },
}

export default grokImage2
