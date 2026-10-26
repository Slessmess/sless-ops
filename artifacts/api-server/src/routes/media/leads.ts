import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db, mediaLinks } from "@workspace/db";
import { CreateMediaLinkBody, CreateMediaLinkResponse, ListMediaLinksResponse, FollowMediaLinkParams } from "@workspace/api-zod";
import { requireMediaUser, requireRestaurant, publicHttpsUrl, mediaActivity } from "../../lib/media-access";
import { OpsError } from "../../lib/ops-types";
const router: IRouter = Router();
const linkJson = (row: typeof mediaLinks.$inferSelect) => ({
  id: row.id, slug: row.slug, label: row.label, destination: row.destination, platform: row.platform,
  clicks: row.clicks, createdAt: row.createdAt.toISOString(), url: `/api/media/go/${row.slug}`,
});
router.get("/media/go/:slug", async (req, res): Promise<void> => {
  const { slug } = FollowMediaLinkParams.parse(req.params);
  const [link] = await db.update(mediaLinks).set({ clicks: sql`${mediaLinks.clicks} + 1` }).where(eq(mediaLinks.slug, slug)).returning();
  if (!link) throw new OpsError(404, "This tracking link was not found");
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, link.destination);
});
router.get("/media/links", requireMediaUser, async (req, res): Promise<void> => {
  const restaurant = await requireRestaurant(req);
  const rows = await db.select().from(mediaLinks).where(eq(mediaLinks.restaurantId, restaurant.id)).orderBy(desc(mediaLinks.createdAt));
  res.json(ListMediaLinksResponse.parse(rows.map(linkJson)));
});
router.post("/media/links", requireMediaUser, async (req, res): Promise<void> => {
  const parsed = CreateMediaLinkBody.safeParse(req.body);
  if (!parsed.success) throw new OpsError(400, "Enter a link label, public HTTPS destination and platform");
  const restaurant = await requireRestaurant(req);
  const destination = publicHttpsUrl(parsed.data.destination);
  const slug = randomUUID().replace(/-/g, "").slice(0, 16);
  const [row] = await db.insert(mediaLinks).values({
    id: randomUUID(), slug, restaurantId: restaurant.id, ...parsed.data, destination,
  }).returning();
  await mediaActivity(restaurant.id, `Created tracking link: ${parsed.data.label}`);
  res.status(201).json(CreateMediaLinkResponse.parse(linkJson(row!)));
});
export default router;
