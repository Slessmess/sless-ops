import { randomUUID } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { TaskStore } from "./task-store";

export async function importTaskFile(filePath: string, store = new TaskStore()) {
  const source = resolve(filePath);
  // Read once: the backup and import must represent exactly the same snapshot.
  // Missing/unreadable files fail, rather than silently importing an empty queue.
  const bytes = await readFile(source);
  const backupPath = `${source}.${randomUUID()}.backup`;
  const backup = await open(backupPath, "wx", 0o600);
  try {
    await backup.writeFile(bytes);
    await backup.sync();
  } finally {
    await backup.close();
  }
  // Persist the directory entry as well as the contents before committing data.
  const directory = await open(dirname(backupPath), "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
  const inserted = await store.importTasks(JSON.parse(bytes.toString("utf8")));
  return { backupPath, inserted };
}