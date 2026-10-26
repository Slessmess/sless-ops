import { z } from "zod";

export const taskSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["wp_page", "wp_post", "wp_update", "stripe_link", "stripe_product"]),
  status: z.enum(["pending", "processing", "completed", "failed", "change_requested"]).default("pending"),
  feedback: z.string().optional(),
  result: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    id: z.union([z.string(), z.number()]).optional(),
    link: z.string().optional(),
    url: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export type OpsTask = z.infer<typeof taskSchema>;
export type TaskResult = NonNullable<OpsTask["result"]>;

export class OpsError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}