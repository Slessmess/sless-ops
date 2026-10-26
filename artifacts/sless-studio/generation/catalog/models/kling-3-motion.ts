// Kling 3.0 Motion Control — Standard and Pro.
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-3-motion-control
//   https://docs.higgsfield.ai/docs/models/kling-3-motion-control/std
//   https://docs.higgsfield.ai/docs/models/kling-3-motion-control/pro
// The character image is the `start` role (image_url) and the driving motion
// video (3–30 s) is the `source` role (video_url); both are required.
import { KLING_MOTION_SETTINGS, mapKlingMotion } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-3-motion-control"

const meta = {
  surface: "video",
  tab: "motion",
  family: "Kling",
  provider: "Kuaishou",
  icon: "kling",
  category: "MOTION",
  roles: { start: 1, source: 1 },
  requiredRoles: ["start", "source"],
  roleLabels: { start: "Character image", source: "Motion video" },
  settings: KLING_MOTION_SETTINGS,
} satisfies Partial<ModelEntry>

export const kling3MotionStd: ModelEntry = {
  ...meta,
  id: "kling-3-motion-std",
  label: "Kling 3.0 Motion Control",
  description:
    "Puts your character through the moves of a reference clip: one image plus a 3–30 s motion video.",
  bestFor: "Dance and action transfer onto a character",
  order: 310,
  docs: [DOCS, `${DOCS}/std`],
  toPlatform: (plane) =>
    mapKlingMotion(plane, "kling-video/v3/motion-control/std"),
}

export const kling3MotionPro: ModelEntry = {
  ...meta,
  id: "kling-3-motion-pro",
  label: "Kling 3.0 Motion Control Pro",
  description:
    "Higher-fidelity motion transfer from a reference clip onto your character image.",
  bestFor: "Cleaner, more detailed motion transfer",
  badges: ["PRO"],
  order: 311,
  docs: [DOCS, `${DOCS}/pro`],
  toPlatform: (plane) =>
    mapKlingMotion(plane, "kling-video/v3/motion-control/pro"),
}

const models = [kling3MotionStd, kling3MotionPro]
export default models
