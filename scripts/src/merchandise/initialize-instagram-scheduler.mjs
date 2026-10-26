import { readFile } from "node:fs/promises";
import { campaignFile, readJournal, writeJournal, sha256 } from "./instagram-campaign-store.mjs";
import { validateManifest } from "./instagram-schedule-core.mjs";

export async function verifySeed() {
  const { manifest, manifestSha256 } = JSON.parse(await readFile(
    "wordpress/sless-refresh/instagram-scheduler-manifest.json", "utf8",
  ));
  validateManifest(manifest);
  if (sha256(JSON.stringify(manifest)) !== manifestSha256) throw new Error("Manifest hash mismatch");
  const seed = JSON.parse(await readFile("campaign-seed/journal.json", "utf8"));
  if (seed.manifestSha256 !== manifestSha256 || seed.account !== manifest.account ||
      seed.active !== false || seed.owner || seed.leaseUntil)
    throw new Error("Seed is not an inactive matching campaign");
  const uploads = [];
  for (const post of manifest.posts) {
    if (sha256(JSON.stringify({ instagram: post.instagram, facebook: post.facebook })) !== post.captionsSha256)
      throw new Error(`Caption approval mismatch: ${post.id}`);
    const state = seed.posts[post.id];
    if (state && !["published", "missed"].includes(state.status))
      throw new Error("Unresolved source publication must be reconciled before migration");
    if (state?.status === "published" && (!state.mediaId || !state.permalink ||
        !Number.isFinite(+new Date(state.publishedAt))))
      throw new Error("Incomplete original publication receipt");
    const bytes = await readFile(`campaign-seed/${post.assetObject}`);
    if (sha256(bytes) !== post.assetSha256) throw new Error(`Asset approval mismatch: ${post.id}`);
    uploads.push({ post, bytes });
  }
  if (seed.posts.I08?.status !== "published") throw new Error("Original launch receipt is required");
  return { seed, uploads, manifestSha256, account: manifest.account };
}

async function main() {
  const prepared = await verifySeed();
  if (process.argv.includes("--verify-only")) {
    console.log(JSON.stringify({ verified: true, assets: prepared.uploads.length, execute: false }));
    return;
  }
  if (process.env.REPLIT_DEPLOYMENT === "1" || !process.argv.includes("--confirm-original-stopped"))
    throw new Error("Initialize only in the new workspace, with --confirm-original-stopped after confirming the old scheduler is stopped");
  let existing;
  try { existing = await readJournal(); }
  catch (error) { if (Number(error.code) !== 404) throw error; }
  if (existing && (existing.data.manifestSha256 !== prepared.manifestSha256 ||
      existing.data.account !== prepared.account))
    throw new Error("Another campaign already exists; do not overwrite");
  for (const { post, bytes } of prepared.uploads) {
    const object = campaignFile(post.assetObject);
    try {
      await object.save(bytes, {
        resumable: false, contentType: post.kind === "video" ? "video/mp4" : "image/jpeg",
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (error) { if (Number(error.code) !== 412) throw error; }
    const [saved] = await object.download();
    if (sha256(saved) !== post.assetSha256) throw new Error(`Stored asset mismatch: ${post.id}`);
  }
  // Never replace an existing journal, including newer publication receipts.
  if (!existing) {
    await writeJournal({
      ...prepared.seed, revision: 0, owner: null, leaseUntil: null,
      active: false, importedAt: new Date().toISOString(),
    }, 0);
  }
  console.log(JSON.stringify({ initialized: true, assets: prepared.uploads.length, journalPreserved: true, published: false }));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch(() => {
    console.error("Initialization failed. Check storage access, approved seed files, and original scheduler shutdown; no journal was overwritten.");
    process.exitCode = 1;
  });
}
