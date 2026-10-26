import { type OpsTask, type TaskResult } from "./ops-types";
import { checkTaskConfiguration, executePreparedTask, prepareTask } from "./ops-executor";
import { TaskStore } from "./task-store";
import { processingReport, stalledTaskThresholdSeconds } from "./processing-monitor";

export class OpsService {
  constructor(
    readonly store: TaskStore,
    private readonly execute: (task: OpsTask) => Promise<TaskResult> = (task) =>
      executePreparedTask(task, prepareTask(task)),
    private readonly validate: (task: OpsTask) => void = (task) =>
      checkTaskConfiguration(prepareTask(task)),
  ) {}

  async approve(id: string): Promise<OpsTask> {
    const claimed = await this.store.claim(id, this.validate);
    let result: TaskResult;
    try {
      result = await this.execute(claimed.task);
    } catch {
      result = { success: false, error: "Operation failed. Check the provider before retrying." };
    }
    return this.store.finish(id, claimed.token, result);
  }

  requestChanges(id: string, feedback: string): Promise<OpsTask> {
    return this.store.requestChanges(id, feedback);
  }

  processingReport(thresholdSeconds = stalledTaskThresholdSeconds(), now = new Date()) {
    return processingReport(this.store, thresholdSeconds, now);
  }
}