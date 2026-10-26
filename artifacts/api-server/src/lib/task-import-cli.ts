import { pool } from "@workspace/db";
import { importTaskFile } from "./task-import";
import { logger } from "./logger";

async function main() {
  // This operator tool is development-only, never a startup/build/publish hook.
  if (process.env.NODE_ENV !== "development" ||
      process.env.REPLIT_DEPLOYMENT === "1" ||
      process.argv[2] !== "--development-only") {
    throw new Error("Task import requires development mode and --development-only");
  }
  const file = process.argv[3] || process.env.TASKS_FILE || "tasks.json";
  const result = await importTaskFile(file);
  logger.info(result, "Task import committed; retain the private backup outside the deployment");
}

main().catch(() => {
  logger.error("Import failed; no partial import was committed. Keep the source and any .backup file; inspect conflicts before retrying.");
  process.exitCode = 1;
}).finally(() => pool.end());