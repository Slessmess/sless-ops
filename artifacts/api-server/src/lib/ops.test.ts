import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pool, opsTasks } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { TaskStore } from "./task-store";
import { importTaskFile } from "./task-import";
import { OpsService } from "./ops-service";
import { OpsError, type OpsTask } from "./ops-types";
import { executePreparedTask, prepareTask } from "./ops-executor";
import { GetProcessingReportResponse } from "@workspace/api-zod";
import { stalledTaskThresholdSeconds } from "./processing-monitor";
import { createPendingTask, createTaskSchema } from "./ops-intake";

async function fixture(tasks: unknown[]) {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("Database tests must only run in development");
  }
  const directory = await mkdtemp(join(tmpdir(), "sless-ops-test-"));
  const file = join(directory, "tasks.json");
  await writeFile(file, JSON.stringify(tasks));
  const namespace = `ops_test_${randomUUID().replaceAll("-", "")}`;
  await pool.query(`CREATE SCHEMA "${namespace}"`);
  const clients = await Promise.all([pool.connect(), pool.connect()]);
  try {
    for (const client of clients) await client.query(`SET search_path TO "${namespace}"`);
    await clients[0]!.query("CREATE TABLE ops_tasks (LIKE public.ops_tasks INCLUDING ALL)");
    const database = drizzle(clients[0]!, { schema });
    const secondDatabase = drizzle(clients[1]!, { schema });
    const store = new TaskStore(database);
    await importTaskFile(file, store);
    return {
      file, store, database, secondDatabase,
      secondStore: new TaskStore(secondDatabase),
      cleanup: async () => {
        for (const client of clients) {
          await client.query("RESET search_path");
          client.release();
        }
        await pool.query(`DROP SCHEMA "${namespace}" CASCADE`);
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    for (const client of clients) {
      await client.query("RESET search_path");
      client.release();
    }
    await pool.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
after(() => pool.end());
const pending: OpsTask = { id: "task-one", type: "stripe_product", name: "Test product", status: "pending" };
const isStatus = (status: number) => (error: unknown) =>
  error instanceof OpsError && error.status === status;

test("task intake saves pending only, survives retry and never executes a provider", async () => {
  const data = await fixture([]);
  try {
    const key = randomUUID();
    const input = { type: "wp_page", title: "Queued draft", content: "<p>Review before publishing</p>" };
    const saved = await createPendingTask(data.store, input, key);
    assert.equal(saved.created, true);
    assert.equal(saved.task.status, "pending");
    assert.equal(saved.task.wp_status, "draft");
    assert.equal(saved.task.result, undefined);
    const retry = await createPendingTask(data.secondStore, input, key);
    assert.equal(retry.created, false);
    assert.deepEqual(retry.task, saved.task);
    await assert.rejects(createPendingTask(data.store, { ...input, title: "Different" }, key), isStatus(409));
    await assert.rejects(createPendingTask(data.store, { ...input, status: "completed" }, randomUUID()), isStatus(400));
    await assert.rejects(createPendingTask(data.store, { ...input, result: { success: true } }, randomUUID()), isStatus(400));
    await assert.rejects(createPendingTask(data.store, input, "bad-key"), isStatus(400));
    assert.equal((await data.store.list()).length, 1);
  } finally { await data.cleanup(); }
});

test("WordPress updates never add an implicit draft status or accept an empty update", () => {
  const parsed = createTaskSchema.parse({
    type: "wp_update", wp_id: 123, updates: { title: "Revised title" },
  });
  assert.equal(parsed.type, "wp_update");
  if (parsed.type !== "wp_update") throw new Error("Wrong task type");
  assert.deepEqual(parsed.updates, { title: "Revised title" });
  assert.equal(createTaskSchema.safeParse({
    type: "wp_update", wp_id: 123, updates: {},
  }).success, false);
  const created = createTaskSchema.parse({
    type: "wp_page", title: "New page", content: "",
  });
  if (created.type !== "wp_page") throw new Error("Wrong task type");
  assert.equal(created.wp_status, "draft");
});

test("intake validates all five operation types and rejects unsafe or incomplete fields", () => {
  for (const input of [
    { type: "wp_page", title: "Page", content: "" },
    { type: "wp_post", title: "Post", content: "Text", wp_status: "publish" },
    { type: "wp_update", wp_id: 123, is_page: true, updates: { content: "" } },
    { type: "stripe_product", name: "Product" },
    { type: "stripe_link", name: "Link", amount: 3999, redirect: "https://slessismore.org/thank-you" },
  ]) assert.equal(createTaskSchema.safeParse(input).success, true);
  for (const input of [
    { type: "wp_page", title: " ", content: "" },
    { type: "wp_post", title: "Post" },
    { type: "wp_update", wp_id: 0, updates: { title: "Bad" } },
    { type: "wp_update", wp_id: 1, updates: {} },
    { type: "wp_update", wp_id: 1, updates: { meta: { dangerous: true } } },
    { type: "stripe_link", name: "Bad", amount: 3.99 },
    { type: "stripe_link", name: "Bad", amount: 100, redirect: "http://example.org" },
    { type: "stripe_link", name: "Bad", amount: 100, redirect: "https://user:pass@example.org" },
    { type: "stripe_product", name: "Product", id: "injected" },
  ]) assert.equal(createTaskSchema.safeParse(input).success, false, JSON.stringify(input));
});

test("concurrent duplicate intake creates exactly one pending task", async () => {
  const data = await fixture([]);
  try {
    const key = randomUUID();
    const input = { type: "stripe_product", name: "Queued, not created in Stripe" };
    const saved = await Promise.all([
      createPendingTask(data.store, input, key), createPendingTask(data.secondStore, input, key),
    ]);
    assert.equal(saved.filter((s) => s.created).length, 1);
    assert.equal((await data.store.list()).length, 1);
  } finally { await data.cleanup(); }
});

test("empty database is an empty queue; missing, corrupt and duplicate imports fail explicitly", async () => {
  const data = await fixture([]);
  try {
    assert.deepEqual(await data.store.list(), []);
    await assert.rejects(importTaskFile(join(dirname(data.file), "missing.json"), data.store), /ENOENT/);
    await writeFile(data.file, "{broken");
    await assert.rejects(importTaskFile(data.file, data.store));
    await writeFile(data.file, JSON.stringify([pending, pending]));
    await assert.rejects(importTaskFile(data.file, data.store), /duplicate IDs/);
    await writeFile(data.file, JSON.stringify([{ type: "invalid" }]));
    await assert.rejects(importTaskFile(data.file, data.store));
    assert.deepEqual(await data.store.list(), []);
  } finally { await data.cleanup(); }
});

test("legacy records default to pending and preserve custom payload fields", async () => {
  const data = await fixture([{ id: "legacy", type: "wp_page", title: "Draft", content: "", extra: "preserved" }]);
  try {
    const tasks = await data.store.list();
    assert.equal(tasks[0]?.status, "pending");
    assert.equal(tasks[0]?.extra, "preserved");
  } finally { await data.cleanup(); }
});

test("approval persists a successful result and rejects repeat execution", async () => {
  const data = await fixture([pending]);
  let calls = 0;
  const service = new OpsService(data.store, async () => {
    calls++;
    return { success: true, id: "prod_test" };
  }, () => undefined);
  try {
    const task = await service.approve(pending.id);
    assert.equal(task.status, "completed");
    assert.equal(task.result?.id, "prod_test");
    // A fresh store on a separate database connection sees committed history.
    assert.equal((await new TaskStore(data.secondDatabase).list())[0]?.status, "completed");
    assert.equal((await data.secondStore.list())[0]?.result?.id, "prod_test");
    await assert.rejects(service.approve(pending.id), isStatus(409));
    assert.equal(calls, 1);
  } finally { await data.cleanup(); }
});

test("concurrent approvals execute once and change requests cannot interrupt processing", async () => {
  const data = await fixture([pending]);
  let finish!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  const finishPromise = new Promise<void>((resolve) => { finish = resolve; });
  let calls = 0;
  const service = new OpsService(data.store, async () => {
    calls++;
    started();
    await finishPromise;
    return { success: true };
  }, () => undefined);
  try {
    const approval = service.approve(pending.id);
    await startedPromise;
    const [claimRow] = await data.secondDatabase.select().from(opsTasks);
    assert.ok(claimRow?.claimStartedAt instanceof Date);
    assert.ok(claimRow.claimToken);
    const report = await new OpsService(data.secondStore).processingReport(900, claimRow.claimStartedAt);
    assert.equal(report.activeCount, 1);
    assert.equal(report.inspectionRequired, false);
    // Internal timing/token fields must not leak into existing task JSON.
    assert.deepEqual(await data.secondStore.list(), [{ ...pending, status: "processing" }]);
    const otherInstance = new OpsService(data.secondStore, async () => {
      calls++;
      return { success: true };
    }, () => undefined);
    await assert.rejects(otherInstance.approve(pending.id), isStatus(409));
    await assert.rejects(otherInstance.requestChanges(pending.id, "stop"), isStatus(409));
    finish();
    await approval;
    assert.equal(calls, 1);
    const [finishedRow] = await data.secondDatabase.select().from(opsTasks);
    assert.equal(finishedRow?.claimStartedAt, null);
    assert.equal(finishedRow?.claimToken, null);
  } finally { await data.cleanup(); }
});

test("processing monitoring distinguishes active, stalled boundaries and unknown legacy start times; reads only", async () => {
  const data = await fixture([
    { ...pending, id: "active" },
    { ...pending, id: "stalled" },
    { ...pending, id: "boundary", type: "wp_update", wp_id: 12 },
    // A document timestamp is untrusted import data, NOT internal claim timing.
    { ...pending, id: "legacy", status: "processing", claim_started_at: "2000-01-01T00:00:00Z" },
    ...(["pending", "failed", "completed", "change_requested"] as const)
      .map((status) => ({ ...pending, id: status, status })),
  ]);
  const now = new Date("2026-10-02T12:00:00Z");
  let providerCalls = 0;
  const monitor = new OpsService(data.secondStore, async () => {
    providerCalls++;
    throw new Error("Monitoring must never execute a provider");
  }, () => {
    providerCalls++;
    throw new Error("Monitoring must never validate provider configuration");
  });
  try {
    for (const [id, seconds] of [["active", 899], ["stalled", 1200], ["boundary", 900]] as const) {
      await data.store.claim(id, () => undefined);
      await data.database.update(opsTasks).set({
        claimStartedAt: new Date(now.getTime() - seconds * 1000),
      }).where(eq(opsTasks.id, id));
    }
    const before = await data.database.select().from(opsTasks);
    // A read-only DB session proves the report cannot depend on any mutations.
    await data.secondDatabase.execute("SET default_transaction_read_only = on");
    try {
      const report = GetProcessingReportResponse.parse(await monitor.processingReport(900, now));
      assert.equal(report.checkedAt.toISOString(), now.toISOString());
      assert.equal(report.thresholdSeconds, 900);
      assert.equal(report.activeCount, 1);
      assert.equal(report.stalledCount, 2);
      assert.equal(report.unknownStartCount, 1);
      assert.equal(report.inspectionRequired, true);
      assert.match(report.warning, /Inspect WordPress\/Stripe before recovery/);
      assert.match(report.warning, /Never automatically reset or retry/);
      assert.deepEqual(report.tasks.map((task) => [task.id, task.classification, task.inspectionRequired]), [
        ["active", "active", false], ["stalled", "stalled", true],
        ["boundary", "stalled", true], ["legacy", "unknown_start", true],
      ]);
      assert.equal(report.tasks[2]?.provider, "WordPress");
      assert.equal(report.tasks[1]?.provider, "Stripe");
      assert.equal(report.tasks[3]?.startedAt, null);
      assert.equal(report.tasks[3]?.ageSeconds, null);
      assert.equal(report.tasks[1]?.ageSeconds, 1200);
      assert.ok(!JSON.stringify(report).includes("claimToken"));
      // Repeated polling and a different threshold do not recover anything.
      assert.deepEqual(await monitor.processingReport(900, now), report);
      const longerThreshold = await monitor.processingReport(1800, now);
      assert.equal(longerThreshold.activeCount, 3);
      assert.equal(longerThreshold.stalledCount, 0);
      assert.equal(longerThreshold.unknownStartCount, 1);
      assert.deepEqual(await data.secondDatabase.select().from(opsTasks), before);
      assert.equal(providerCalls, 0);
    } finally {
      await data.secondDatabase.execute("SET default_transaction_read_only = off");
    }
  } finally { await data.cleanup(); }
});

test("monitoring an empty queue or only terminal tasks produces no inspection alert", async () => {
  for (const tasks of [[], [{ ...pending, status: "completed" }, { ...pending, id: "failed", status: "failed" }]]) {
    const data = await fixture(tasks);
    try {
      const report = await new OpsService(data.store).processingReport(1);
      assert.deepEqual(report.tasks, []);
      assert.equal(report.inspectionRequired, false);
      assert.equal(report.activeCount + report.stalledCount + report.unknownStartCount, 0);
    } finally { await data.cleanup(); }
  }
});

test("monitor threshold defaults and rejects unsafe or malformed settings explicitly", () => {
  assert.equal(stalledTaskThresholdSeconds("900"), 900);
  assert.equal(stalledTaskThresholdSeconds("1"), 1);
  assert.equal(stalledTaskThresholdSeconds("31536000"), 31536000);
  for (const raw of ["", "0", "-1", "0.5", "1e3", "Infinity", "NaN", "900seconds", " 900", "31536001"]) {
    assert.throws(() => stalledTaskThresholdSeconds(raw), isStatus(503));
  }
  const original = process.env.SLESS_OPS_STALLED_TASK_SECONDS;
  try {
    delete process.env.SLESS_OPS_STALLED_TASK_SECONDS;
    assert.equal(stalledTaskThresholdSeconds(), 900);
    process.env.SLESS_OPS_STALLED_TASK_SECONDS = "120";
    assert.equal(stalledTaskThresholdSeconds(), 120);
  } finally {
    if (original === undefined) delete process.env.SLESS_OPS_STALLED_TASK_SECONDS;
    else process.env.SLESS_OPS_STALLED_TASK_SECONDS = original;
  }
});

test("simultaneous claims from separate connections have exactly one winner", async () => {
  const data = await fixture([pending]);
  try {
    const results = await Promise.allSettled([
      data.store.claim(pending.id, () => undefined),
      data.secondStore.claim(pending.id, () => undefined),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const loser = results.find((result) => result.status === "rejected");
    assert.ok(loser?.status === "rejected" && isStatus(409)(loser.reason));
    assert.equal((await data.secondStore.list())[0]?.status, "processing");
  } finally { await data.cleanup(); }
});

test("import preserves every state, payload, feedback, results, order and exact backup bytes", async () => {
  const data = await fixture([]);
  const records = (["pending", "processing", "completed", "failed", "change_requested"] as const)
    .map((status, index) => ({
      ...pending, id: `history-${index}`, status, feedback: "Original feedback",
      nested: { custom: [1, "two"] },
      result: { success: status === "completed", id: "provider-id", custom: { preserved: true } },
    }));
  const bytes = JSON.stringify(records, null, 4) + "\n";
  try {
    await writeFile(data.file, bytes);
    const imported = await importTaskFile(data.file, data.store);
    assert.equal(imported.inserted, records.length);
    assert.equal(await readFile(imported.backupPath, "utf8"), bytes);
    assert.equal((await stat(imported.backupPath)).mode & 0o777, 0o600);
    assert.equal(await readFile(data.file, "utf8"), bytes);
    assert.deepEqual(await data.secondStore.list(), records);
    assert.equal((await importTaskFile(data.file, data.secondStore)).inserted, 0);
    // Imported processing tasks are NOT resumed/retried on another instance.
    await assert.rejects(new OpsService(data.secondStore).approve("history-1"), isStatus(409));
  } finally { await data.cleanup(); }
});

test("conflicting import rolls back earlier inserts and never overwrites live history", async () => {
  const data = await fixture([pending]);
  try {
    await data.store.requestChanges(pending.id, "Keep this feedback");
    await writeFile(data.file, JSON.stringify([{ ...pending, id: "new-first" }, pending]));
    await assert.rejects(importTaskFile(data.file, data.secondStore), /conflicts/);
    assert.deepEqual(await data.store.list(), [{ ...pending, status: "change_requested", feedback: "Keep this feedback" }]);
    assert.ok((await readdir(dirname(data.file))).some((name) => name.endsWith(".backup")));
  } finally { await data.cleanup(); }
});

test("stale claim token cannot complete a manually recovered task", async () => {
  const data = await fixture([pending]);
  try {
    const oldClaim = await data.store.claim(pending.id, () => undefined);
    await assert.rejects(data.secondStore.finish(pending.id, "wrong-token", { success: true }), isStatus(409));
    // Simulate an operator reset AFTER inspecting the provider.
    await data.database.update(opsTasks).set({ document: pending, claimToken: null }).where(eq(opsTasks.id, pending.id));
    const freshClaim = await data.secondStore.claim(pending.id, () => undefined);
    await assert.rejects(data.store.finish(pending.id, oldClaim.token, { success: true }), isStatus(409));
    await data.secondStore.finish(pending.id, freshClaim.token, { success: false, error: "Confirmed failure" });
    assert.equal((await data.store.list())[0]?.status, "failed");
  } finally { await data.cleanup(); }
});

test("provider success followed by persistence failure remains processing for manual recovery", async () => {
  const data = await fixture([pending]);
  let calls = 0;
  try {
    const originalFinish = data.store.finish.bind(data.store);
    data.store.finish = async () => { throw new Error("Database write unavailable"); };
    const service = new OpsService(data.store, async () => {
      calls++;
      return { success: true, id: "provider-confirmed" };
    }, () => undefined);
    await assert.rejects(service.approve(pending.id), /Database write unavailable/);
    assert.equal((await data.secondStore.list())[0]?.status, "processing");
    const [row] = await data.secondDatabase.select().from(opsTasks);
    assert.ok(row?.claimStartedAt);
    const report = await new OpsService(data.secondStore).processingReport(
      900, new Date(row.claimStartedAt.getTime() + 900_000),
    );
    assert.equal(report.stalledCount, 1);
    assert.equal(report.inspectionRequired, true);
    await assert.rejects(new OpsService(data.secondStore).approve(pending.id), isStatus(409));
    assert.equal(calls, 1);
    data.store.finish = originalFinish;
  } finally { await data.cleanup(); }
});

test("deleting a claimed task cannot let a stale worker silently finish", async () => {
  const data = await fixture([pending]);
  try {
    const claim = await data.store.claim(pending.id, () => undefined);
    await data.database.delete(opsTasks).where(eq(opsTasks.id, pending.id));
    await assert.rejects(data.secondStore.finish(pending.id, claim.token, { success: true }), isStatus(409));
  } finally { await data.cleanup(); }
});

test("provider failures and thrown exceptions persist failed status", async () => {
  for (const throws of [false, true]) {
    const data = await fixture([pending]);
    try {
      const service = new OpsService(data.store, async () => {
        if (throws) throw new Error("sensitive upstream detail");
        return { success: false, error: "Provider unavailable" };
      }, () => undefined);
      const task = await service.approve(pending.id);
      assert.equal(task.status, "failed");
      assert.equal(task.result?.success, false);
      assert.ok(!JSON.stringify(task).includes("sensitive upstream detail"));
      const [row] = await data.secondDatabase.select().from(opsTasks);
      assert.equal(row?.claimStartedAt, null);
      await assert.rejects(service.approve(pending.id), isStatus(409));
    } finally { await data.cleanup(); }
  }
});

test("invalid operation data stays pending and missing task returns 404", async () => {
  const data = await fixture([{ ...pending, name: "" }]);
  let calls = 0;
  const service = new OpsService(data.store, async () => { calls++; return { success: true }; }, prepareTask);
  try {
    await assert.rejects(service.approve(pending.id), isStatus(400));
    assert.equal((await data.store.list())[0]?.status, "pending");
    assert.equal(calls, 0);
    const [row] = await data.secondDatabase.select().from(opsTasks);
    assert.equal(row?.claimStartedAt, null);
    assert.equal(row?.claimToken, null);
    await assert.rejects(service.approve("missing"), isStatus(404));
    await assert.rejects(service.requestChanges("missing", ""), isStatus(404));
  } finally { await data.cleanup(); }
});

test("feedback is saved without executing; completed tasks cannot be changed", async () => {
  const data = await fixture([pending, { ...pending, id: "done", status: "completed" }]);
  const service = new OpsService(data.store);
  try {
    const task = await service.requestChanges(pending.id, "Revise the title");
    assert.equal(task.status, "change_requested");
    assert.equal(task.feedback, "Revise the title");
    assert.equal((await data.secondStore.list())[0]?.feedback, "Revise the title");
    await assert.rejects(service.approve(pending.id), isStatus(409));
    await assert.rejects(service.requestChanges("done", "revision"), isStatus(409));
  } finally { await data.cleanup(); }
});

test("WordPress preparation defaults to draft and supports separate or legacy content IDs", () => {
  const page = prepareTask({ id: "page", type: "wp_page", title: "Title", content: "<p>Text</p>", status: "pending" });
  assert.deepEqual(page, { kind: "wp", endpoint: "pages", data: { title: "Title", content: "<p>Text</p>", status: "draft", slug: "" } });
  const post = prepareTask({ id: "post", type: "wp_post", title: "Title", content: "", status: "pending" });
  assert.equal(post.kind === "wp" && post.endpoint, "posts");
  const update = prepareTask({ id: "queue-id", type: "wp_update", wp_id: 42, is_page: true, updates: { title: "New" }, status: "pending" });
  assert.equal(update.kind === "wp" && update.endpoint, "pages/42");
  const legacy = prepareTask({ id: "12", type: "wp_update", updates: { status: "draft" }, status: "pending" });
  assert.equal(legacy.kind === "wp" && legacy.endpoint, "posts/12");
  assert.throws(() => prepareTask({ id: "abc", type: "wp_update", updates: { title: "New" }, status: "pending" }), isStatus(400));
  assert.throws(() => prepareTask({ id: "1", type: "wp_update", updates: {}, status: "pending" }), isStatus(400));
});

test("Stripe payment links use USD cents, safe redirects, shipping countries and stable idempotency keys", async () => {
  const original = ReplitConnectors.prototype.proxy;
  const calls: { path: string; options: Parameters<typeof original>[2] }[] = [];
  ReplitConnectors.prototype.proxy = async (_connector, path, options) => {
    calls.push({ path, options });
    return Response.json(path === "/v1/prices" ? { id: "price_test" } : { id: "plink_test", url: "https://buy.stripe.com/test" });
  };
  try {
    const task: OpsTask = { id: "link", type: "stripe_link", name: "Test", amount: 2500, shipping: true, status: "pending" };
    assert.deepEqual(await executePreparedTask(task, prepareTask(task)), { success: true, id: "plink_test", url: "https://buy.stripe.com/test" });
    assert.equal(calls[0]?.path, "/v1/prices");
    const price = new URLSearchParams(String(calls[0]?.options?.body));
    assert.equal(price.get("unit_amount"), "2500");
    assert.equal(price.get("currency"), "usd");
    const link = new URLSearchParams(String(calls[1]?.options?.body));
    assert.equal(link.get("line_items[0][price]"), "price_test");
    assert.equal(link.get("after_completion[redirect][url]"), "https://slessismore.org/thank-you");
    assert.equal(link.get("shipping_address_collection[allowed_countries][2]"), "GB");
    await executePreparedTask(task, prepareTask(task));
    assert.equal(calls[0]?.options?.headers?.["Idempotency-Key"], calls[2]?.options?.headers?.["Idempotency-Key"]);
    assert.throws(() => prepareTask({ ...task, amount: -1 }), isStatus(400));
    assert.throws(() => prepareTask({ ...task, redirect: "javascript:alert(1)" }), isStatus(400));
  } finally { ReplitConnectors.prototype.proxy = original; }
});

test("Stripe products are created through the connector; provider errors are sanitized", async () => {
  const original = ReplitConnectors.prototype.proxy;
  ReplitConnectors.prototype.proxy = async (_connector, path) => {
    assert.equal(path, "/v1/products");
    return Response.json({ id: "prod_test" });
  };
  try {
    assert.deepEqual(await executePreparedTask(pending, prepareTask(pending)), { success: true, id: "prod_test" });
    ReplitConnectors.prototype.proxy = async () => Response.json({ error: "private detail" }, { status: 403 });
    const result = await executePreparedTask(pending, prepareTask(pending));
    assert.equal(result.success, false);
    assert.ok(!result.error?.includes("private detail"));
  } finally { ReplitConnectors.prototype.proxy = original; }
});

test("WordPress calls use configured REST endpoints and reject credential-leaking redirects", async () => {
  const original = globalThis.fetch;
  // Test-only credentials replace the child test process environment.
  process.env.WP_USER = "fixture-user";
  process.env.WP_APP_PASSWORD = "fixture-password";
  process.env.WP_URL = "https://example.invalid/wp-json/wp/v2";
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://example.invalid/wp-json/wp/v2/pages");
    assert.equal(options?.redirect, "error");
    assert.ok((options?.headers as Record<string, string>).Authorization.startsWith("Basic "));
    return Response.json({ id: 3, link: "https://example.invalid/page" });
  };
  try {
    const task: OpsTask = { id: "page", type: "wp_page", title: "Title", content: "", status: "pending" };
    assert.deepEqual(await executePreparedTask(task, prepareTask(task)), { success: true, id: 3, link: "https://example.invalid/page" });
    globalThis.fetch = async () => Response.json({ message: "private" }, { status: 401 });
    const result = await executePreparedTask(task, prepareTask(task));
    assert.equal(result.success, false);
    assert.match(result.error || "", /HTTP 401/);
  } finally {
    globalThis.fetch = original;
    delete process.env.WP_USER;
    delete process.env.WP_APP_PASSWORD;
    delete process.env.WP_URL;
  }
});