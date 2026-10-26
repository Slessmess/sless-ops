import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { campaignFile, readJournal, writeJournal, sha256, signedAssetUrl } from "./instagram-campaign-store.mjs";
import { validateManifest, nextDue, checkSpacing } from "./instagram-schedule-core.mjs";

const execute = process.argv.includes("--execute");
const verifyAssets = process.argv.includes("--verify-assets");
let held = false;
let journal;
let generation;
const owner = randomUUID();
const startedAt = Date.now();

async function main() {
  if (execute && verifyAssets)
    throw new Error("Asset verification is read-only; do not combine with --execute");
  if (execute && process.env.REPLIT_DEPLOYMENT !== "1")
    throw new Error("Automatic publishing runs only in a published scheduled deployment; use read-only check in the workspace");
  const { manifest, manifestSha256 } = JSON.parse(await readFile(
    new URL("../../../wordpress/sless-refresh/instagram-scheduler-manifest.json", import.meta.url), "utf8",
  ));
  validateManifest(manifest);
  if (sha256(JSON.stringify(manifest)) !== manifestSha256) throw new Error("Scheduler manifest changed");
  for (const post of manifest.posts) {
    if (sha256(JSON.stringify({ instagram: post.instagram, facebook: post.facebook })) !== post.captionsSha256)
      throw new Error("Approved captions changed");
  }
  ({ data: journal, generation } = await readJournal());
  if (journal.manifestSha256 !== manifestSha256 || journal.account !== manifest.account)
    throw new Error("Durable journal belongs to a different campaign");
  if (verifyAssets) {
    for (const post of manifest.posts) {
      const [bytes] = await campaignFile(post.assetObject).download();
      if (sha256(bytes) !== post.assetSha256)
        throw new Error(`Stored asset no longer matches owner approval: ${post.id}`);
    }
    // Verify that Meta will be able to fetch signed media, without exposing URLs.
    const url = await signedAssetUrl(manifest.posts.find(post => post.kind === "video").assetObject);
    const response = await fetch(url, {
      headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Signed media download failed: HTTP ${response.status}`);
    await response.arrayBuffer();
  }
  if (execute) {
    if (journal.owner && new Date(journal.leaseUntil).getTime() > Date.now()) {
      console.log(JSON.stringify({ action: "skip", reason: "another worker holds the campaign lease" }));
      return;
    }
    journal.owner = owner;
    journal.leaseUntil = new Date(Date.now() + 10 * 60000).toISOString();
    journal.revision++;
    generation = await writeJournal(journal, generation);
    held = true;
  }
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("Instagram credential unavailable in Secrets");
  async function persist() {
    if (!execute) return;
    if (!held || journal.owner !== owner || new Date(journal.leaseUntil).getTime() < Date.now() + 30000 ||
        Date.now() - startedAt > 4 * 60000)
      throw new Error("Worker lease or execution budget expired; stop without another external write");
    journal.revision++;
    generation = await writeJournal(journal, generation);
  }
  async function api(path, fields) {
    let response;
    try {
      response = await fetch(`https://graph.instagram.com/v24.0/${path}`, {
        method: fields ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}` },
        body: fields ? new URLSearchParams(fields) : undefined,
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new Error("Instagram transport outcome uncertain; reconcile saved write state before retrying");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) {
      const error = new Error(`Instagram HTTP ${response.status}, code ${result.error?.code ?? "unknown"}, subcode ${result.error?.error_subcode ?? "none"}`);
      error.providerCode = result.error?.code;
      error.definiteRejection = Boolean(result.error);
      throw error;
    }
    return result;
  }
  const profile = await api("me?fields=user_id,username");
  if (profile.username !== manifest.account) throw new Error("Unexpected Instagram account; no publication allowed");
  const user = profile.user_id || profile.id;
  // Query enough recent media to reconcile this finite campaign before writes.
  const recent = await api(`${user}/media?fields=id,caption,permalink,timestamp&limit=100`);
  if (!Array.isArray(recent.data)) throw new Error("Cannot reconcile Instagram media");
  for (const post of manifest.posts) {
    const matches = recent.data.filter(media => media.caption === post.instagram);
    if (matches.length > 1) throw new Error(`Duplicate campaign caption needs review: ${post.id}`);
    if (matches.length) {
      const match = matches[0];
      if (!match.timestamp || !match.permalink) throw new Error("Incomplete publication receipt");
      journal.posts[post.id] = {
        ...journal.posts[post.id], status: "published", mediaId: match.id,
        permalink: match.permalink, publishedAt: match.timestamp,
      };
    }
    const state = journal.posts[post.id];
    if (state?.status === "published_receipt_pending" && state.mediaId) {
      const receipt = await api(`${state.mediaId}?fields=id,caption,permalink,timestamp`);
      if (receipt.caption !== post.instagram || !receipt.timestamp || !receipt.permalink)
        throw new Error("Published media receipt requires manual reconciliation");
      Object.assign(state, {
        status: "published", permalink: receipt.permalink, publishedAt: receipt.timestamp,
      });
    }
    if (state?.status === "publication_rejected" && state.errorCode === 9007 && state.containerId) {
      const container = await api(`${state.containerId}?fields=status_code`);
      if (container.status_code === "FINISHED") state.status = "container_created";
    }
    if (["creation_rejected", "publication_rejected"].includes(state?.status))
      throw new Error(`Provider rejected prior write; review campaign item ${post.id} before retrying`);
    // Do not automatically catch up old posts or publish several at once.
    if (!["published", "publication_started", "creation_started", "published_receipt_pending", "missed"].includes(state?.status) &&
        Date.now() - new Date(post.publishAt).getTime() > 3600000)
      journal.posts[post.id] = { ...state, status: "missed", reason: "One-hour posting window passed; owner review required" };
  }
  const now = new Date();
  const post = nextDue(manifest, journal, now);
  if (!execute) {
    console.log(JSON.stringify({
      checkPassed: true, account: profile.username, execute: false,
      published: Object.values(journal.posts).filter(p => p.status === "published").length,
      nextDue: post?.id || null, assetsPrepared: manifest.posts.length,
      durableWorkerActivated: journal.active === true, paidSpend: 0,
      ...(verifyAssets ? { approvedAssetsVerified: manifest.posts.length, signedMediaDownloadVerified: true } : {}),
    }));
    return;
  }
  journal.active = true;
  journal.lastRunAt = now.toISOString();
  await persist();
  if (!post) {
    console.log(JSON.stringify({ action: "no_due_post", account: profile.username, paidSpend: 0 }));
    return;
  }
  checkSpacing(manifest, journal, now);
  let state = journal.posts[post.id] || {};
  async function update(extra) {
    state = { ...state, ...extra, updatedAt: new Date().toISOString() };
    journal.posts[post.id] = state;
    await persist();
  }
  try {
    if (!state.containerId) {
      const [bytes] = await campaignFile(post.assetObject).download();
      if (sha256(bytes) !== post.assetSha256) throw new Error("Stored asset no longer matches owner approval");
      const url = await signedAssetUrl(post.assetObject);
      await update({ status: "creation_started" });
      const container = await api(`${user}/media`, post.kind === "video"
        ? { media_type: "REELS", video_url: url, caption: post.instagram, share_to_feed: "true" }
        : { image_url: url, caption: post.instagram });
      if (!container.id) throw new Error("Missing container ID; do not repeat creation automatically");
      await update({ status: "container_created", containerId: container.id });
    }
    let ready = false;
    for (let i = 0; i < 20; i++) {
      const container = await api(`${state.containerId}?fields=status_code`);
      if (container.status_code === "FINISHED") { ready = true; break; }
      if (["ERROR", "EXPIRED", "PUBLISHED"].includes(container.status_code))
        throw new Error(`Container ${container.status_code}; reconcile without creating a replacement`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    if (!ready) {
      console.log(JSON.stringify({ id: post.id, processing: true, resumeSameContainer: true }));
      return;
    }
    // Recheck actual wall time immediately before publication.
    if (Date.now() > new Date(post.expiresAt).getTime() ||
        Date.now() - new Date(post.publishAt).getTime() > 3600000)
      throw new Error("Posting window ended while processing; do not publish late");
    checkSpacing(manifest, journal, new Date());
    await update({ status: "publication_started" });
    const result = await api(`${user}/media_publish`, { creation_id: state.containerId });
    if (!result.id) throw new Error("Missing published media ID; reconcile before retrying");
    await update({ status: "published_receipt_pending", mediaId: result.id });
    const receipt = await api(`${result.id}?fields=id,permalink,timestamp`);
    if (!receipt.timestamp || !receipt.permalink) throw new Error("Incomplete publication receipt; reconcile on next run");
    await update({ status: "published", permalink: receipt.permalink, publishedAt: receipt.timestamp });
    console.log(JSON.stringify({ id: post.id, published: true, permalink: receipt.permalink, paidSpend: 0 }));
  } catch (error) {
    let status = state.status;
    if (error.definiteRejection && status === "creation_started") status = "creation_rejected";
    if (error.definiteRejection && status === "publication_started") status = "publication_rejected";
    await update({ status, lastError: error.message, errorCode: error.providerCode ?? null });
    throw error;
  }
}

try {
  await main();
} catch (error) {
  // Avoid printing transport objects, signed URLs, request bodies, or tokens.
  console.error(JSON.stringify({ ok: false, error: error.message?.startsWith("Instagram") ||
    !error.code ? error.message : `Campaign storage failure (${error.code})`, paidSpend: 0 }));
  process.exitCode = 1;
} finally {
  if (held) {
    try {
      journal.owner = null;
      journal.leaseUntil = null;
      journal.revision++;
      await writeJournal(journal, generation);
    } catch {
      console.error("Campaign lease release failed; next worker must wait for expiry");
      process.exitCode = 1;
    }
  }
}
