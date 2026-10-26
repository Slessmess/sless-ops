import { eq, sql } from "drizzle-orm";
import { db, mediaContents, type MediaRestaurantRow, type MediaContentRow } from "@workspace/db";
import { CreateMediaContentBody } from "@workspace/api-zod";
import { mediaActivity, photoForRestaurant, validCalendarDate } from "./media-access";
import { claimMediaBudget, newMediaId } from "./media-service";
import { createRestaurantCopy, renderSocialMedia } from "./media-renderer";
import { OpsError } from "./ops-types";
import { logger } from "./logger";

export async function produceMediaContent(restaurant: MediaRestaurantRow, payload: unknown, ownerManaged = false) {
  const parsed = CreateMediaContentBody.safeParse(payload);
  if (!parsed.success) throw new OpsError(400, "Check the content title, platform and brief");
  const data = parsed.data;
  const title = data.title.trim();
  if (!title) throw new OpsError(400, "Enter a content title");
  validCalendarDate(data.scheduledDate);
  const photo = await photoForRestaurant(restaurant.id, data.assetId);
  if (data.generate && data.kind === "video" && !photo) throw new OpsError(400, "Choose a restaurant photo before generating a video");
  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(mediaContents).where(eq(mediaContents.restaurantId, restaurant.id));
  if ((total?.n || 0) >= 1000) throw new OpsError(429, "The preview content library is full");
  if (data.generate) {
    await claimMediaBudget(restaurant.userId, data.kind, "render");
    await claimMediaBudget(restaurant.userId, data.kind, "ai");
  }
  const [saved] = await db.insert(mediaContents).values({
    id: newMediaId(), restaurantId: restaurant.id, kind: data.kind, platform: data.platform,
    title, caption: data.caption, assetId: photo?.id || null, scheduledDate: data.scheduledDate || null,
    status: data.generate ? "generating" : ownerManaged ? "needs_approval" : "draft",
  }).returning();
  let item = saved!;
  if (data.generate) {
    try {
      const copy = await createRestaurantCopy(restaurant, item, data.prompt);
      const files = await renderSocialMedia(restaurant, { ...item, ...copy }, photo);
      const [complete] = await db.update(mediaContents).set({
        ...copy, ...files, status: "needs_approval", updatedAt: new Date(), error: null,
      }).where(eq(mediaContents.id, item.id)).returning();
      item = complete!;
    } catch (error) {
      logger.warn({ errorType: error instanceof Error ? error.name : "Unknown" }, "Restaurant content generation failed; draft preserved");
      const [failed] = await db.update(mediaContents).set({
        status: "failed", updatedAt: new Date(),
        error: "Generation failed or timed out. Your draft is preserved. Preview allowance is reserved to avoid duplicate provider charges; the owner can inspect the failure.",
      }).where(eq(mediaContents.id, item.id)).returning();
      item = failed!;
    }
  }
  await mediaActivity(restaurant.id, `${ownerManaged ? "Sless Media Group created" : "Created"} ${item.kind}: ${item.title}`);
  return item;
}
