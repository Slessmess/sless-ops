import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db, opsTasks } from "@workspace/db";
import { OpsError, taskSchema, type OpsTask, type TaskResult } from "./ops-types";

export class TaskStore {
  constructor(private readonly database: Omit<typeof db, "$client"> = db) {}

  async list(): Promise<OpsTask[]> {
    const rows = await this.database.select().from(opsTasks).orderBy(asc(opsTasks.position));
    return rows.map((row) => taskSchema.parse(row.document));
  }

  async create(input: OpsTask): Promise<{ task: OpsTask; created: boolean }> {
    const task = taskSchema.parse(input);
    const [inserted] = await this.database.insert(opsTasks)
      .values({ id: task.id, document: task }).onConflictDoNothing().returning();
    if (inserted) return { task: taskSchema.parse(inserted.document), created: true };
    const [existing] = await this.database.select().from(opsTasks).where(eq(opsTasks.id, task.id));
    if (!existing || existing.document.intakeFingerprint !== task.intakeFingerprint)
      throw new OpsError(409, "This request key was used with different task details. Start a new task.");
    return { task: taskSchema.parse(existing.document), created: false };
  }

  // SELECT only: no row locks, status updates, or provider I/O.
  async processingClaims() {
    const rows = await this.database.select({
      document: opsTasks.document,
      startedAt: opsTasks.claimStartedAt,
    }).from(opsTasks).where(sql`${opsTasks.document}->>'status' = 'processing'`)
      .orderBy(asc(opsTasks.position));
    return rows.map((row) => ({ task: taskSchema.parse(row.document), startedAt: row.startedAt }));
  }

  // Lock just this task. Validation and the claim commit before any provider I/O.
  private update<T>(
    id: string,
    action: (task: OpsTask, token: string | null) => {
      task: OpsTask; token: string | null; value: T; claiming?: boolean;
    },
    executing = false,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(opsTasks).where(eq(opsTasks.id, id)).for("update");
      if (!row) {
        throw new OpsError(executing ? 409 : 404, executing
          ? "Task changed during execution; check the provider before retrying"
          : "Task not found");
      }
      const changed = action(taskSchema.parse(row.document), row.claimToken);
      await tx.update(opsTasks).set({
        document: taskSchema.parse(changed.task),
        claimToken: changed.token,
        claimStartedAt: changed.claiming ? sql`clock_timestamp()` : null,
      }).where(eq(opsTasks.id, id));
      return changed.value;
    });
  }

  claim(id: string, validate: (task: OpsTask) => void): Promise<{ task: OpsTask; token: string }> {
    return this.update(id, (task) => {
      if (task.status !== "pending") throw new OpsError(409, "Only pending tasks can be approved");
      validate(task);
      task.status = "processing";
      const token = randomUUID();
      return { task, token, claiming: true, value: { task, token } };
    });
  }

  finish(id: string, token: string, result: TaskResult): Promise<OpsTask> {
    return this.update(id, (task, currentToken) => {
      if (task.status !== "processing" || currentToken !== token) {
        throw new OpsError(409, "Task changed during execution; check the provider before retrying");
      }
      task.status = result.success ? "completed" : "failed";
      task.result = result;
      return { task, token: null, value: task };
    }, true);
  }

  requestChanges(id: string, feedback: string): Promise<OpsTask> {
    return this.update(id, (task) => {
      if (task.status === "processing" || task.status === "completed") {
        throw new OpsError(409, "Processing or completed tasks cannot be changed");
      }
      task.status = "change_requested";
      task.feedback = feedback;
      return { task, token: null, value: task };
    });
  }

  // Data-only import. No schema changes and no provider calls.
  // A conflicting ID aborts ALL inserts; identical reruns are safe but never
  // replace newer feedback, results or states with an older file.
  async importTasks(input: unknown): Promise<number> {
    const tasks = taskSchema.array().parse(input);
    if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
      throw new Error("Task file contains duplicate IDs");
    }
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE ops_tasks IN SHARE ROW EXCLUSIVE MODE`);
      let inserted = 0;
      for (const task of tasks) {
        const [existing] = await tx.select().from(opsTasks).where(eq(opsTasks.id, task.id));
        if (existing) {
          const [identical] = await tx.select({ id: opsTasks.id }).from(opsTasks)
            .where(sql`${opsTasks.id} = ${task.id} AND ${opsTasks.document} = ${JSON.stringify(task)}::jsonb`);
          if (!identical) throw new Error("Import conflicts with an existing task; no tasks were imported");
          continue;
        }
        await tx.insert(opsTasks).values({ id: task.id, document: task });
        inserted++;
      }
      return inserted;
    });
  }
}