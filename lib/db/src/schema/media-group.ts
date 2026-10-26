import { pgTable, text, integer, boolean, timestamp, date, index } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const mediaRestaurants = pgTable("media_restaurants", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull().default(""),
  location: text("location").notNull().default(""),
  tone: text("tone").notNull().default(""),
  description: text("description").notNull().default(""),
  menu: text("menu").notNull().default(""),
  website: text("website").notNull().default(""),
  managedBrief: text("managed_brief").notNull().default(""),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  ...timestamps,
});

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => mediaRestaurants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  kind: text("kind", { enum: ["photo", "menu"] }).notNull(),
  objectPath: text("object_path").notNull(),
  complete: boolean("complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("media_assets_restaurant_idx").on(table.restaurantId)]);

export const mediaContents = pgTable("media_contents", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => mediaRestaurants.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["post", "video"] }).notNull(),
  platform: text("platform", { enum: ["instagram", "facebook", "tiktok"] }).notNull(),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  status: text("status", { enum: ["draft", "generating", "needs_approval", "approved", "changes_requested", "failed"] }).notNull().default("draft"),
  assetId: text("asset_id").references(() => mediaAssets.id),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  feedback: text("feedback").notNull().default(""),
  objectPath: text("object_path"),
  previewObjectPath: text("preview_object_path"),
  error: text("error"),
  ...timestamps,
}, (table) => [index("media_content_restaurant_idx").on(table.restaurantId)]);

export const mediaLinks = pgTable("media_links", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => mediaRestaurants.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  destination: text("destination").notNull(),
  platform: text("platform", { enum: ["instagram", "facebook", "tiktok"] }).notNull(),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Usage is independent of content deletion. Atomic capped increments prevent
// concurrent requests or deleting drafts from resetting the preview allowance.
export const mediaBudgets = pgTable("media_budgets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
});

export const mediaActivities = pgTable("media_activities", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => mediaRestaurants.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("media_activity_restaurant_idx").on(table.restaurantId)]);

export type MediaRestaurantRow = typeof mediaRestaurants.$inferSelect;
export type MediaContentRow = typeof mediaContents.$inferSelect;
export type MediaAssetRow = typeof mediaAssets.$inferSelect;
