import { readFile } from "node:fs/promises";
import { campaignFile, readJournal, writeJournal, sha256, signedAssetUrl } from "./instagram-campaign-store.mjs";
import { validateManifest } from "./instagram-schedule-core.mjs";
import { saveJson } from "./printify-api.mjs";

const base = "wordpress/sless-refresh";
const plan = JSON.parse(await readFile(`${base}/holiday-posting-plan.json`, "utf8"));
const approval = JSON.parse(await readFile(`${base}/holiday-campaign-approval.json`, "utf8"));
const review = JSON.parse(await readFile("generated-artifacts/holiday-marketing/review-drafts.json", "utf8"));
const receipt = JSON.parse(await readFile(`${base}/instagram-campaign-publication.json`, "utf8"));
const manifest = {
  account: "slessismoree", timezone: plan.timezone,
  maxPostsPerDay: plan.maxPostsPerDay, minimumHoursBetweenPosts: plan.minimumHoursBetweenPosts,
  paidSpendAuthorized: false,
  posts: [],
};
const uploads = [];
for (const slot of plan.posts) {
  const draft = review.drafts.find(p => p.id === slot.id);
  const approved = approval.approved.find(p => p.id === slot.id);
  if (!draft || !approved || draft.approvalStatus !== "approved_by_owner")
    throw new Error(`Owner approval missing: ${slot.id}`);
  const bytes = await readFile(`generated-artifacts/holiday-marketing/exports/${draft.file}`);
  if (sha256(bytes) !== approved.assetSha256 ||
      sha256(JSON.stringify({ instagram: draft.instagram, facebook: draft.facebook })) !== approved.captionsSha256)
    throw new Error(`Approval hash mismatch: ${slot.id}`);
  const assetObject = `assets/${slot.id}-${approved.assetSha256}.${draft.kind === "video" ? "mp4" : "jpg"}`;
  manifest.posts.push({
    id: slot.id, kind: draft.kind, publishAt: slot.publishAt,
    expiresAt: approved.expiresAt, notBefore: approved.notBefore,
    assetSha256: approved.assetSha256, captionsSha256: approved.captionsSha256,
    instagram: draft.instagram, facebook: draft.facebook, assetObject,
  });
  uploads.push({ bytes, assetObject, kind: draft.kind, id: slot.id });
}
validateManifest(manifest);
const manifestSha256 = sha256(JSON.stringify(manifest));
for (const upload of uploads) {
  const file = campaignFile(upload.assetObject);
  try {
    await file.save(upload.bytes, {
      resumable: false, contentType: upload.kind === "video" ? "video/mp4" : "image/jpeg",
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (error) {
    if (Number(error.code) !== 412) throw error;
  }
  const [stored] = await file.download();
  if (sha256(stored) !== sha256(upload.bytes)) throw new Error(`Stored media hash mismatch: ${upload.id}`);
}
// Test Meta's eventual download path without recording its signed URL.
const url = await signedAssetUrl(manifest.posts.find(p => p.id === "V01").assetObject);
const response = await fetch(url, { headers: { Range: "bytes=0-31" }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Signed media download failed: HTTP ${response.status}`);
await response.arrayBuffer();
let journal;
try { journal = await readJournal(); }
catch (error) { if (Number(error.code) !== 404) throw error; }
if (journal && journal.data.manifestSha256 !== manifestSha256) throw new Error("Existing scheduler differs; do not overwrite");
if (!journal) {
  await writeJournal({
    revision: 0, owner: null, leaseUntil: null,
    manifestSha256, account: manifest.account, active: false,
    posts: receipt.posts, preparedAt: new Date().toISOString(),
  }, 0);
}
await saveJson(`${base}/instagram-scheduler-manifest.json`, { manifestSha256, manifest });
await saveJson(`${base}/instagram-scheduler-readiness.json`, {
  prepared: true, automaticSchedulingActive: false, activationRequired: "Replit Scheduled publishing",
  runCommand: "node scripts/src/merchandise/run-instagram-schedule.mjs --execute",
  cron: "*/5 12,18 20-25 10 *", timezone: "America/New_York", jobTimeoutMinutes: 5,
  account: manifest.account, approvedAssetsVerified: uploads.length,
  privateMediaStorage: "App Storage", journalStorage: "App Storage",
  credentialsRemainInSecrets: true, paidSpend: 0,
});
console.log(JSON.stringify({ prepared: true, assetsVerified: uploads.length, signedMediaDownloadVerified: true, active: false }));
