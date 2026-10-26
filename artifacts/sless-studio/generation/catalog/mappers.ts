import type {
  GenerationPlane,
  MediaRole,
  PlatformPaths,
  PlatformRequest,
  SettingField,
} from "./types"

/* ── Small helpers every model mapper shares ──────────────────────────────── */

export function urls(plane: GenerationPlane, role: MediaRole): string[] {
  return (plane.media[role] ?? []).map((item) => item.url)
}

export function first(
  plane: GenerationPlane,
  role: MediaRole
): string | undefined {
  return urls(plane, role)[0]
}

/** The trimmed prompt, or undefined when empty (for endpoints where it is optional). */
export function promptText(plane: GenerationPlane): string | undefined {
  const text = plane.prompt.text.trim()
  return text ? text : undefined
}

/** The trimmed prompt; throws with a readable message when it is empty. */
export function requirePrompt(plane: GenerationPlane, label: string): string {
  const text = promptText(plane)
  if (!text) throw new Error(`Enter a prompt to use ${label}.`)
  return text
}

/** Drop undefined values so optional fields are omitted, never sent as null. */
export function compact(
  body: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined)
  )
}

/** Settings with an "auto" choice map to "omit the field" (the API picks). */
export function unlessAuto(value: unknown): string | undefined {
  return typeof value === "string" && value !== "auto" ? value : undefined
}

/** Enum settings holding numbers ("5", "10") become integers in the body. */
export function int(value: unknown): number | undefined {
  if (typeof value === "number") return Math.round(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined
  }
  return undefined
}

export function hasAny(plane: GenerationPlane, roles: MediaRole[]): boolean {
  return roles.some((role) => (plane.media[role]?.length ?? 0) > 0)
}

/** Frames and references are separate workflows on most endpoints. */
export function assertFramesOrReferences(
  plane: GenerationPlane,
  referenceRoles: MediaRole[] = ["reference", "video", "audio"]
): void {
  if (hasAny(plane, ["start", "end"]) && hasAny(plane, referenceRoles))
    throw new Error(
      "Use either frames or references, not both. Remove incompatible attachments."
    )
  if (first(plane, "end") && !first(plane, "start"))
    throw new Error("Add a start frame before using an end frame.")
}

/** Boolean toggle → the "on" / "off" strings some endpoints expect (Kling `sound`). */
export function onOff(value: unknown): "on" | "off" | undefined {
  return typeof value === "boolean" ? (value ? "on" : "off") : undefined
}

/** Boolean toggle → the "yes" / "no" strings some endpoints expect. */
export function yesNo(value: unknown): "yes" | "no" | undefined {
  return typeof value === "boolean" ? (value ? "yes" : "no") : undefined
}

/** Throws unless at least one of `roles` has an attachment (e.g. audio alone is not enough). */
export function assertAnyOf(
  plane: GenerationPlane,
  roles: MediaRole[],
  message: string
): void {
  if (!hasAny(plane, roles)) throw new Error(message)
}

/* ── Setting helpers shared by model files ────────────────────────────────── */

