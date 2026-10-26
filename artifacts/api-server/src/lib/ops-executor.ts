import { createHash } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { z } from "zod";
import { OpsError, type OpsTask, type TaskResult } from "./ops-types";

const wpStatus = z.enum(["draft", "publish", "pending", "private", "future"]);
const wpFields = z.object({
  title: z.string().min(1).max(1000),
  content: z.string().max(2_000_000),
  wp_status: wpStatus.default("draft"),
  slug: z.string().max(200).default(""),
});
// Preserve arbitrary WordPress update fields from the Flask backend; the
// WordPress REST API validates the site-specific fields, taxonomy and metadata.
const wpUpdates = z.record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0, "At least one update is required");
const stripeName = z.string().min(1).max(250);
const productFields = z.object({
  name: stripeName,
  description: z.string().max(5000).default(""),
});
const linkFields = z.object({
  name: stripeName,
  amount: z.number().int().min(0).max(99_999_999),
  redirect: z.string().url().refine((value) => new URL(value).protocol === "https:", "Redirect must use HTTPS")
    .default("https://slessismore.org/thank-you"),
  shipping: z.boolean().default(false),
});

type PreparedTask =
  | { kind: "wp"; endpoint: string; data: Record<string, unknown> }
  | { kind: "product"; data: z.infer<typeof productFields> }
  | { kind: "link"; data: z.infer<typeof linkFields> };

export function prepareTask(task: OpsTask): PreparedTask {
  try {
    switch (task.type) {
      case "wp_page":
      case "wp_post": {
        const data = wpFields.parse(task);
        return {
          kind: "wp",
          endpoint: task.type === "wp_page" ? "pages" : "posts",
          data: { title: data.title, content: data.content, status: data.wp_status, slug: data.slug },
        };
      }
      case "wp_update": {
        // Separate queue identity from WordPress identity. Legacy numeric task
        // IDs remain compatible with the original Flask implementation.
        const wpId = z.coerce.number().int().positive().parse(task.wp_id ?? task.id);
        const isPage = z.boolean().default(false).parse(task.is_page);
        return { kind: "wp", endpoint: `${isPage ? "pages" : "posts"}/${wpId}`, data: wpUpdates.parse(task.updates) };
      }
      case "stripe_product":
        return { kind: "product", data: productFields.parse(task) };
      case "stripe_link":
        return { kind: "link", data: linkFields.parse(task) };
    }
  } catch {
    throw new OpsError(400, "Task payload is invalid for its operation type");
  }
}

function wpConfiguration(): { url: string; authorization: string } {
  const url = new URL(process.env.WP_URL || "https://slessismore.org/wp-json/wp/v2");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new OpsError(503, "WP_URL must be a credential-free HTTPS REST API URL");
  }
  const username = process.env.WP_USER;
  const password = process.env.WP_APP_PASSWORD;
  if (!username || !password) throw new OpsError(503, "WordPress credentials are not configured");
  return {
    url: url.href.replace(/\/$/, ""),
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };
}

export function checkTaskConfiguration(prepared: PreparedTask): void {
  if (prepared.kind === "wp") wpConfiguration();
}

async function pushWordPress(endpoint: string, data: Record<string, unknown>): Promise<TaskResult> {
  const config = wpConfiguration();
  const response = await fetch(`${config.url}/${endpoint}`, {
    method: "POST",
    headers: { Authorization: config.authorization, "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok) {
    return { success: false, error: `WordPress request failed (HTTP ${response.status})` };
  }
  const result = z.object({ id: z.number().int(), link: z.string().url() }).parse(await response.json());
  return { success: true, id: result.id, link: result.link };
}

async function stripePost(path: string, data: Record<string, string>, key: string): Promise<Record<string, unknown>> {
  // Keep the connected account's authentication and refresh in the supplied SDK.
  const connectors = new ReplitConnectors();
  const operation = connectors.proxy("stripe", path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": key },
    body: new URLSearchParams(data).toString(),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Stripe request timed out")), 30_000);
  });
  const response = await Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`Stripe request failed (HTTP ${response.status})`);
  return z.record(z.string(), z.unknown()).parse(await response.json());
}

export async function executePreparedTask(task: OpsTask, prepared: PreparedTask): Promise<TaskResult> {
  const key = createHash("sha256").update(`sless-ops:${task.id}`).digest("hex");
  try {
    if (prepared.kind === "wp") return await pushWordPress(prepared.endpoint, prepared.data);
    if (prepared.kind === "product") {
      const product = await stripePost("/v1/products", prepared.data, `${key}:product`);
      return { success: true, id: z.string().parse(product.id) };
    }
    const price = await stripePost("/v1/prices", {
      unit_amount: String(prepared.data.amount),
      currency: "usd",
      "product_data[name]": prepared.data.name,
    }, `${key}:price`);
    const fields: Record<string, string> = {
      "line_items[0][price]": z.string().parse(price.id),
      "line_items[0][quantity]": "1",
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": prepared.data.redirect,
    };
    if (prepared.data.shipping) {
      ["US", "CA", "GB"].forEach((country, index) => {
        fields[`shipping_address_collection[allowed_countries][${index}]`] = country;
      });
    }
    const link = await stripePost("/v1/payment_links", fields, `${key}:link`);
    return { success: true, id: z.string().parse(link.id), url: z.string().url().parse(link.url) };
  } catch {
    // A timeout may occur after the provider committed the operation. Never
    // auto-retry WordPress writes or leak credential-bearing upstream details.
    return { success: false, error: "Provider operation failed or timed out. Check the provider before retrying." };
  }
}