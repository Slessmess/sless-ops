/**
 * Media we generated ourselves (with Soul 2 and Kling 3.0) for marketing
 * surfaces: auth carousel, hero, model cards and how-it-works steps. Files
 * live in /public/media. Replace freely with newer generations.
 */
export const SHOWCASE = [
  {
    src: "/media/showcase/astronaut.jpg",
    chip: "Soul 2",
    title: "Frames with feeling",
    caption: "Portraits and stills with real skin, light and grain.",
  },
  {
    src: "/media/showcase/dancer.jpg",
    chip: "Seedance 2.5",
    title: "Motion that holds up",
    caption: "Up to 30-second shots from text, frames or references.",
  },
  {
    src: "/media/showcase/motorcycle.jpg",
    chip: "Kling 3.0",
    title: "Every model, one balance",
    caption: "Switch between 45+ image and video models in one studio.",
  },
  {
    src: "/media/showcase/koi.jpg",
    chip: "Effects",
    title: "Start from a look",
    caption: "Presets turn one idea into a finished style in a click.",
  },
] as const

/** Cover image per model family (picker cards and the model card). */
export const FAMILY_COVERS: Record<string, string> = {
  Seedance: "/media/models/seedance.jpg",
  Kling: "/media/models/kling.jpg",
  Wan: "/media/models/wan.jpg",
  "Cinema Studio": "/media/models/cinema-studio.jpg",
  MiniMax: "/media/models/minimax.jpg",
  "Happy Horse": "/media/models/happy-horse.jpg",
  LTX: "/media/models/ltx.jpg",
  PixVerse: "/media/models/pixverse.jpg",
  Grok: "/media/models/grok.jpg",
  Genjutsu: "/media/showcase/dancer.jpg",
  Soul: "/media/showcase/astronaut.jpg",
  "Marketing Studio": "/media/models/marketing-studio.jpg",
  Recraft: "/media/presets/retro-anime.jpg",
  Qwen: "/media/models/qwen.jpg",
  Ideogram: "/media/models/ideogram.jpg",
  "Z-Image": "/media/models/z-image.jpg",
  "Sless Tools": "/media/models/audio-cleanup.svg",
}

/** Looping preview videos for model cards (falls back to the cover image). */
export const FAMILY_LOOPS: Record<string, string> = {
  Seedance: "/media/loops/seedance.mp4",
  Kling: "/media/loops/kling.mp4",
}

export function familyCover(
  family: string,
  surface: "image" | "video" | "audio"
): string {
  return (
    FAMILY_COVERS[family] ??
    (surface === "image"
      ? "/media/showcase/astronaut.jpg"
      : "/media/models/seedance.jpg")
  )
}

export const HERO = {
  image: "/media/hero/coast.jpg",
  video: "/media/loops/hero.mp4",
}

/** The three numbered entry cards under the home hero. */
export const CORNERS = [
  {
    href: "/video",
    kicker: "Seedance · Kling · Wan",
    title: "Video",
    body: "Text-to-video, image-to-video and reference-driven clips up to 30 seconds.",
    cta: "Open video generator",
    image: "/media/loops/seedance.jpg",
    video: "/media/loops/seedance.mp4",
  },
  {
    href: "/image",
    kicker: "Soul · Recraft · Ideogram",
    title: "Image",
    body: "Portraits, product photography and graphic design with accurate light and typography.",
    cta: "Open image generator",
    image: "/media/presets/fashion-editorial.jpg",
    video: undefined,
  },
  {
    href: "/effects",
    kicker: "Presets for image and video",
    title: "Effects",
    body: "Ready-made styles and camera moves. Choose a preset, add your subject and generate.",
    cta: "Browse effects",
    image: "/media/loops/bullet-time.jpg",
    video: "/media/loops/bullet-time.mp4",
  },
] as const

/** "How it works" steps on the generator canvas. */
export const STEPS = {
  video: [
    {
      title: "Add image",
      body: "Upload or generate an image to set the first frame.",
      image: "/media/steps/add.jpg",
    },
    {
      title: "Choose preset",
      body: "Pick a camera move or style, or write your own direction.",
      image: "/media/steps/preset.jpg",
    },
    {
      title: "Get video",
      body: "Press Generate and your clip lands in History.",
      image: "/media/steps/result.jpg",
    },
  ],
  image: [
    {
      title: "Describe it",
      body: "Write the scene, subject and mood you have in mind.",
      image: "/media/steps/preset.jpg",
    },
    {
      title: "Pick a model",
      body: "Soul for people, Recraft for design, Ideogram for text.",
      image: "/media/steps/add.jpg",
    },
    {
      title: "Get images",
      body: "Generate, then reuse the best one as a video start frame.",
      image: "/media/steps/result.jpg",
    },
  ],
  audio: [
    {
      title: "Write a prompt",
      body: "Describe the sound, voice or music you want.",
      image: "/media/steps/preset.jpg",
    },
    {
      title: "Add a reference",
      body: "Optionally attach audio to steer the result.",
      image: "/media/steps/add.jpg",
    },
    {
      title: "Get audio",
      body: "Listen, download or use it in a video.",
      image: "/media/steps/result.jpg",
    },
  ],
} as const