/** "35mm-film" → "35mm film", "dolly_in" → "Dolly in". */
export function humanize(value: string): string {
  const text = value.replace(/[-_]+/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Display labels for enum values: humanized unless overridden. */
export function labelsFor(
  values: readonly string[],
  overrides: Readonly<Record<string, string>> = {}
): Record<string, string> {
  return Object.fromEntries(
    values.map((value) => [value, overrides[value] ?? humanize(value)])
  )
}

/**
 * An optional creative enum the API lets you omit: "Auto" first (mapped with
 * `unlessAuto`, so the field is left out and the model chooses), then the
 * documented values.
 */
export function autoEnum(
  values: readonly string[],
  label: string,
  overrides: Readonly<Record<string, string>> = {}
): SettingField {
  const all = ["auto", ...values]
  return {
    type: "enum",
    values: all,
    default: "auto",
    label,
    labels: labelsFor(all, { auto: "Auto", ...overrides }),
  }
}

/* ── Generic path mapper (kept from the template for simple models) ───────── */

/** Generic mapper: picks a path from `spec` by which media roles are filled. */
export function mapByPaths(
  plane: GenerationPlane,
  spec: PlatformPaths
): PlatformRequest {
  const start = urls(plane, "start")[0]
  const end = urls(plane, "end")[0]
  const refs = urls(plane, "reference")
  const videos = urls(plane, "video")
  const body: Record<string, unknown> = {
    prompt: plane.prompt.text,
    ...(plane.settings.aspectRatio
      ? { aspect_ratio: plane.settings.aspectRatio }
      : {}),
    ...(plane.settings.resolution
      ? { resolution: plane.settings.resolution }
      : {}),
    ...(typeof plane.settings.duration === "number"
      ? { duration: plane.settings.duration }
      : {}),
  }
  if (spec.firstLast && (start || end)) {
    return {
      path: spec.firstLast,
      body: {
        ...body,
        ...(start ? { first_frame_url: start } : {}),
        ...(end ? { last_frame_url: end } : {}),
      },
    }
  }
  if (spec.image && start) {
    return {
      path: spec.image,
      body: {
        ...body,
        image_url: start,
        ...(end ? { last_image_url: end } : {}),
      },
    }
  }
  if (spec.reference && (refs.length || videos.length)) {
    return {
      path: spec.reference,
      body: {
        ...body,
        ...(refs.length ? { image_urls: refs } : {}),
        ...(videos.length ? { video_urls: videos } : {}),
      },
    }
  }
  if (spec.text) {
    return {
      path: spec.text,
      body: refs.length ? { ...body, image_urls: refs } : body,
    }
  }
  if (spec.image) return { path: spec.image, body }
  if (spec.reference) return { path: spec.reference, body }
  if (spec.firstLast) return { path: spec.firstLast, body }
  throw new Error("Model has no platform path")
}

/* ── Seedance (kept from the template; matches the documented schemas) ────── */

function seedanceBody(plane: GenerationPlane, withDuration: boolean) {
  return compact({
    prompt: promptText(plane),
    resolution: plane.settings.resolution,
    generate_audio: plane.settings.generateAudio,
    duration: withDuration ? plane.settings.duration : undefined,
    bitrate_mode: plane.settings.bitrateMode,
  })
}

/** Seedance text / image / reference-to-video under one model prefix. */
export function mapSeedance(
  plane: GenerationPlane,
  prefix: string
): PlatformRequest {
  const start = first(plane, "start")
  const end = first(plane, "end")
  const refs = urls(plane, "reference")
  const videos = urls(plane, "video")
  const audios = urls(plane, "audio")
  const shared = seedanceBody(plane, true)
  assertFramesOrReferences(plane)
  if (start) {
    return {
      path: `${prefix}/image-to-video`,
      body: compact({ ...shared, image_url: start, end_image_url: end }),
    }
  }
  if (refs.length || videos.length || audios.length) {
    return {
      path: `${prefix}/reference-to-video`,
      body: compact({
        ...shared,
        aspect_ratio: plane.settings.aspectRatio,
        image_urls: refs.length ? refs : undefined,
        video_urls: videos.length ? videos : undefined,
        audio_urls: audios.length ? audios : undefined,
      }),
    }
  }
  if (!promptText(plane)) throw new Error("Enter a prompt or add a reference.")
  return {
    path: `${prefix}/text-to-video`,
    body: { ...shared, aspect_ratio: plane.settings.aspectRatio },
  }
}

/** Seedance edit / extend: one source video plus optional references. */
export function mapSeedanceSource(
  plane: GenerationPlane,
  path: string,
  withDuration: boolean
): PlatformRequest {
  const video = first(plane, "source")
  const extraVideos = urls(plane, "video")
  const refs = urls(plane, "reference")
  const audios = urls(plane, "audio")
  return {
    path,
    body: compact({
      ...seedanceBody(plane, withDuration),
      video_url: video,
      image_urls: refs.length ? refs : undefined,
      video_urls: extraVideos.length ? extraVideos : undefined,
      audio_urls: audios.length ? audios : undefined,
    }),
  }
}

/* ── Kling motion control (3.0 and 2.6 share one documented schema) ────────── */

export const KLING_MOTION_SETTINGS = {
  keepOriginalSound: {
    type: "boolean",
    default: true,
    label: "Keep original sound",
    hint: "Carries the motion video's audio into the result.",
  },
  characterOrientation: {
    type: "enum",
    values: ["video", "image"],
    default: "video",
    label: "Orientation",
    labels: { video: "Match video", image: "Match image" },
    hint: "Face the way the character does in the motion video or in the image.",
  },
} as const satisfies Record<string, SettingField>

/**
 * Character image (`start` → image_url) driven by a motion video
 * (`source` → video_url). Output length follows the video, so no duration.
 */
export function mapKlingMotion(
  plane: GenerationPlane,
  path: string
): PlatformRequest {
  const image = first(plane, "start")
  const video = first(plane, "source")
  if (!image) throw new Error("Add a character image to transfer motion onto.")
  if (!video) throw new Error("Add a motion video to copy the movement from.")
  return {
    path,
    body: compact({
      prompt: promptText(plane),
      image_url: image,
      video_url: video,
      keep_original_sound: yesNo(plane.settings.keepOriginalSound),
      character_orientation: plane.settings.characterOrientation,
    }),
  }
}
