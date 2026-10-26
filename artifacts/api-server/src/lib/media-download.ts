import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { mediaStorage } from "./media-renderer";
import { OpsError } from "./ops-types";

export async function sendPrivateMediaFile(
  req: Request, res: Response, path: string, contentType: string, name: string, inline = false,
) {
  let file;
  try { file = await mediaStorage.getObjectEntityFile(path); }
  catch { throw new OpsError(404, "Saved file is unavailable"); }
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name.replace(/[\r\n]/g, ""))}`);
  res.setHeader("Accept-Ranges", "bytes");
  let start = 0, end = size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.status(416).setHeader("Content-Range", `bytes */${size}`); res.end(); return; }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), size - 1); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`); res.end(); return;
    }
    res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  res.setHeader("Content-Length", end - start + 1);
  await pipeline(file.createReadStream({ start, end }), res);
}
