import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { db, mediaAssets, mediaContents } from "@workspace/db";
import {
  RequestMediaUploadBody, RequestMediaUploadResponse, CompleteMediaUploadParams,
  CompleteMediaUploadResponse, ListMediaAssetsResponse, DeleteMediaAssetParams, DownloadMediaAssetParams,
} from "@workspace/api-zod";
import { requireRestaurant, accessibleAsset, mediaActivity } from "../../lib/media-access";
import { assetJson, newMediaId, restaurantAssets } from "../../lib/media-service";
import { mediaStorage, deleteMediaObject, savePrivateMediaFile } from "../../lib/media-renderer";
import { OpsError } from "../../lib/ops-types";
import { sendPrivateMediaFile } from "../../lib/media-download";

const router: IRouter = Router();
router.get("/media/assets", async (req, res): Promise<void> => {
  const restaurant = await requireRestaurant(req);
  res.json(ListMediaAssetsResponse.parse((await restaurantAssets(restaurant.id)).map(assetJson)));
});
router.post("/media/uploads", async (req, res): Promise<void> => {
  const parsed = RequestMediaUploadBody.safeParse(req.body);
  if (!parsed.success) throw new OpsError(400, "Use JPEG, PNG, WebP photos or PDF menus up to 10MB");
  const data = parsed.data;
  if ((data.kind === "photo") !== data.contentType.startsWith("image/")) {
    throw new OpsError(400, "Photos must be images and menus must be PDFs");
  }
  const restaurant = await requireRestaurant(req);
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(mediaAssets)
    .where(eq(mediaAssets.restaurantId, restaurant.id));
  if ((total?.n || 0) >= 60) throw new OpsError(429, "This preview supports up to 60 uploads. Delete unused files first.");
  const uploadURL = await mediaStorage.getObjectEntityUploadURL();
  const [row] = await db.insert(mediaAssets).values({
    id: newMediaId(), restaurantId: restaurant.id, ...data,
    objectPath: mediaStorage.normalizeObjectEntityPath(uploadURL),
  }).returning();
  res.json(RequestMediaUploadResponse.parse({ assetId: row!.id, uploadURL }));
});
router.post("/media/uploads/:assetId/complete", async (req, res): Promise<void> => {
  const { assetId } = CompleteMediaUploadParams.parse(req.params);
  const asset = await accessibleAsset(req, assetId);
  if (asset.complete) { res.json(CompleteMediaUploadResponse.parse(assetJson(asset))); return; }
  let bytes: Buffer;
  try {
    const file = await mediaStorage.getObjectEntityFile(asset.objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) !== asset.size || metadata.contentType !== asset.contentType) {
      throw new OpsError(400, "Uploaded file does not match its declared size or type");
    }
    [bytes] = await file.download();
  } catch (error) {
    if (error instanceof OpsError) throw error;
    throw new OpsError(400, "Upload the file before completing this upload");
  }
  if (asset.kind === "photo") {
    let format: string | undefined;
    try { format = (await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata()).format; }
    catch { throw new OpsError(400, "This image is invalid or too large to process"); }
    const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
    if (format !== formats[asset.contentType]) throw new OpsError(400, "Photo bytes do not match the selected image type");
  } else if (bytes.subarray(0, 5).toString() !== "%PDF-") {
    throw new OpsError(400, "This menu is not a valid PDF");
  }
  // Freeze a verified copy. The client cannot overwrite it with a still-valid
  // PUT URL after verification and have different bytes served as trusted data.
  const objectPath = await savePrivateMediaFile(bytes, asset.contentType, randomUUID());
  const [saved] = await db.update(mediaAssets).set({ complete: true, objectPath })
    .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.complete, false))).returning();
  if (!saved) {
    await deleteMediaObject(objectPath);
    const current = await accessibleAsset(req, asset.id);
    res.json(CompleteMediaUploadResponse.parse(assetJson(current))); return;
  }
  await deleteMediaObject(asset.objectPath);
  await mediaActivity(asset.restaurantId, `${asset.kind === "photo" ? "Photo" : "Menu"} uploaded: ${asset.name}`);
  res.json(CompleteMediaUploadResponse.parse(assetJson(saved)));
});
router.get("/media/assets/:assetId", async (req, res): Promise<void> => {
  const { assetId } = DownloadMediaAssetParams.parse(req.params);
  const asset = await accessibleAsset(req, assetId);
  if (!asset.complete) throw new OpsError(404, "Upload is not complete");
  await sendPrivateMediaFile(req, res, asset.objectPath, asset.contentType, asset.name, asset.kind === "photo");
});
router.delete("/media/assets/:assetId", async (req, res): Promise<void> => {
  const { assetId } = DeleteMediaAssetParams.parse(req.params);
  const asset = await accessibleAsset(req, assetId);
  const [inUse] = await db.select({ id: mediaContents.id }).from(mediaContents).where(eq(mediaContents.assetId, assetId)).limit(1);
  if (inUse) throw new OpsError(409, "This photo is used in content. Remove that content before deleting the photo.");
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  await deleteMediaObject(asset.objectPath);
  res.status(204).end();
});
export default router;
