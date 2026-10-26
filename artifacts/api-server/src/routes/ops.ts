import { Router, type IRouter } from "express";
import { GetProcessingReportResponse, RequestTaskChangesBody } from "@workspace/api-zod";
import { OpsService } from "../lib/ops-service";
import { TaskStore } from "../lib/task-store";
import { requireOpsAdmin } from "../middlewares/ops-admin";
import { createPendingTask } from "../lib/ops-intake";

const router: IRouter = Router();
const service = new OpsService(new TaskStore());

router.use(requireOpsAdmin);
router.post("/tasks", async (req, res) => {
  const result = await createPendingTask(service.store, req.body, req.headers["idempotency-key"]);
  res.status(result.created ? 201 : 200).json(result.task);
});
router.get("/tasks/processing-report", async (req, res): Promise<void> => {
  const report = GetProcessingReportResponse.parse(await service.processingReport());
  if (report.inspectionRequired) {
    req.log.warn({
      event: "ops_provider_inspection_required",
      stalledCount: report.stalledCount,
      unknownStartCount: report.unknownStartCount,
      thresholdSeconds: report.thresholdSeconds,
    }, report.warning);
  }
  res.json(report);
});
router.get(["/", "/tasks"], async (_req, res) => {
  res.json(await service.store.list());
});
router.post("/approve/:taskId", async (req, res) => {
  res.json(await service.approve(req.params.taskId));
});
router.post("/change/:taskId", async (req, res) => {
  const input = RequestTaskChangesBody.safeParse(req.body ?? {});
  if (!input.success) {
    res.status(400).json({ error: "Feedback must be a string of at most 10,000 characters" });
    return;
  }
  res.json(await service.requestChanges(req.params.taskId, input.data.feedback ?? ""));
});

export default router;