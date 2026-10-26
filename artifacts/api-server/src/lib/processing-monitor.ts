import type { ProcessingReport } from "@workspace/api-zod";
import { OpsError } from "./ops-types";
import type { TaskStore } from "./task-store";

export const PROVIDER_INSPECTION_WARNING =
  "Processing does not prove failure. Inspect WordPress/Stripe before recovery; stop relevant workers, confirm the provider outcome, and document the operator decision. Never automatically reset or retry provider writes.";

export function stalledTaskThresholdSeconds(raw = process.env.SLESS_OPS_STALLED_TASK_SECONDS): number {
  if (raw === undefined) return 900;
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > 31_536_000) {
    throw new OpsError(503, "SLESS_OPS_STALLED_TASK_SECONDS must be an integer from 1 to 31536000");
  }
  return Number(raw);
}

export async function processingReport(
  store: Pick<TaskStore, "processingClaims">,
  thresholdSeconds = stalledTaskThresholdSeconds(),
  now = new Date(),
): Promise<ProcessingReport> {
  // Reject invalid direct callers as well as invalid operator configuration.
  stalledTaskThresholdSeconds(String(thresholdSeconds));
  const rows = await store.processingClaims();
  const tasks: ProcessingReport["tasks"] = rows.map(({ task, startedAt }) => {
    const ageSeconds = startedAt === null ? null : Math.max(0, (now.getTime() - startedAt.getTime()) / 1000);
    const classification = ageSeconds === null ? "unknown_start" :
      ageSeconds >= thresholdSeconds ? "stalled" : "active";
    return {
      id: task.id,
      type: task.type,
      provider: task.type.startsWith("wp_") ? "WordPress" : "Stripe",
      startedAt,
      ageSeconds,
      classification,
      inspectionRequired: classification !== "active",
    };
  });
  return {
    checkedAt: now,
    thresholdSeconds,
    activeCount: tasks.filter((task) => task.classification === "active").length,
    stalledCount: tasks.filter((task) => task.classification === "stalled").length,
    unknownStartCount: tasks.filter((task) => task.classification === "unknown_start").length,
    inspectionRequired: tasks.some((task) => task.inspectionRequired),
    warning: PROVIDER_INSPECTION_WARNING,
    tasks,
  };
}