export const SOUL_ASPECT = [
  "9:16",
  "16:9",
  "4:3",
  "3:4",
  "1:1",
  "2:3",
  "3:2",
] as const

export const SEEDANCE_ASPECT = [
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
] as const

/** Kling 3.0 / 2.6 / O3 / Omni. */
export const KLING_ASPECT = ["16:9", "9:16", "1:1"] as const

/** Wan 2.6 references, Wan 2.7 text, Happy Horse text. */
export const WAN_ASPECT = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const

/** Qwen Image 3 and Z-Image Turbo. */
export const QWEN_ASPECT = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "7:9",
  "9:7",
  "9:16",
  "16:9",
  "21:9",
] as const
