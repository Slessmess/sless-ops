import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, mediaRestaurants, mediaContents, mediaAssets, mediaLinks, mediaActivities,
  mediaBudgets, type MediaRestaurantRow, type MediaContentRow, type MediaAssetRow,
} from "@workspace/db";
import { isMediaAdmin } from "./media-access";
import { OpsError } from "./ops-types";

// Deliberate launch boundary: this is not switched on by a client plan choice,
// an environment default, a callback URL, or a successful payment-link visit.
export const MEDIA_BILLING_ACTIVE = false;
export const mediaPlans = {
  plans: [
    { id: "self_service" as const, name: "Self-service", price: 99, videos: 4, posts: 12,
      description: "Create your own restaurant content with AI-assisted captions and downloadable social assets." },
    { id: "managed" as const, name: "Managed", price: 499, videos: 8, posts: 20,
      description: "Sless Media Group creates your content. You review, approve and download it." },
  ],
  billingActive: MEDIA_BILLING_ACTIVE,
  automaticPublishing: false,
  generationAvailable: Boolean(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.PRIVATE_OBJECT_DIR),
  launchNote: "Launch preview. No payment is collected. Preview includes one AI post and one AI video per account, with a shared daily safety limit. Videos are silent photo-based 15-second MP4s. Calendar dates are planning only; download and publish manually. Final monthly plans activate only after cost and customer-flow verification.",
};

export function restaurantJson(row: MediaRestaurantRow) {
  const { userId: _userId, managedBrief: _brief, requestedAt: _requested, ...profile } = row;
  return { ...profile, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function contentJson(row: MediaContentRow) {
  const { objectPath, previewObjectPath: _preview, updatedAt: _updated, ...item } = row;
  const url = `/api/media/content/${row.id}/download`;
  return { ...item, createdAt: row.createdAt.toISOString(), downloadUrl: url,
    previewUrl: objectPath ? `${url}?preview=1&v=${row.updatedAt.getTime()}` : null };
}
export function assetJson(row: MediaAssetRow) {
  return { id: row.id, name: row.name, size: row.size, contentType: row.contentType,
    kind: row.kind, url: `/api/media/assets/${row.id}`, createdAt: row.createdAt.toISOString() };
}
export async function restaurantContent(restaurantId: string) {
  // A process interruption must not leave the library locked forever. This
  // never repeats an AI call; it only exposes a failed draft for manual repair.
  await db.execute(sql`UPDATE media_contents
    SET status = 'failed', error = 'Generation was interrupted. The draft is preserved; no automatic retry was made.'
    WHERE restaurant_id = ${restaurantId} AND status = 'generating'
      AND updated_at < NOW() - INTERVAL '5 minutes'`);
  return db.select().from(mediaContents).where(eq(mediaContents.restaurantId, restaurantId)).orderBy(desc(mediaContents.createdAt));
}
export async function restaurantAssets(restaurantId: string) {
  return db.select().from(mediaAssets).where(and(
    eq(mediaAssets.restaurantId, restaurantId), eq(mediaAssets.complete, true),
  )).orderBy(desc(mediaAssets.createdAt));
}
export async function dashboard(userId: string) {
  const [restaurant] = await db.select().from(mediaRestaurants).where(eq(mediaRestaurants.userId, userId));
  const content = restaurant ? await restaurantContent(restaurant.id) : [];
  const links = restaurant ? await db.select().from(mediaLinks).where(eq(mediaLinks.restaurantId, restaurant.id)) : [];
  const activity = restaurant ? await db.select().from(mediaActivities).where(eq(mediaActivities.restaurantId, restaurant.id))
    .orderBy(desc(mediaActivities.createdAt)).limit(8) : [];
  const budgetRows = await db.select().from(mediaBudgets).where(sql`${mediaBudgets.key} in (${`ai:${userId}:post`}, ${`ai:${userId}:video`})`);
  const budget = new Map(budgetRows.map((row) => [row.key, row.count]));
  return {
    restaurant: restaurant ? restaurantJson(restaurant) : null,
    contentCount: content.length, pendingApprovals: content.filter((c) => c.status === "needs_approval").length,
    scheduledCount: content.filter((c) => c.scheduledDate).length,
    linkClicks: links.reduce((sum, l) => sum + l.clicks, 0),
    usage: { videos: budget.get(`ai:${userId}:video`) || 0, posts: budget.get(`ai:${userId}:post`) || 0,
      videoLimit: 1, postLimit: 1, preview: true },
    isAdmin: isMediaAdmin(userId),
    plan: restaurant?.requestedAt ? "managed_requested" as const : "preview" as const,
    managedBrief: restaurant?.managedBrief || "", billingActive: MEDIA_BILLING_ACTIVE,
    recentActivity: activity.map((a) => ({ id: a.id, message: a.message, createdAt: a.createdAt.toISOString() })),
  };
}

export async function claimMediaBudget(userId: string, kind: "post" | "video", action: "ai" | "render") {
  const day = new Date().toISOString().slice(0, 10);
  const caps = action === "ai"
    ? [{ key: `ai:${userId}:${kind}`, limit: 1 }, { key: `ai:global:${day}`, limit: 6 }]
    : [{ key: `render:${userId}:${day}`, limit: 10 }, { key: `render:global:${day}`, limit: 40 }];
  await db.transaction(async (tx) => {
    // Sort locks globally to prevent competing requests acquiring in opposite order.
    for (const cap of caps.sort((a, b) => a.key.localeCompare(b.key))) {
      const result = await tx.execute(sql`
        INSERT INTO media_budgets (key, count) VALUES (${cap.key}, 1)
        ON CONFLICT (key) DO UPDATE SET count = media_budgets.count + 1
        WHERE media_budgets.count < ${cap.limit} RETURNING count`);
      if (!result.rows.length) throw new OpsError(429,
        action === "ai" ? "AI preview allowance or shared daily safety limit reached. Billing is not active."
          : "Today's rendering safety limit reached. Your saved draft is still available.");
    }
  });
}

export const newMediaId = () => randomUUID();
