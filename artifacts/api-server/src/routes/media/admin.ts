import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, mediaRestaurants } from "@workspace/db";
import {
  ListMediaClientsResponse, ListMediaClientContentParams, ListMediaClientContentResponse,
  CreateMediaClientContentParams, CreateMediaClientContentResponse, ListMediaClientAssetsParams,
  ListMediaClientAssetsResponse,
} from "@workspace/api-zod";
import { requireOpsAdmin } from "../../middlewares/ops-admin";
import { accessibleRestaurant } from "../../lib/media-access";
import { restaurantContent, restaurantJson, contentJson, restaurantAssets, assetJson } from "../../lib/media-service";
import { produceMediaContent } from "../../lib/media-production";

const router: IRouter = Router();
router.use("/media/admin", requireOpsAdmin);
router.get("/media/admin/clients", async (_req, res): Promise<void> => {
  const restaurants = await db.select().from(mediaRestaurants).orderBy(desc(mediaRestaurants.requestedAt));
  const clients = await Promise.all(restaurants.map(async (restaurant) => {
    const contents = await restaurantContent(restaurant.id);
    return { id: restaurant.id, restaurant: restaurantJson(restaurant), managedBrief: restaurant.managedBrief,
      requestedAt: restaurant.requestedAt?.toISOString() || null, contentCount: contents.length,
      pendingApprovals: contents.filter((c) => c.status === "needs_approval").length };
  }));
  res.json(ListMediaClientsResponse.parse(clients));
});
router.get("/media/admin/clients/:clientId/content", async (req, res): Promise<void> => {
  const { clientId } = ListMediaClientContentParams.parse(req.params);
  await accessibleRestaurant(req, clientId);
  res.json(ListMediaClientContentResponse.parse((await restaurantContent(clientId)).map(contentJson)));
});
router.get("/media/admin/clients/:clientId/assets", async (req, res): Promise<void> => {
  const { clientId } = ListMediaClientAssetsParams.parse(req.params);
  await accessibleRestaurant(req, clientId);
  res.json(ListMediaClientAssetsResponse.parse((await restaurantAssets(clientId)).map(assetJson)));
});
router.post("/media/admin/clients/:clientId/content", async (req, res): Promise<void> => {
  const { clientId } = CreateMediaClientContentParams.parse(req.params);
  const restaurant = await accessibleRestaurant(req, clientId);
  res.status(201).json(CreateMediaClientContentResponse.parse(contentJson(await produceMediaContent(restaurant, req.body, true))));
});
export default router;
