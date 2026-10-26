/** Record the owner's explicit approval; this does not publish anything. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--owner-confirmed"))
  throw new Error("Explicit owner confirmation is required");
const root = "generated-artifacts/live-shop-launch";
const manifest = JSON.parse(await readFile(`${root}/launch-posts.json`, "utf8"));
if (manifest.posts.map(p => p.id).join(",") !== "L01,L02,L03")
  throw new Error("Approval does not cover a changed post selection");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const posts = [];
for (const post of manifest.posts) {
  if (!post.productUrl.startsWith("https://shop.slessismore.org/product/"))
    throw new Error("Unexpected destination");
  const assets = {};
  for (const key of ["feedFile", "storyFile"]) {
    const file = post[key];
    if (!/^L0[123]-(feed|story)\.jpg$/.test(file)) throw new Error("Unexpected asset path");
    assets[file] = hash(await readFile(`${root}/${file}`));
  }
  posts.push({
    id: post.id, productUrl: post.productUrl, assetSha256: assets,
    facebookCaptionSha256: hash(post.facebook),
    instagramCaptionSha256: hash(post.instagram),
    storyLink: post.storyLink,
  });
}
const report = {
  approvedAt: new Date().toISOString(),
  evidence: "Owner explicitly selected Approve all three after reviewing the launch pack",
  approvedFor: ["Instagram organic", "Sless Taylor Facebook Page organic"],
  minimumHoursBetweenPosts: 18,
  publishAfterAccessVerifiedAndSchedulesReviewed: true,
  existingSaleScheduleChangesAuthorized: false,
  paidSpendAuthorized: false,
  storiesRequireNativeClickableLinkSticker: true,
  trackingFixesDeferredNotVerified: true,
  posts,
};
await saveJson("wordpress/sless-refresh/live-launch-approval.json", report);
console.log(JSON.stringify({ approved: posts.map(p => p.id), published: false, minimumHoursBetweenPosts: 18 }));
