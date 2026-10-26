// Cinema Studio 4.0 — directed video with camera, look and story controls.
// Sources:
//   https://docs.higgsfield.ai/docs/models/cinema-studio-4
//   https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate
// One endpoint: text-to-video when no media is attached, reference-to-video
// when any media array is nonempty. Creative controls are omitted on "Auto"
// (the literal "auto" is not accepted by the API).
import { autoEnum, compact, requirePrompt, unlessAuto, urls } from "../mappers"
import type { ModelEntry } from "../types"

const DOCS = "https://docs.higgsfield.ai/docs/models/cinema-studio-4"

const PALETTES = [
  "static-noon",
  "twilight-fable",
  "back-row-kissing-seats",
  "on-the-other-side-of-the-porthole",
  "the-emerald-ambush",
  "highway-standoff",
  "the-faded-fresco",
  "oil-ochre",
  "the-mountain-convent",
  "ghost-in-the-code",
  "pink-velvet",
  "two-days-to-the-horizon",
  "industrial-fog",
  "stairs-go-up",
  "field-post",
  "home-is-the-next-gas-station",
  "glossy-flesh",
  "the-crimson-ballet",
  "neon-rain-at-midnight",
  "the-morning-after-rain",
  "the-iron-borough",
  "the-ground",
  "the-investigation",
  "turquoise-mirage",
  "a-dream-in-color",
  "breakfast-on-schedule",
  "favela-gold",
  "a-hotel-for-one",
  "after-dark",
  "crimson-vigi",
  "the-neighbors-saw-everything",
  "the-grey-channel",
  "mirage-at-noon",
  "bubblegum-boulevard",
  "yellow-room",
  "the-earth-keeps-things-reluctantly",
  "tropic-fever-dream",
  "bioluminescent-night",
  "dont-turn-it-off-im-watching",
  "the-silk-curtain-falls",
  "the-butterfly",
  "playtime",
  "wallpaper-romance",
  "overtime",
  "the-way-home-is-longer",
  "everyone-speaks-in-whispers",
  "runaway-summer",
  "amber-wasteland",
  "the-circus",
  "gasoline-sunset",
] as const

const MOVEMENTS = [
  "snorricam",
  "robot-arm",
  "tilt-up",
  "rack-focus",
  "tilt-down",
  "pov",
  "pan-left",
  "crane-up",
  "pan-right",
  "crane-down",
  "side-tracking",
  "pedestal-up",
  "pedestal-down",
  "handheld",
  "tracking",
  "drone-orbit",
  "dolly-zoom",
  "aerial-pullback",
  "static-shot",
  "bullet-time",
  "whip-pan",
  "slow-zoom-in",
  "arc-left",
  "slow-zoom-out",
  "arc-right",
  "truck-right",
  "dolly-in",
  "truck-left",
  "dolly-out",
  "slider-right",
  "crush-zoom",
  "slider-left",
  "helicopter-shot",
] as const

const cinemaStudio4: ModelEntry = {
  id: "cinema-studio-4",
  surface: "video",
  family: "Cinema Studio",
  provider: "Higgsfield",
  icon: "higgsfield",
  label: "Cinema Studio 4.0",
  description:
    "Direct the shot like a DP: pick genre, era, lighting, lens, camera and palette, or leave any of them on Auto.",
  bestFor: "Film-grade scenes with director-level control",
  badges: ["TOP", "NEW", "AUDIO"],
  category: "CINEMATIC",
  roles: { reference: 30, video: 10, audio: 10 },
  maxTotalMedia: 50,
  requirePrompt: true,
  settings: {
    aspectRatio: {
      type: "enum",
      values: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
      default: "16:9",
      label: "Aspect ratio",
    },
    duration: {
      type: "range",
      min: 4,
      max: 30,
      default: 5,
      unit: "s",
      label: "Duration",
    },
    resolution: {
      type: "enum",
      values: ["480p", "720p"],
      default: "720p",
      label: "Resolution",
    },
    generateAudio: {
      type: "boolean",
      default: true,
      label: "Generate audio",
      hint: "Native soundtrack and effects.",
    },
    genre: autoEnum(
      ["epic", "drama", "noir", "comedy", "horror", "action"],
      "Genre"
    ),
    era: autoEnum(["1960s", "1980s", "1990s", "2000s", "2020s"], "Era"),
    light: autoEnum(
      [
        "silhouette",
        "practicals",
        "window",
        "overhead-fall",
        "contre-jour",
        "soft-cross",
      ],
      "Lighting",
      { "overhead-fall": "Overhead falloff" }
    ),
    pacing: autoEnum(["chaotic", "dynamic", "calm", "single-shot"], "Pacing"),
    cameraLens: autoEnum(
      [
        "clean-sharp",
        "anamorphic",
        "vintage-anamorphic",
        "warm-vintage",
        "halation-vintage",
      ],
      "Lens",
      { "clean-sharp": "Clean and sharp" }
    ),
    cameraModel: autoEnum(
      ["modern", "35mm-film", "8mm-film", "dv-camcorder"],
      "Camera",
      { "dv-camcorder": "DV camcorder" }
    ),
    cameraAperture: autoEnum(
      ["f14-wide-open", "f4-moderate", "f11-deep-focus"],
      "Aperture",
      {
        "f14-wide-open": "Wide open",
        "f4-moderate": "Moderate",
        "f11-deep-focus": "Deep focus",
      }
    ),
    cameraMovement: autoEnum(MOVEMENTS, "Camera movement", {
      pov: "POV",
      "slow-zoom-in": "Slow zoom in",
      "slow-zoom-out": "Slow zoom out",
    }),
    colorPalette: autoEnum(PALETTES, "Color palette", {
      "dont-turn-it-off-im-watching": "Don't turn it off, I'm watching",
      "the-neighbors-saw-everything": "The neighbors saw everything",
    }),
  },
  order: 120,
  docs: [DOCS, `${DOCS}/generate`],
  toPlatform: (plane) => {
    const refs = urls(plane, "reference")
    const videos = urls(plane, "video")
    const audios = urls(plane, "audio")
    const s = plane.settings
    return {
      path: "higgsfield/cinema-studio/4.0",
      body: compact({
        prompt: requirePrompt(plane, "Cinema Studio 4.0"),
        duration: s.duration,
        resolution: s.resolution,
        aspect_ratio: s.aspectRatio,
        generate_audio: s.generateAudio,
        genre: unlessAuto(s.genre),
        era: unlessAuto(s.era),
        light: unlessAuto(s.light),
        pacing: unlessAuto(s.pacing),
        camera_lens: unlessAuto(s.cameraLens),
        camera_model: unlessAuto(s.cameraModel),
        camera_aperture: unlessAuto(s.cameraAperture),
        camera_movement: unlessAuto(s.cameraMovement),
        color_palette: unlessAuto(s.colorPalette),
        image_urls: refs.length ? refs : undefined,
        video_urls: videos.length ? videos : undefined,
        audio_urls: audios.length ? audios : undefined,
      }),
    }
  },
}

export default cinemaStudio4
