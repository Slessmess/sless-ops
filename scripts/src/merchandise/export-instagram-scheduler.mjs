import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { campaignFile, readJournal, sha256 } from "./instagram-campaign-store.mjs";
import { validateManifest } from "./instagram-schedule-core.mjs";

const output = "generated-artifacts/instagram-scheduler-project";
const { manifest, manifestSha256 } = JSON.parse(await readFile(
  "wordpress/sless-refresh/instagram-scheduler-manifest.json", "utf8",
));
validateManifest(manifest);
if (sha256(JSON.stringify(manifest)) !== manifestSha256) throw new Error("Manifest mismatch");
const { data: source } = await readJournal();
if (source.active || source.owner || source.leaseUntil ||
    source.manifestSha256 !== manifestSha256 || source.account !== manifest.account)
  throw new Error("Original scheduler must be inactive and match this campaign before export");
const posts = {};
for (const [id, state] of Object.entries(source.posts)) {
  if (!["published", "missed"].includes(state.status))
    throw new Error("Reconcile in-flight source writes before exporting");
  posts[id] = Object.fromEntries(
    ["status", "mediaId", "permalink", "publishedAt", "reason"].filter(key => state[key] !== undefined)
      .map(key => [key, state[key]]),
  );
}
await mkdir(`${output}/scripts/src/merchandise`, { recursive: true });
await mkdir(`${output}/wordpress/sless-refresh`, { recursive: true });
await mkdir(`${output}/campaign-seed/assets`, { recursive: true });
for (const name of [
  "run-instagram-schedule.mjs", "instagram-campaign-store.mjs", "instagram-schedule-core.mjs",
  "instagram-schedule.test.mjs", "initialize-instagram-scheduler.mjs",
]) {
  await copyFile(`scripts/src/merchandise/${name}`, `${output}/scripts/src/merchandise/${name}`);
}
await copyFile("wordpress/sless-refresh/instagram-scheduler-manifest.json",
  `${output}/wordpress/sless-refresh/instagram-scheduler-manifest.json`);
for (const post of manifest.posts) {
  const [bytes] = await campaignFile(post.assetObject).download();
  if (sha256(bytes) !== post.assetSha256) throw new Error(`Asset mismatch: ${post.id}`);
  await writeFile(`${output}/campaign-seed/${post.assetObject}`, bytes);
}
await writeFile(`${output}/campaign-seed/journal.json`, JSON.stringify({
  manifestSha256, account: manifest.account, active: false, owner: null, leaseUntil: null,
  revision: 0, posts, exportedAt: new Date().toISOString(),
}, null, 2));
await writeFile(`${output}/package.json`, JSON.stringify({
  name: "sless-instagram-scheduler", private: true, type: "module", version: "1.0.0",
  scripts: {
    build: "node --check scripts/src/merchandise/run-instagram-schedule.mjs && node --test scripts/src/merchandise/instagram-schedule.test.mjs",
    check: "node scripts/src/merchandise/run-instagram-schedule.mjs --verify-assets",
    "verify-import": "node scripts/src/merchandise/initialize-instagram-scheduler.mjs --verify-only",
    initialize: "node scripts/src/merchandise/initialize-instagram-scheduler.mjs --confirm-original-stopped",
    start: "node scripts/src/merchandise/run-instagram-schedule.mjs --execute",
  },
  dependencies: { "@google-cloud/storage": "7.22.0" },
}, null, 2));
await writeFile(`${output}/.replit`, `modules = ["nodejs-24"]
run = ["pnpm", "run", "check"]

[deployment]
deploymentTarget = "scheduled"
build = ["sh", "-c", "pnpm install --frozen-lockfile && pnpm run build"]
run = ["node", "scripts/src/merchandise/run-instagram-schedule.mjs", "--execute"]
ignorePorts = true
`);
await writeFile(`${output}/.gitignore`, "node_modules/\ncampaign-seed/\n.env\n.env.*\n");
await writeFile(`${output}/.replitignore`, "node_modules/\ncampaign-seed/\n.env\n.env.*\n");
await copyFile("docs/instagram-scheduler-standalone.md", `${output}/README.md`);
await writeFile(`${output}/replit.md`, `This is a standalone scheduled worker, not a website.
Read README.md before setup. Do not convert it to a web artifact or alter the
approved campaign. Configure App Storage in THIS project; another project's
bucket is inaccessible. Use secure Secrets for Instagram authorization.
Verify that the original scheduler is stopped before initializing. Preserve
publication receipts; never recreate or reset a journal to clear errors.
The owner must review hosting cost and click Publish. No paid ads authorized.
`);
console.log(JSON.stringify({ exported: true, directory: output, assets: manifest.posts.length, includesSecrets: false, activated: false }));
