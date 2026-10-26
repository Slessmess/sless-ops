/**
 * Header-only media probes: image dimensions (PNG, JPEG, WebP, GIF), MP4/MOV
 * duration and video-track size (moov/mvhd + tkhd), and WAV duration. No
 * ffprobe needed, so it runs on serverless hosts.
 */
export type ProbeResult = {
  width?: number
  height?: number
  durationSec?: number
}

export function probeMedia(buffer: Buffer, contentType: string): ProbeResult {
  try {
    if (contentType.startsWith("image/")) return probeImage(buffer)
    if (contentType === "video/mp4" || contentType === "video/quicktime")
      return probeMp4(buffer)
    if (/audio\/(x-)?wav/.test(contentType)) return probeWav(buffer)
  } catch {
    /* corrupt or truncated file: no metadata, not an error */
  }
  return {}
}

export function probeImage(b: Buffer): ProbeResult {
  // PNG: signature + IHDR.
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47)
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  // GIF: logical screen size.
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF")
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X.
  if (
    b.length > 30 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = b.toString("ascii", 12, 16)
    if (chunk === "VP8 ")
      return {
        width: b.readUInt16LE(26) & 0x3fff,
        height: b.readUInt16LE(28) & 0x3fff,
      }
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === "VP8X")
      return {
        width: 1 + b.readUIntLE(24, 3),
        height: 1 + b.readUIntLE(27, 3),
      }
  }
  // JPEG: walk markers to the first SOFn.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = b[offset + 1]!
      if (
        marker === 0xd8 ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        offset += 2
        continue
      }
      const length = b.readUInt16BE(offset + 2)
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      if (isSof)
        return {
          height: b.readUInt16BE(offset + 5),
          width: b.readUInt16BE(offset + 7),
        }
      offset += 2 + length
    }
  }
  return {}
}

type Box = { type: string; start: number; end: number; header: number }

function* boxes(b: Buffer, start: number, end: number): Generator<Box> {
  let offset = start
  while (offset + 8 <= end) {
    let size = b.readUInt32BE(offset)
    const type = b.toString("ascii", offset + 4, offset + 8)
    let header = 8
    if (size === 1) {
      if (offset + 16 > end) return
      size = Number(b.readBigUInt64BE(offset + 8))
      header = 16
    } else if (size === 0) {
      size = end - offset
    }
    if (size < header || offset + size > end) return
    yield { type, start: offset, end: offset + size, header }
    offset += size
  }
}

function child(b: Buffer, parent: Box, type: string): Box | undefined {
  for (const box of boxes(b, parent.start + parent.header, parent.end))
    if (box.type === type) return box
  return undefined
}

export function probeMp4(b: Buffer): ProbeResult {
  let moov: Box | undefined
  for (const box of boxes(b, 0, b.length)) if (box.type === "moov") moov = box
  if (!moov) return {}
  const result: ProbeResult = {}
  const mvhd = child(b, moov, "mvhd")
  if (mvhd) {
    const body = mvhd.start + mvhd.header
    const version = b[body]!
    const timescale =
      version === 1 ? b.readUInt32BE(body + 20) : b.readUInt32BE(body + 12)
    const duration =
      version === 1
        ? Number(b.readBigUInt64BE(body + 24))
        : b.readUInt32BE(body + 16)
    if (timescale > 0)
      result.durationSec = Math.round((duration / timescale) * 100) / 100
  }
  for (const trak of boxes(b, moov.start + moov.header, moov.end)) {
    if (trak.type !== "trak") continue
    const tkhd = child(b, trak, "tkhd")
    if (!tkhd) continue
    const body = tkhd.start + tkhd.header
    const version = b[body]!
    const at = body + (version === 1 ? 88 : 76)
    if (at + 8 > tkhd.end) continue
    const width = b.readUInt32BE(at) / 65536
    const height = b.readUInt32BE(at + 4) / 65536
    if (width > 0 && height > 0) {
      result.width = Math.round(width)
      result.height = Math.round(height)
      break
    }
  }
  return result
}

export function probeWav(b: Buffer): ProbeResult {
  if (
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WAVE"
  )
    return {}
  let byteRate = 0
  for (let offset = 12; offset + 8 <= b.length;) {
    const id = b.toString("ascii", offset, offset + 4)
    const size = b.readUInt32LE(offset + 4)
    if (id === "fmt ") byteRate = b.readUInt32LE(offset + 16)
    if (id === "data" && byteRate > 0)
      return { durationSec: Math.round((size / byteRate) * 100) / 100 }
    offset += 8 + size + (size % 2)
  }
  return {}
}
