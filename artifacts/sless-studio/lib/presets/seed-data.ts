import type { Surface } from "@/generation/catalog/types"

/**
 * Launch set of Effects presets. Each one is a prompt template plus a model
 * and settings; `{subject}` is replaced with the user's prompt when present.
 * Covers live in /public/media/presets and are generated with our own models.
 */
export interface PresetSeed {
  slug: string
  title: string
  description: string
  surface: Surface
  modelId: string
  promptTemplate: string
  settings: Record<string, unknown>
  category: string
  order: number
}

/** Looping covers we generated for motion presets (image covers are /media/presets/<slug>.jpg). */
export const PRESET_LOOPS: Record<string, string> = {
  "dolly-zoom": "/media/loops/dolly-zoom.mp4",
  "bullet-time": "/media/loops/bullet-time.mp4",
  "floating-product": "/media/loops/floating-product.mp4",
  "drone-orbit": "/media/loops/kling.mp4",
}

export const PRESET_CATEGORIES = [
  "Cinematic",
  "Portrait",
  "Product",
  "Motion",
  "Worlds",
  "Stylized",
] as const

export const PRESET_SEED: PresetSeed[] = [
  {
    slug: "neon-noir",
    title: "Neon Noir",
    description:
      "Rain-slick streets, magenta and cyan signage, a lone figure under a flickering sign.",
    surface: "image",
    modelId: "soul-cinema",
    promptTemplate:
      "{subject}, neon noir film still, rain-soaked city street at night, magenta and cyan neon reflections, volumetric haze, anamorphic lens flare, 35mm film grain",
    settings: { aspectRatio: "16:9", resolution: "1080p" },
    category: "Cinematic",
    order: 1,
  },
  {
    slug: "golden-hour-portrait",
    title: "Golden Hour",
    description:
      "Warm, low sun portraits with soft rim light and creamy background blur.",
    surface: "image",
    modelId: "soul-2",
    promptTemplate:
      "{subject}, editorial portrait at golden hour, warm low sun, soft rim light on hair, shallow depth of field, creamy bokeh, natural skin texture",
    settings: { aspectRatio: "3:4", resolution: "1080p" },
    category: "Portrait",
    order: 2,
  },
  {
    slug: "studio-product",
    title: "Studio Product",
    description:
      "Clean seamless-backdrop product shots with a crisp specular highlight.",
    surface: "image",
    modelId: "marketing-image-flare",
    promptTemplate:
      "{subject}, premium studio product photograph on a seamless pastel backdrop, soft box lighting, crisp specular highlight, subtle floor shadow, commercial catalog quality",
    settings: { aspectRatio: "1:1" },
    category: "Product",
    order: 3,
  },
  {
    slug: "dolly-zoom",
    title: "Dolly Zoom",
    description:
      "The vertigo push-pull: the subject holds still while the world stretches behind.",
    surface: "video",
    modelId: "seedance-2.5",
    promptTemplate:
      "{subject}, dramatic dolly zoom, camera pushes in while the background stretches away, subject stays centered and still, tense cinematic mood",
    settings: { aspectRatio: "16:9", duration: 5 },
    category: "Motion",
    order: 4,
  },
  {
    slug: "drone-orbit",
    title: "Drone Orbit",
    description:
      "A slow aerial orbit that reveals the landscape around your subject.",
    surface: "video",
    modelId: "kling-3-std",
    promptTemplate:
      "{subject}, aerial drone shot slowly orbiting around the subject, revealing a vast landscape, smooth stabilized motion, golden light",
    settings: { aspectRatio: "16:9", duration: 5 },
    category: "Motion",
    order: 5,
  },
  {
    slug: "miniature-world",
    title: "Miniature World",
    description:
      "Tilt-shift toy-town scenes with saturated colors and tiny details.",
    surface: "image",
    modelId: "soul-2",
    promptTemplate:
      "{subject}, tilt-shift miniature diorama, toy-like buildings and tiny people, saturated colors, shallow focus band, top-down three-quarter view",
    settings: { aspectRatio: "4:3", resolution: "1080p" },
    category: "Worlds",
    order: 6,
  },
  {
    slug: "claymation",
    title: "Claymation",
    description:
      "Hand-made plasticine characters with visible fingerprints and warm set lighting.",
    surface: "image",
    modelId: "grok-image-2",
    promptTemplate:
      "{subject}, claymation style, handmade plasticine figures with visible fingerprints, stop-motion set, warm practical lighting, playful",
    settings: { aspectRatio: "4:3" },
    category: "Stylized",
    order: 7,
  },
  {
    slug: "bullet-time",
    title: "Bullet Time",
    description:
      "Frozen action while the camera sweeps around it — debris hanging mid-air.",
    surface: "video",
    modelId: "seedance-2.5",
    promptTemplate:
      "{subject}, bullet time effect, action frozen mid-motion with debris suspended in the air, camera sweeps 180 degrees around, high contrast",
    settings: { aspectRatio: "16:9", duration: 5 },
    category: "Motion",
    order: 8,
  },
  {
    slug: "retro-anime",
    title: "Retro Anime",
    description:
      "Late-80s cel animation: grainy film, hand-painted skies, bold line work.",
    surface: "image",
    modelId: "grok-image-2",
    promptTemplate:
      "{subject}, 1980s cel-shaded anime still, hand-painted background sky, bold ink lines, film grain, VHS color bleed",
    settings: { aspectRatio: "16:9" },
    category: "Stylized",
    order: 9,
  },
  {
    slug: "floating-product",
    title: "Levitation",
    description:
      "Products hovering mid-air in soft light with gentle drifting motion.",
    surface: "video",
    modelId: "kling-3-std",
    promptTemplate:
      "{subject}, product levitating in mid-air, slow gentle rotation, soft studio light, subtle particles drifting, premium commercial look",
    settings: { aspectRatio: "9:16", duration: 5 },
    category: "Product",
    order: 10,
  },
  {
    slug: "desert-epic",
    title: "Desert Epic",
    description:
      "Sweeping dunes, heat shimmer and a tiny figure against a vast sky.",
    surface: "image",
    modelId: "soul-cinema",
    promptTemplate:
      "{subject}, epic wide shot of towering desert dunes, heat shimmer, tiny lone figure, vast sky, warm cinematic color grade, 70mm",
    settings: { aspectRatio: "16:9", resolution: "1080p" },
    category: "Worlds",
    order: 11,
  },
  {
    slug: "fashion-editorial",
    title: "Fashion Editorial",
    description:
      "High-fashion magazine frames with bold styling and hard flash.",
    surface: "image",
    modelId: "soul-2",
    promptTemplate:
      "{subject}, high fashion editorial photograph, bold avant-garde styling, direct hard flash, glossy magazine look, strong pose",
    settings: { aspectRatio: "3:4", resolution: "1080p" },
    category: "Portrait",
    order: 12,
  },
]
