import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, mediaRestaurants, mediaContents, mediaAssets, mediaActivities } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { OpsError } from "./ops-types";

export function mediaUser(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new OpsError(401, "Sign in to your restaurant workspace");
  return userId;
}

export function isMediaAdmin(userId: string): boolean {
  return (process.env.SLESS_OPS_ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).includes(userId);
}

export const requireMediaUser: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  mediaUser(req);
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.origin;
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0]?.trim();
    let valid = false;
    try { valid = origin ? new URL(origin).host === host : /^Bearer /i.test(req.headers.authorization || ""); } catch {}
    if (!valid) throw new OpsError(403, "Cross-origin workspace requests are not allowed");
  }
  next();
};

export async function ownRestaurant(req: Request) {
  const [restaurant] = await db.select().from(mediaRestaurants).where(eq(mediaRestaurants.userId, mediaUser(req)));
  return restaurant;
}

export async function requireRestaurant(req: Request) {
  const restaurant = await ownRestaurant(req);
  if (!restaurant) throw new OpsError(409, "Save your restaurant profile first");
  return restaurant;
}

export async function accessibleRestaurant(req: Request, id: string) {
  const [restaurant] = await db.select().from(mediaRestaurants).where(eq(mediaRestaurants.id, id));
  if (!restaurant || (restaurant.userId !== mediaUser(req) && !isMediaAdmin(mediaUser(req)))) {
    throw new OpsError(404, "Restaurant not found");
  }
  return restaurant;
}

export async function accessibleContent(req: Request, id: string) {
  const [content] = await db.select().from(mediaContents).where(eq(mediaContents.id, id));
  if (!content) throw new OpsError(404, "Content not found");
  const restaurant = await accessibleRestaurant(req, content.restaurantId);
  return { content, restaurant };
}

export async function accessibleAsset(req: Request, id: string) {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
  if (!asset) throw new OpsError(404, "Upload not found");
  await accessibleRestaurant(req, asset.restaurantId);
  return asset;
}

export async function photoForRestaurant(restaurantId: string, assetId?: string | null) {
  if (!assetId) return null;
  const [asset] = await db.select().from(mediaAssets).where(and(
    eq(mediaAssets.id, assetId), eq(mediaAssets.restaurantId, restaurantId), eq(mediaAssets.complete, true),
  ));
  if (!asset || asset.kind !== "photo") throw new OpsError(400, "Choose a verified photo from this restaurant");
  return asset;
}

export async function mediaActivity(restaurantId: string, message: string) {
  await db.insert(mediaActivities).values({ id: randomUUID(), restaurantId, message });
}

export function validCalendarDate(value?: string | null): void {
  if (!value) return;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new OpsError(400, "Choose a real calendar date");
  }
}

export function publicHttpsUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new OpsError(400, "Enter a valid HTTPS website address"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !url.hostname.includes(".") || url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".localhost") || url.hostname.endsWith(".internal") ||
      /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) {
    throw new OpsError(400, "Use a public HTTPS website, without credentials or a custom port");
  }
  return url.href;
}
