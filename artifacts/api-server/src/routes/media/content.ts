import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, mediaContents } from "@workspace/db";
import {
  ListMediaContentResponse, CreateMediaContentResponse, UpdateMediaContentParams, UpdateMediaContentBody,
  UpdateMediaContentResponse, DeleteMediaContentParams, RenderMediaContentParams, RenderMediaContentResponse,
  DownloadMediaContentParams,
} from "@workspace/api-zod";
import {
  requireRestaurant, accessibleContent, photoForRestaurant, validCalendarDate, mediaActivity,
} from "../../lib/media-access";
import { contentJson, restaurantContent, claimMediaBudget } from "../../lib/media-service";
import { produceMediaContent } from "../../lib/media-production";
import { renderSocialMedia, deleteMediaObject } from "../../lib/media-renderer";
import { sendPrivateMediaFile } from "../../lib/media-download";
import { OpsError } from "../../lib/ops-types";

const router: IRouter = Router();
router.get("/media/content", async (req, res): Promise<void> => {
  const restaurant = await requireRestaurant(req);
  res.json(ListMediaContentResponse.parse((await restaurantContent(restaurant.id)).map(contentJson)));
});
router.post("/media/content", async (req, res): Promise<void> => {
  const restaurant = await requireRestaurant(req);
  res.status(201).json(CreateMediaContentResponse.parse(contentJson(await produceMediaContent(restaurant, req.body))));
});
router.patch("/media/content/:contentId", async (req, res): Promise<void> => {
  const { contentId } = UpdateMediaContentParams.parse(req.params);
  const { content, restaurant } = await accessibleContent(req, contentId);
  if (content.status === "generating") throw new OpsError(409, "Wait for this generation to finish before editing");
  const parsed = UpdateMediaContentBody.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) throw new OpsError(400, "Enter valid content changes");
  const data = parsed.data;
  validCalendarDate(data.scheduledDate);
  if (data.title !== undefined && !data.title.trim()) throw new OpsError(400, "Enter a content title");
  if (data.status === "changes_requested" && !(data.feedback ?? content.feedback).trim()) {
    throw new OpsError(400, "Describe the requested changes");
  }
  const titleChanged = data.title !== undefined && data.title !== content.title;
  // Editing the on-image title invalidates the old file; never let an approval
  // silently point to a graphic or video with obsolete words.
  const [saved] = await db.update(mediaContents).set({
    ...data, updatedAt: new Date(),
    ...(titleChanged ? { objectPath: null, previewObjectPath: null, status: "draft" as const } : {}),
  }).where(and(eq(mediaContents.id, contentId), ne(mediaContents.status, "generating"))).returning();
  if (!saved) throw new OpsError(409, "This item is currently rendering");
  if (titleChanged) await deleteMediaObject(content.objectPath);
  if (titleChanged) await deleteMediaObject(content.previewObjectPath);
  await mediaActivity(restaurant.id, `${data.status === "approved" ? "Approved" : data.status === "changes_requested" ? "Requested changes to" : "Updated"}: ${saved.title}`);
  res.json(UpdateMediaContentResponse.parse(contentJson(saved)));
});
router.delete("/media/content/:contentId", async (req, res): Promise<void> => {
  const { contentId } = DeleteMediaContentParams.parse(req.params);
  const { content } = await accessibleContent(req, contentId);
  if (content.status === "generating") throw new OpsError(409, "Wait for generation before deleting");
  const deleted = await db.delete(mediaContents).where(and(eq(mediaContents.id, contentId), ne(mediaContents.status, "generating"))).returning();
  if (!deleted.length) throw new OpsError(409, "Content is currently rendering");
  await deleteMediaObject(content.objectPath);
  await deleteMediaObject(content.previewObjectPath);
  res.status(204).end();
});
router.post("/media/content/:contentId/render", async (req, res): Promise<void> => {
  const { contentId } = RenderMediaContentParams.parse(req.params);
  const { content, restaurant } = await accessibleContent(req, contentId);
  const photo = await photoForRestaurant(restaurant.id, content.assetId);
  if (content.kind === "video" && !photo) throw new OpsError(400, "This video draft needs a restaurant photo");
  if (content.status === "generating") throw new OpsError(409, "Content is already rendering");
  // Content lock + budget in one transaction ensures a conflicting render
  // cannot double spend the allowance or overwrite another completion.
  const [claimed] = await db.update(mediaContents).set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(mediaContents.id, contentId), ne(mediaContents.status, "generating"))).returning();
  if (!claimed) throw new OpsError(409, "Content is already rendering");
  try {
    await claimMediaBudget(restaurant.userId, content.kind, "render");
    const files = await renderSocialMedia(restaurant, content, photo);
    const [saved] = await db.update(mediaContents).set({ ...files, status: "needs_approval", error: null, updatedAt: new Date() })
      .where(eq(mediaContents.id, contentId)).returning();
    await deleteMediaObject(content.objectPath);
    await deleteMediaObject(content.previewObjectPath);
    await mediaActivity(restaurant.id, `Rendered ${content.kind}: ${content.title}`);
    res.json(RenderMediaContentResponse.parse(contentJson(saved!)));
  } catch (error) {
    await db.update(mediaContents).set({ status: content.status, error: "Rendering failed; your existing draft is preserved", updatedAt: new Date() })
      .where(eq(mediaContents.id, contentId));
    if (error instanceof OpsError) throw error;
    throw new OpsError(502, "Rendering failed. Your existing draft is preserved.");
  }
});
router.get("/media/content/:contentId/download", async (req, res): Promise<void> => {
  const { contentId } = DownloadMediaContentParams.parse(req.params);
  const { content } = await accessibleContent(req, contentId);
  const name = content.title.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 80) || "restaurant-content";
  if (!content.objectPath) {
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}-caption.txt`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type("text/plain").send(`${content.title}\n\n${content.caption}\n`); return;
  }
  const isVideo = content.kind === "video";
  const webPreview = isVideo && req.query.preview === "1" && content.previewObjectPath;
  await sendPrivateMediaFile(req, res, webPreview || content.objectPath, webPreview ? "video/webm" : isVideo ? "video/mp4" : "image/png",
    `${name}.${webPreview ? "webm" : isVideo ? "mp4" : "png"}`, req.query.preview === "1" || req.query.preview === "mp4");
});
export default router;
