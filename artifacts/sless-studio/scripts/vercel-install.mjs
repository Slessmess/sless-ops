import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import ffmpeg from "ffmpeg-static"

// pnpm can skip dependency lifecycle scripts. Vercel has no system FFmpeg,
// so explicitly install this one approved dependency's bundled executable.
if (!ffmpeg) throw new Error("ffmpeg-static does not support this platform")
if (!existsSync(ffmpeg)) {
  const require = createRequire(import.meta.url)
  const result = spawnSync(process.execPath, [require.resolve("ffmpeg-static/install.js")], {
    stdio: "inherit",
    timeout: 180_000,
  })
  if (result.status !== 0) throw new Error("Bundled FFmpeg installation failed")
}
const probe = spawnSync(ffmpeg, ["-version"], { encoding: "utf8", timeout: 10_000 })
if (probe.status !== 0) throw new Error("Bundled FFmpeg is not executable on this host")
console.info(`[studio-install] ${probe.stdout.split("\n")[0]}`)
