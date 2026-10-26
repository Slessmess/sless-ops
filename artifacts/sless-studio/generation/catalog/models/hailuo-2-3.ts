// Hailuo 2.3 Standard — text and image to video.
// Sources:
//   https://docs.higgsfield.ai/docs/models/hailuo-2-3
//   https://docs.higgsfield.ai/docs/models/hailuo-2-3/standard-text-to-video
//   https://docs.higgsfield.ai/docs/models/hailuo-2-3/standard-image-to-video
// Output is fixed at 768p: these endpoints have no resolution or aspect_ratio
// field.
import { compact, first, int, requirePrompt } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/hailuo-2-3"

const hailuo23: ModelEntry = {
  id: "hailuo-2.3",
  surface: "video",
  family: "MiniMax",
  provider: "MiniMax",
  icon: "minimax",
  label: "Hailuo 2.3",
  description:
    "Budget-friendly 768p clips with convincing real-world physics, from a prompt or a start frame. No sound.",
  bestFor: "Cheap clips with natural physics",
  category: "GENERAL",
  roles: { start: 1 },
  requirePrompt: true,
  settings: {
    duration: {
      type: "enum",
      values: ["6", "10"],
      default: "6",
      label: "Duration",
      labels: { "6": "6s", "10": "10s" },
    },
    promptOptimizer: {
      type: "boolean",
      default: true,
      label: "Enhance prompt",
      hint: "Refines the prompt before generating.",
    },
  },
  enhanceSetting: "promptOptimizer",
  order: 190,
  docs: [
    DOCS,
    `${DOCS}/standard-text-to-video`,
    `${DOCS}/standard-image-to-video`,
  ],
  toPlatform: (plane) => {
    const start = first(plane, "start")
    const body = compact({
      prompt: requirePrompt(plane, "Hailuo 2.3"),
      duration: int(plane.settings.duration),
      prompt_optimizer: plane.settings.promptOptimizer,
    })
    if (start)
      return {
        path: "minimax/hailuo-2.3/standard/image-to-video",
        body: { ...body, image_url: start },
      }
    return { path: "minimax/hailuo-2.3/standard/text-to-video", body }
  },
}

export default hailuo23
