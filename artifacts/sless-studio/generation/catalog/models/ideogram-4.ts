// Ideogram 4.0 — generate, or remix one reference image.
// Sources:
//   https://docs.higgsfield.ai/docs/models/ideogram-4
//   https://docs.higgsfield.ai/docs/models/ideogram-4/generate
// image_weight applies to editing only, so it is sent only with a reference.
// The docs give it no default; 50 is our UI default.
import { compact, first, int, requirePrompt } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/ideogram-4"

const ASPECT = [
  "1:1",
  "1:2",
  "2:1",
  "2:3",
  "3:2",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "5:8",
  "8:5",
  "3:4",
  "4:3",
  "9:22",
  "22:9",
  "9:23",
  "23:9",
  "3:8",
  "8:3",
  "5:12",
  "12:5",
  "1:3",
  "3:1",
] as const

const ideogram4: ModelEntry = {
  id: "ideogram-4",
  surface: "image",
  family: "Ideogram",
  provider: "Ideogram",
  icon: "ideogram",
  label: "Ideogram 4.0",
  description:
    "Posters, covers and graphics where the lettering has to come out right, with an optional image to remix.",
  bestFor: "Typography, posters and logos with words",
  category: "TYPOGRAPHY",
  roles: { reference: 1 },
  requirePrompt: true,
  maxPromptLength: 2048,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ASPECT,
      default: "1:1",
      label: "Aspect ratio",
    },
    renderingSpeed: {
      type: "enum",
      values: ["TURBO", "DEFAULT", "QUALITY"],
      default: "DEFAULT",
      label: "Rendering",
      labels: { TURBO: "Turbo", DEFAULT: "Balanced", QUALITY: "Quality" },
    },
    imageWeight: {
      type: "range",
      min: 1,
      max: 100,
      default: 50,
      label: "Image weight",
      hint: "Only used with a reference image: higher keeps more of it.",
    },
  },
  order: 50,
  docs: [DOCS, `${DOCS}/generate`],
  toPlatform: (plane) => {
    const prompt = requirePrompt(plane, "Ideogram 4.0")
    if (prompt.length < 2)
      throw new Error("Ideogram 4.0 prompts need at least 2 characters.")
    const image = first(plane, "reference")
    return {
      path: "ideogram/v4.0",
      body: compact({
        prompt,
        aspect_ratio: plane.settings.aspectRatio,
        rendering_speed: plane.settings.renderingSpeed,
        image_url: image,
        image_weight: image ? int(plane.settings.imageWeight) : undefined,
      }),
    }
  },
}

export default ideogram4
