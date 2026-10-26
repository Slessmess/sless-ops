// Grok Imagine Video 1.5 — one endpoint for text, a start frame or references.
// Sources:
//   https://docs.higgsfield.ai/docs/models/grok-video-1-5
//   https://docs.higgsfield.ai/docs/models/grok-video-1-5/reference-to-video
// Either one first-frame image_url, or reference media (image_urls ≤ 7 and one
// audio_url), never both. 1080p is rejected in reference mode.
import {
  assertFramesOrReferences,
  compact,
  first,
  hasAny,
  requirePrompt,
  urls,
} from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/grok-video-1-5"

const grokVideo15: ModelEntry = {
  id: "grok-video-1.5",
  surface: "video",
  family: "Grok",
  provider: "xAI",
  icon: "grok",
  label: "Grok Imagine Video 1.5",
  description:
    "Bold, anime-leaning motion from text, one start frame, or up to 7 image references plus an audio track.",
  bestFor: "Stylized, high-contrast animation",
  category: "STYLIZED",
  roles: { start: 1, reference: 7, audio: 1 },
  mediaModes: [
    { id: "frames", label: "Start frame", roles: { start: 1 } },
    {
      id: "references",
      label: "References",
      roles: { reference: 7, audio: 1 },
      requireAny: true,
    },
  ],
  requirePrompt: true,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
      default: "auto",
      label: "Aspect ratio",
      labels: { auto: "Auto" },
    },
    duration: {
      type: "range",
      min: 1,
      max: 15,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    resolution: {
      type: "enum",
      values: ["480p", "720p", "1080p"],
      default: "480p",
      label: "Resolution",
      hint: "1080p works with text or a start frame, not references.",
    },
  },
  order: 250,
  docs: [DOCS, `${DOCS}/reference-to-video`],
  toPlatform: (plane) => {
    assertFramesOrReferences(plane, ["reference", "audio"])
    const refs = urls(plane, "reference")
    const withReferences = hasAny(plane, ["reference", "audio"])
    if (withReferences && plane.settings.resolution === "1080p")
      throw new Error(
        "Grok Imagine Video 1.5 renders references at 480p or 720p. Lower the resolution."
      )
    return {
      path: "xai/grok-imagine-video/v1.5/reference-to-video",
      body: compact({
        prompt: requirePrompt(plane, "Grok Imagine Video 1.5"),
        duration: plane.settings.duration,
        resolution: plane.settings.resolution,
        aspect_ratio: plane.settings.aspectRatio,
        image_url: first(plane, "start"),
        image_urls: refs.length ? refs : undefined,
        audio_url: first(plane, "audio"),
      }),
    }
  },
}

export default grokVideo15
