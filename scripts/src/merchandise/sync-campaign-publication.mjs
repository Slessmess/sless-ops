import { readFile } from "node:fs/promises";
import { saveJson } from "./printify-api.mjs";

const report = JSON.parse(await readFile("wordpress/sless-refresh/instagram-campaign-publication.json", "utf8"));
const published = Object.entries(report.posts).filter(([, p]) => p.status === "published" && p.permalink);
const planPath = "wordpress/sless-refresh/holiday-posting-plan.json";
const plan = JSON.parse(await readFile(planPath, "utf8"));
let facebook = null;
try { facebook = JSON.parse(await readFile("wordpress/sless-refresh/facebook-campaign-publication.json", "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const facebookScheduled = Object.values(facebook?.posts || {}).filter(p => p.status === "scheduled");
const facebookPublished = Object.values(facebook?.posts || {}).filter(p => p.status === "published");
for (const [id, post] of published) {
  const slot = plan.posts.find(x => x.id === id);
  if (slot) Object.assign(slot, { status: "published", publishedAt: post.publishedAt, permalink: post.permalink });
}
if (facebook) {
  plan.platforms = {
    instagram: { automaticSchedulingActive: false, published: published.length },
    facebook: {
      pageId: facebook.pageId, scheduler: "Facebook native",
      automaticSchedulingActive: facebookScheduled.length > 0,
      published: facebookPublished.length, scheduled: facebookScheduled.length,
      publicVisibilityVerified: facebook.publicVisibilityVerified === true,
      appLiveModeNeedsConfirmation: facebook.appLiveModeConfirmedByOwner !== true,
      appLiveModeConfirmedByOwner: facebook.appLiveModeConfirmedByOwner === true,
    },
  };
  for (const slot of plan.posts) {
    const post = facebook.posts[slot.id];
    if (post) slot.facebook = {
      status: post.status, postId: post.postId, permalink: post.permalink,
      publishAt: post.publishAt, scheduledPublishTime: post.scheduledPublishTime,
    };
  }
}
plan.note = facebook
  ? `Instagram: launch published; remaining posts not automatically scheduled. Facebook: ${facebookPublished.length} launch published and ${facebookScheduled.length} posts natively scheduled; ${facebook.appLiveModeConfirmedByOwner ? "owner confirmed app published; anonymous public visibility not independently verified" : "app Live mode/public visibility still requires confirmation"}. Maximum two daily, six hours apart; I09 October 25 only.`
  : "Only the launch post is live. Remaining posts are planned, not automatically scheduled. Observe maximum two daily, six hours apart; I09 October 25 only.";
await saveJson(planPath, plan);
const path = "wordpress/sless-refresh/marketing-tracking-readiness.json";
const readiness = JSON.parse(await readFile(path, "utf8"));
Object.assign(readiness, {
  postsPublished: published.length > 0,
  publishedPostCount: published.length,
  publicationOnHold: false,
  publicationMode: "Approved organic posts only; enforced staggered timing",
  automaticSchedulingActive: false,
  ...(facebook ? {
    facebookCampaign: plan.platforms.facebook,
    nextBlocker: `Facebook has ${facebookPublished.length} launch published and ${facebookScheduled.length} posts natively scheduled; ${facebook.appLiveModeConfirmedByOwner ? "owner confirmed app published; anonymous visibility not independently verified" : "confirm Meta app Live mode for public visibility"}. Instagram's remaining eleven posts are not automatically scheduled. No paid spend authorized; Stories require a native clickable link sticker.`,
  } : {
    nextBlocker: "Launch I08 is published. Eleven approved posts have a staggered plan but no active automatic scheduler. Reels support and a persistent scheduled runner remain to be configured. No paid spend authorized; Stories still require a native clickable link sticker.",
  }),
});
await saveJson(path, readiness);
console.log(JSON.stringify({ published: published.map(([id, p]) => ({ id, permalink: p.permalink })), remaining: plan.posts.length - published.length, automaticSchedulingActive: false }));
