/**
 * FFmpeg filter chains for Audio Cleanup (https://ffmpeg.org/ffmpeg-filters.html).
 * Pure strings, unit tested; lib/tools/audio-cleanup.ts runs them.
 *
 *   asoftclip + adeclip
 *             rebuild waveform peaks flattened by an overloaded mic. Cameras
 *             save that clipped sound as AAC, which smears the flat tops, so
 *             FFmpeg's de-clipper alone finds nothing to fix. We first square
 *             the smeared tops off again at 90 % of the clip level, then let
 *             adeclip (t=1) rebuild them. In tests on AAC clips with 1.3 % and
 *             6 % of samples clipped, this brought the sound 1.4–3.4 dB closer
 *             to what the mic heard and raised the STOI intelligibility score
 *             0.960 → 0.977 and 0.836 → 0.854. It only runs when the analysis
 *             finds clipping (see clippingProfile in ./ffmpeg.ts).
 *   highpass  removes rumble, handling and wind noise below speech
 *   lowpass   trims hiss and the fizz that distortion adds up high
 *   afftdn    spectral denoise (Strong only: it didn't raise intelligibility
 *             in tests, but makes steady hiss and hum easier to listen to)
 *   loudnorm  EBU R128 loudness (-16 LUFS, peaks under -1.5 dBTP), so the
 *             repaired track is loud enough and never clips again
 *
 * A compressor was tried and dropped: it lowered STOI from 0.962 to 0.883.
 */

export type Strength = "light" | "standard" | "strong"

/** Share of samples near the top that marks a track as clipped (clean speech: ~0.04 %). */
export const CLIPPED_SHARE = 0.0015

/**
 * De-clipping for a track whose clip level is `top` (|sample| at the 99.99th
 * percentile), or nothing when the track isn't clipped.
 */
export function declipChain(
  clip: { top: number; share: number } | null
): string[] {
  if (!clip || clip.share < CLIPPED_SHARE || clip.top <= 0) return []
  const level = Math.min(0.99, Math.max(0.05, clip.top * 0.9))
  return [`asoftclip=type=hard:threshold=${level.toFixed(4)}`, "adeclip=t=1"]
}

/**
 * Speech is processed in mono (most camera mics are mono anyway, and the
 * de-clipper costs time per channel); the encoder writes it to both sides.
 * rematrix_maxval=1 averages the channels instead of FFmpeg's default +3 dB
 * sum, so a clipped stereo track keeps its clip level at full scale.
 * clippingProfile measures this same downmix, so the levels match.
 */
export const MONO =
  "aresample=out_chlayout=mono:rematrix_maxval=1,aformat=channel_layouts=mono"

const LOUDNESS = ["loudnorm=I=-16:TP=-1.5:LRA=20", "aresample=48000"]

const SHAPING: Record<Strength, string[]> = {
  light: ["highpass=f=60"],
  standard: ["highpass=f=80", "lowpass=f=14000"],
  strong: [
    "highpass=f=100",
    "lowpass=f=9000",
    "afftdn=nr=10:nf=-30:tn=1",
    "equalizer=f=300:t=q:w=1:g=-2",
  ],
}

/** After AI isolation the background is already gone: no denoise or EQ. */
const AFTER_ISOLATION: Record<Strength, string[]> = {
  light: ["highpass=f=60"],
  standard: ["highpass=f=80", "lowpass=f=14000"],
  strong: ["highpass=f=100", "lowpass=f=9000"],
}

export function strengthOf(value: unknown): Strength {
  return value === "light" || value === "strong" ? value : "standard"
}

/** Chain for the audio sent to the AI isolator: mono and de-clipped, otherwise untouched. */
export function preIsolationChain(
  clip: { top: number; share: number } | null
): string {
  return [MONO, ...declipChain(clip)].join(",")
}

/**
 * Finishing chain after AI voice restoration (Studio Voice): only mono and
 * loudness. The model already rebuilt the full band, so no low-pass here.
 */
export function restoredChain(): string {
  return [MONO, ...LOUDNESS].join(",")
}

/**
 * The full chain for Repair, or the finishing chain after AI voice isolation
 * (de-clipping already ran before the audio went to the isolator).
 */
export function cleanupChain(
  strength: Strength,
  options: {
    clip?: { top: number; share: number } | null
    afterIsolation?: boolean
  } = {}
): string {
  return (
    options.afterIsolation
      ? [MONO, ...AFTER_ISOLATION[strength], ...LOUDNESS]
      : [
          MONO,
          ...declipChain(options.clip ?? null),
          ...SHAPING[strength],
          ...LOUDNESS,
        ]
  ).join(",")
}
