import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, mediaRestaurants } from "@workspace/db";
import {
  GetMediaDashboardResponse, SaveMediaRestaurantBody, SaveMediaRestaurantResponse,
  RequestMediaManagedServiceBody, RequestMediaManagedServiceResponse, CreateMediaCheckoutBody,
} from "@workspace/api-zod";
import { mediaUser, requireRestaurant, mediaActivity, publicHttpsUrl } from "../../lib/media-access";
import { dashboard, newMediaId, restaurantJson } from "../../lib/media-service";
import { OpsError } from "../../lib/ops-types";

const router: IRouter = Router();
router.get("/media/dashboard", async (req, res): Promise<void> => {
  res.json(GetMediaDashboardResponse.parse(await dashboard(mediaUser(req))));
});
router.put("/media/restaurant", async (req, res): Promise<void> => {
  const result = SaveMediaRestaurantBody.safeParse(req.body);
  if (!result.success) throw new OpsError(400, "Enter a restaurant name and valid profile fields");
  const data = { ...result.data, name: result.data.name.trim() };
  if (!data.name) throw new OpsError(400, "Enter your restaurant name");
  if (data.website) data.website = publicHttpsUrl(data.website);
  const [row] = await db.insert(mediaRestaurants).values({ id: newMediaId(), userId: mediaUser(req), ...data })
    .onConflictDoUpdate({ target: mediaRestaurants.userId, set: { ...data, updatedAt: new Date() } }).returning();
  await mediaActivity(row!.id, "Restaurant profile saved");
  res.json(SaveMediaRestaurantResponse.parse(restaurantJson(row!)));
});
router.post("/media/managed-request", async (req, res): Promise<void> => {
  const result = RequestMediaManagedServiceBody.safeParse(req.body);
  if (!result.success) throw new OpsError(400, "Describe your restaurant goals in at least 10 characters");
  const restaurant = await requireRestaurant(req);
  await db.update(mediaRestaurants).set({ managedBrief: result.data.brief, requestedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaRestaurants.id, restaurant.id));
  await mediaActivity(restaurant.id, "Managed service brief sent to Sless Media Group. No charge collected.");
  res.json(RequestMediaManagedServiceResponse.parse(await dashboard(mediaUser(req))));
});
router.post("/media/checkout", (req, _res) => {
  const result = CreateMediaCheckoutBody.safeParse(req.body);
  if (!result.success) throw new OpsError(400, "Choose an approved package");
  throw new OpsError(503, "Billing is inactive during launch preview. No charge has been made. Monthly subscriptions require owner approval after cost and customer-flow verification.");
});
export default router;
