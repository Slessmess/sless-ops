import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Task history only: Stripe remains the source of truth for products/prices.
export const opsTasks = pgTable("ops_tasks", {
  id: text("id").primaryKey(),
  position: serial("position").notNull(),
  document: jsonb("document").$type<Record<string, unknown>>().notNull(),
  claimToken: text("claim_token"),
  // No default/backfill: legacy processing tasks have an unknown start time.
  claimStartedAt: timestamp("claim_started_at", { withTimezone: true }),
}, (table) => [
  check("ops_tasks_document_id", sql`${table.document}->>'id' IS NOT NULL AND ${table.document}->>'id' = ${table.id}`),
  check("ops_tasks_status", sql`${table.document}->>'status' IS NOT NULL AND ${table.document}->>'status' IN ('pending', 'processing', 'completed', 'failed', 'change_requested')`),
]);