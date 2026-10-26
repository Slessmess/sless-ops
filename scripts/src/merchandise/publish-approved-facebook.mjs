import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { saveJson } from "./printify-api.mjs";

const pageId = "401634216613866";
const execute = process.argv.includes("--execute");
const base = "wordpress/sless-refresh";
const reportPath = `${base}/facebook-campaign-publication.json`;
const review = JSON.parse(await readFile("generated-artifacts/holiday-marketing/review-drafts.json", "utf8"));
const approval = JSON.parse(await readFile(`${base}/holiday-campaign-approval.json`, "utf8"));
const plan = JSON.parse(await readFile(`${base}/holiday-posting-plan.json`, "utf8"));
let report;
try { report = JSON.parse(await readFile(reportPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  report = { pageId, pageName: "Sless Taylor", scheduler: "Facebook native", paidSpend: 0, posts: {} };
}
if (report.pageId !== pageId) throw new Error("Report Page mismatch");
const saved = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
if (!saved) throw new Error("Saved Facebook credential unavailable");

async function api(path, token, fields) {
  const response = await fetch(`https://graph.facebook.com/v26.0/${path}`, {
    method: fields ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}` },
    body: fields,
    signal: AbortSignal.timeout(fields ? 120000 : 30000),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    const error = new Error(`Facebook HTTP ${response.status}, code ${data.error?.code}, subcode ${data.error?.error_subcode ?? "none"}: ${data.error?.message ?? "request failed"}`);
    error.definiteRejection = Boolean(data.error);
    throw error;
  }
  return data;
}
const page = await api(`${pageId}?fields=id,name,access_token`, saved);
const token = page.access_token || saved; // Resolved at runtime only; never persist credentials.
const identity = await api("me?fields=id,name", token);
if (identity.id !== pageId || identity.name !== "Sless Taylor") throw new Error("Unexpected publishing Page");

async function list(edge) {
  const posts = [];
  let after;
  for (let n = 0; n < 20; n++) {
    const params = new URLSearchParams({
      fields: "id,message,created_time,scheduled_publish_time,is_published,permalink_url",
      limit: "100",
      ...(after ? { after } : {}),
    });
    const data = await api(`${pageId}/${edge}?${params}`, token);
    posts.push(...(data.data || []));
    if (!data.paging?.next) return posts;
    after = data.paging.cursors?.after;
    if (!after) throw new Error("Cannot safely paginate Page posts");
  }
  throw new Error("Page post reconciliation limit reached");
}
const existing = [...await list("published_posts"), ...await list("scheduled_posts")];
const hash = value => createHash("sha256").update(value).digest("hex");
const dateKey = date => new Intl.DateTimeFormat("en-CA", { timeZone: plan.timezone }).format(date);
const jobs = [];
for (const slot of plan.posts) {
  const draft = review.drafts.find(x => x.id === slot.id);
  const approved = approval.approved.find(x => x.id === slot.id);
  if (!draft || !approved || draft.approvalStatus !== "approved_by_owner") throw new Error(`Approval missing: ${slot.id}`);
  const bytes = await readFile(`generated-artifacts/holiday-marketing/exports/${draft.file}`);
  if (hash(bytes) !== approved.assetSha256 ||
      hash(JSON.stringify({ instagram: draft.instagram, facebook: draft.facebook })) !== approved.captionsSha256)
    throw new Error(`Approved creative changed: ${slot.id}`);
  const when = slot.id === "I08" ? new Date() : new Date(slot.publishAt);
  if (when > new Date(approved.expiresAt) || new Date() > new Date(approved.expiresAt) ||
      (approved.notBefore && dateKey(when) < approved.notBefore))
    throw new Error(`Creative date restriction: ${slot.id}`);
  if (slot.id !== "I08" && when.getTime() < Date.now() + 10 * 60000)
    throw new Error(`Scheduled slot must be at least 10 minutes ahead: ${slot.id}`);
  jobs.push({ slot, draft, approved, bytes, when });
}
const times = jobs.map(x => x.when).sort((a, b) => a - b);
for (let i = 0; i < times.length; i++) {
  if (times.filter(t => dateKey(t) === dateKey(times[i])).length > plan.maxPostsPerDay)
    throw new Error("Daily posting limit exceeded");
  if (i && times[i] - times[i - 1] < plan.minimumHoursBetweenPosts * 3600000)
    throw new Error("Minimum post spacing violated");
}
async function persist(id, extra) {
  report.posts[id] = { ...report.posts[id], ...extra, updatedAt: new Date().toISOString() };
  await saveJson(reportPath, report);
}

for (const { slot, draft, approved, bytes, when } of jobs) {
  const match = existing.find(x => x.message === draft.facebook);
  if (match) {
    const expected = Math.floor(when.getTime() / 1000);
    if (slot.id !== "I08" && (!match.scheduled_publish_time || Number(match.scheduled_publish_time) !== expected))
      throw new Error(`Existing matching post needs manual timing reconciliation: ${slot.id}`);
    await persist(slot.id, {
      status: match.is_published ? "published" : "scheduled",
      postId: match.id, permalink: match.permalink_url,
      scheduledPublishTime: match.scheduled_publish_time || null, reconciled: true,
    });
    console.log(JSON.stringify({ id: slot.id, reconciled: true, postId: match.id }));
    continue;
  }
  if (report.posts[slot.id]?.status)
    throw new Error(`Saved write state requires reconciliation before retry: ${slot.id}`);
  if (!execute) {
    console.log(JSON.stringify({ id: slot.id, action: slot.id === "I08" ? "publish" : "schedule", publishAt: when.toISOString(), kind: draft.kind }));
    continue;
  }
  const scheduled = slot.id !== "I08";
  await persist(slot.id, {
    status: "creation_started", assetSha256: approved.assetSha256,
    captionSha256: approved.captionsSha256, publishAt: when.toISOString(), kind: draft.kind,
  });
  try {
    const form = new FormData();
    const video = draft.kind === "video";
    form.set("source", new Blob([bytes], { type: video ? "video/mp4" : "image/jpeg" }), draft.file);
    form.set(video ? "description" : "caption", draft.facebook);
    form.set("published", scheduled ? "false" : "true");
    if (scheduled) {
      form.set("scheduled_publish_time", String(Math.floor(when.getTime() / 1000)));
      form.set("unpublished_content_type", "SCHEDULED");
    }
    const created = await api(`${pageId}/${video ? "videos" : "photos"}`, token, form);
    if (!created.id) throw new Error("Missing created media ID; outcome uncertain");
    await persist(slot.id, {
      status: "created_unverified", mediaId: created.id, postId: created.post_id || null,
    });
    if (created.post_id) {
      const post = await api(`${created.post_id}?fields=id,message,is_published,scheduled_publish_time,permalink_url`, token);
      if (post.message !== draft.facebook ||
          (scheduled && (post.is_published !== false || Number(post.scheduled_publish_time) !== Math.floor(when.getTime() / 1000))) ||
          (!scheduled && post.is_published !== true))
        throw new Error("Post read-back did not match approved content or timing");
      await persist(slot.id, {
        status: scheduled ? "scheduled" : "published", permalink: post.permalink_url,
        scheduledPublishTime: post.scheduled_publish_time || null,
        ...(scheduled ? {} : { publishedAt: new Date().toISOString() }),
      });
    } else {
      // Video uploads can process asynchronously. Keep the created ID and never blindly upload again.
      let post;
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidates = await list(scheduled ? "scheduled_posts" : "published_posts");
        post = candidates.find(x => x.message === draft.facebook);
        if (post) break;
        const media = await api(`${created.id}?fields=id,status`, token);
        if (media.status?.video_status === "error") throw new Error("Video processing failed; preserve media ID for reconciliation");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (!post || (scheduled && Number(post.scheduled_publish_time) !== Math.floor(when.getTime() / 1000)))
        throw new Error("Created media not yet confirmed on Page; reconcile saved ID before continuing");
      await persist(slot.id, {
        status: scheduled ? "scheduled" : "published", postId: post.id,
        permalink: post.permalink_url, scheduledPublishTime: post.scheduled_publish_time || null,
      });
    }
    console.log(JSON.stringify({ id: slot.id, ...report.posts[slot.id] }));
  } catch (error) {
    await persist(slot.id, { lastError: error.message, definiteRejection: error.definiteRejection || false });
    throw error;
  }
}
console.log(JSON.stringify({
  execute, pageId,
  published: Object.values(report.posts).filter(x => x.status === "published").length,
  scheduled: Object.values(report.posts).filter(x => x.status === "scheduled").length,
  paidSpend: 0,
}));
