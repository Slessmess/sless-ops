// Kling 2.5 Turbo — Pro (text or start frame) and Standard (start frame).
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-2-5-turbo
//   https://docs.higgsfield.ai/docs/models/kling-2-5-turbo/pro-text-to-video
//   https://docs.higgsfield.ai/docs/models/kling-2-5-turbo/pro-image-to-video
//   https://docs.higgsfield.ai/docs/models/kling-2-5-turbo/standard-image-to-video
// These endpoints have no sound or aspect_ratio field. Not exposed:
// negative_prompt.
import { compact, first, int, requirePrompt } from "../mappers"
import type { GenerationPlane, ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-2-5-turbo"

const meta = {
  surface: "video",
  family: "Kling",
  provider: "Kuaishou",
  icon: "kling",
  roles: { start: 1 },
  requirePrompt: true,
  settings: {
    duration: {
      type: "enum",
      values: ["5", "10"],
      default: "5",
      label: "Duration",
      labels: { "5": "5s", "10": "10s" },
    },
    cfgScale: {
      type: "range",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.5,
      label: "Prompt adherence",
      hint: "Higher follows the prompt more literally.",
    },
  },
} satisfies Partial<ModelEntry>

function turboBody(plane: GenerationPlane, label: string) {
  return compact({
    prompt: requirePrompt(plane, label),
    duration: int(plane.settings.duration),
    cfg_scale: plane.settings.cfgScale,
  })
}

export const kling25Turbo: ModelEntry = {
  ...meta,
  id: "kling-2.5-turbo",
  label: "Kling 2.5 Turbo Pro",
  description:
    "Snappy, affordable Kling clips from a prompt or a start frame, without sound.",
  bestFor: "Quick silent clips",
  badges: ["FAST", "PRO"],
  category: "FAST",
  order: 170,
  docs: [DOCS, `${DOCS}/pro-text-to-video`, `${DOCS}/pro-image-to-video`],
  toPlatform: (plane) => {
    const start = first(plane, "start")
    const body = turboBody(plane, "Kling 2.5 Turbo Pro")
    if (start)
      return {
        path: "kling-video/v2.5-turbo/pro/image-to-video",
        body: { ...body, image_url: start },
      }
    return { path: "kling-video/v2.5-turbo/pro/text-to-video", body }
  },
}

export const kling25TurboStd: ModelEntry = {
  ...meta,
  id: "kling-2.5-turbo-std",
  label: "Kling 2.5 Turbo",
  description:
    "The cheapest way to bring a still to life: animate a start frame into a 5 or 10 s silent clip.",
  bestFor: "Low-cost image animation",
  badges: ["FAST"],
  category: "FAST",
  requiredRoles: ["start"],
  order: 171,
  docs: [DOCS, `${DOCS}/standard-image-to-video`],
  toPlatform: (plane) => {
    const start = first(plane, "start")
    if (!start) throw new Error("Add a start frame to use Kling 2.5 Turbo.")
    return {
      path: "kling-video/v2.5-turbo/standard/image-to-video",
      body: { ...turboBody(plane, "Kling 2.5 Turbo"), image_url: start },
    }
  },
}

const models = [kling25Turbo, kling25TurboStd]
export default models
