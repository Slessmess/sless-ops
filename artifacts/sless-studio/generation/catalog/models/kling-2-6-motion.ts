// Kling 2.6 Motion Control — Standard and Pro.
// Sources:
//   https://docs.higgsfield.ai/docs/models/kling-2-6-motion-control
//   https://docs.higgsfield.ai/docs/models/kling-2-6-motion-control/std
//   https://docs.higgsfield.ai/docs/models/kling-2-6-motion-control/pro
// Same schema as Kling 3.0 Motion Control: character image (`start` →
// image_url) plus a required 3–30 s motion video (`source` → video_url).
import { KLING_MOTION_SETTINGS, mapKlingMotion } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/kling-2-6-motion-control"

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

export const kling26MotionStd: ModelEntry = {
  ...meta,
  id: "kling-2.6-motion-std",
  label: "Kling 2.6 Motion Control",
  description:
    "The earlier Kling motion transfer: animate a character image with the movement from a clip.",
  bestFor: "Budget motion transfer",
  order: 312,
  docs: [DOCS, `${DOCS}/std`],
  toPlatform: (plane) =>
    mapKlingMotion(plane, "kling-video/motion-control/std"),
}

export const kling26MotionPro: ModelEntry = {
  ...meta,
  id: "kling-2.6-motion-pro",
  label: "Kling 2.6 Motion Control Pro",
  description:
    "Kling 2.6 motion transfer at the Pro tier for crisper results from the same image and clip.",
  bestFor: "Motion transfer with more detail",
  badges: ["PRO"],
  order: 313,
  docs: [DOCS, `${DOCS}/pro`],
  toPlatform: (plane) =>
    mapKlingMotion(plane, "kling-video/motion-control/pro"),
}

const models = [kling26MotionStd, kling26MotionPro]
export default models
