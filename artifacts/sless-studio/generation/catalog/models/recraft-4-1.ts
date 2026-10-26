// Recraft V4.1 — one picker entry over four text-to-image endpoints.
// Sources:
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1/text-to-image
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1-pro
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1-pro/generate
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1-utility
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1-utility/text-to-image
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1-utility-pro
//   https://docs.higgsfield.ai/docs/models/recraft-v4-1-utility-pro/text-to-image
// Each endpoint accepts exactly one resolution tier (1k on the base paths, 2k on
// the Pro paths), so style × resolution picks the path. Not exposed: colors,
// background_color.
import { compact, requirePrompt } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models"

const ASPECT = [
  "1:1",
  "2:1",
  "1:2",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "6:10",
  "14:10",
  "10:14",
  "16:9",
  "9:16",
] as const

const PATHS: Record<string, Record<string, string>> = {
  standard: {
    "1k": "recraft/v4.1/text-to-image",
    "2k": "recraft/v4.1/pro/text-to-image",
  },
  utility: {
    "1k": "recraft/v4.1/utility/text-to-image",
    "2k": "recraft/v4.1/utility/pro/text-to-image",
  },
}

const recraft41: ModelEntry = {
  id: "recraft-4.1",
  surface: "image",
  family: "Recraft",
  provider: "Recraft",
  icon: "recraft",
  label: "Recraft V4.1",
  description:
    "Clean graphic design output: logos, icons, flat illustration and brand marks with tidy shapes.",
  bestFor: "Logos, icons and flat brand graphics",
  category: "DESIGN",
  roles: {},
  requirePrompt: true,
  maxPromptLength: 10000,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ASPECT,
      default: "1:1",
      label: "Aspect ratio",
    },
    style: {
      type: "enum",
      values: ["standard", "utility"],
      default: "standard",
      label: "Variant",
      labels: { standard: "Standard", utility: "Utility" },
    },
    resolution: {
      type: "enum",
      values: ["1k", "2k"],
      default: "1k",
      label: "Resolution",
      labels: { "1k": "1K", "2k": "2K" },
      hint: "2K uses the Pro tier of the selected variant.",
    },
    format: {
      type: "enum",
      values: ["jpg", "png", "webp"],
      default: "jpg",
      label: "Format",
      labels: { jpg: "JPG", png: "PNG", webp: "WebP" },
    },
  },
  order: 30,
  docs: [
    `${DOCS}/recraft-v4-1`,
    `${DOCS}/recraft-v4-1/text-to-image`,
    `${DOCS}/recraft-v4-1-pro`,
    `${DOCS}/recraft-v4-1-pro/generate`,
    `${DOCS}/recraft-v4-1-utility`,
    `${DOCS}/recraft-v4-1-utility/text-to-image`,
    `${DOCS}/recraft-v4-1-utility-pro`,
    `${DOCS}/recraft-v4-1-utility-pro/text-to-image`,
  ],
  toPlatform: (plane) => {
    const style = String(plane.settings.style)
    const resolution = String(plane.settings.resolution)
    const path = PATHS[style]?.[resolution]
    if (!path) throw new Error("Choose a Recraft variant and resolution.")
    return {
      path,
      body: compact({
        prompt: requirePrompt(plane, "Recraft V4.1"),
        resolution,
        aspect_ratio: plane.settings.aspectRatio,
        output_format: plane.settings.format,
      }),
    }
  },
}

export default recraft41
