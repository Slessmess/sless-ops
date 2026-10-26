import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nextDue, checkSpacing, validateManifest } from "./instagram-schedule-core.mjs";

const { manifest } = JSON.parse(await readFile("wordpress/sless-refresh/instagram-scheduler-manifest.json", "utf8"));
const fresh = () => ({ posts: { I08: { status: "published", publishedAt: "2026-10-19T17:35:09Z" } } });
test("approved schedule is valid and posts nothing early", () => {
  validateManifest(manifest);
  assert.equal(nextDue(manifest, fresh(), new Date("2026-10-20T15:59:59Z")), null);
});
test("noon Eastern image and six pm reel use exact planned slots", () => {
  assert.equal(nextDue(manifest, fresh(), new Date("2026-10-20T16:00:00Z")).id, "I01");
  const journal = fresh();
  journal.posts.I01 = { status: "published", publishedAt: "2026-10-20T16:00:00Z" };
  assert.equal(nextDue(manifest, journal, new Date("2026-10-20T22:00:00Z")).id, "V01");
});
test("never catches up old posts or publishes after campaign expiry", () => {
  assert.equal(nextDue(manifest, fresh(), new Date("2026-10-20T17:00:01Z")), null);
  assert.equal(nextDue(manifest, fresh(), new Date("2026-10-26T04:00:00Z")), null);
});
test("published receipts prevent reposting", () => {
  const journal = fresh();
  journal.posts.I01 = { status: "published", publishedAt: "2026-10-20T16:00:00Z" };
  assert.equal(nextDue(manifest, journal, new Date("2026-10-20T16:05:00Z")), null);
});
test("last-day creative is never due on October 24", () => {
  const journal = fresh();
  for (const p of manifest.posts.filter(p => p.id !== "I09"))
    journal.posts[p.id] = { status: "published", publishedAt: p.publishAt };
  assert.equal(nextDue(manifest, journal, new Date("2026-10-24T23:00:00Z")), null);
  assert.equal(nextDue(manifest, journal, new Date("2026-10-25T16:00:00Z")).id, "I09");
});
test("daily cap and six-hour spacing are enforced", () => {
  const journal = fresh();
  journal.posts.I01 = { status: "published", publishedAt: "2026-10-20T16:05:00Z" };
  assert.throws(() => checkSpacing(manifest, journal, new Date("2026-10-20T22:00:00Z")), /six-hour/);
  assert.doesNotThrow(() => checkSpacing(manifest, journal, new Date("2026-10-20T22:05:00Z")));
  journal.posts.V01 = { status: "published", publishedAt: "2026-10-20T22:05:00Z" };
  assert.throws(() => checkSpacing(manifest, journal, new Date("2026-10-20T23:00:00Z")), /Daily/);
});
test("unknown creation or publication outcomes block another automatic write", () => {
  for (const status of ["creation_started", "publication_started", "published_receipt_pending"]) {
    const journal = fresh();
    journal.posts.I01 = { status };
    assert.throws(() => nextDue(manifest, journal, new Date("2026-10-20T22:00:00Z")), /Uncertain/);
  }
});
test("schedule tampering and unsupported Story kinds are rejected", () => {
  const changed = structuredClone(manifest);
  changed.posts[0].kind = "story";
  assert.throws(() => validateManifest(changed), /Invalid/);
  const tooClose = structuredClone(manifest);
  tooClose.posts[2].publishAt = "2026-10-20T13:00:00-04:00";
  assert.throws(() => validateManifest(tooClose), /Staggered/);
});
