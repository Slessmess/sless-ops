import { createHash } from "node:crypto";
import { z } from "zod";
import { OpsError } from "./ops-types";
import type { TaskStore } from "./task-store";

const wpStatus = z.enum(["draft", "publish", "pending", "private"]);
const status = wpStatus.default("draft");
const text = z.string().trim().min(1).max(1000);
const content = z.string().max(2_000_000);
const wp = { title: text, content, wp_status: status, slug: z.string().max(200).default("") };
const name = z.string().trim().min(1).max(250);
// Creation is not legacy import: never accept status, result, identity or claims.
export const createTaskSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wp_page"), ...wp }).strict(),
  z.object({ type: z.literal("wp_post"), ...wp }).strict(),
  z.object({
    type: z.literal("wp_update"), wp_id: z.number().int().positive(), is_page: z.boolean().default(false),
    updates: z.object({
      title: text.optional(), content: content.optional(), status: wpStatus.optional(),
      slug: z.string().max(200).optional(),
    }).strict().refine((v) => Object.keys(v).length > 0, "At least one update is required"),
  }).strict(),
  z.object({ type: z.literal("stripe_product"), name, description: z.string().max(5000).default("") }).strict(),
  z.object({
    type: z.literal("stripe_link"), name, amount: z.number().int().min(0).max(99_999_999),
    redirect: z.string().url().refine((s) => {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    }, "Use a credential-free HTTPS return URL").default("https://slessismore.org/thank-you"),
    shipping: z.boolean().default(false),
  }).strict(),
]);

export async function createPendingTask(store: TaskStore, input: unknown, key: unknown) {
  const parsedKey = z.string().uuid().safeParse(key);
  const parsed = createTaskSchema.safeParse(input);
  if (!parsedKey.success || !parsed.success)
    throw new OpsError(400, "Provide a valid request key and all fields for the selected task type; do not include status or results");
  const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
  return store.create({
    ...parsed.data, id: `ops_${parsedKey.data}`, status: "pending",
    intakeFingerprint: fingerprint,
  });
}
