import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

const id = process.argv[2];
if (!id) throw new Error("Specify one explicitly approved creative ID");
const dir = "generated-artifacts/holiday-marketing";
const review = JSON.parse(await readFile(`${dir}/review-drafts.json`, "utf8"));
const approval = JSON.parse(await readFile("wordpress/sless-refresh/holiday-campaign-approval.json", "utf8"));
const draft = review.drafts.find(x => x.id === id);
const approved = approval.approved.find(x => x.id === id);
if (!draft || !approved || draft.approvalStatus !== "approved_by_owner") throw new Error("Explicit creative approval required");
if (draft.kind !== "image") throw new Error("This operator supports approved image feed posts only, not Stories, reels or paid ads");
const now = new Date();
const easternDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
if ((draft.notBefore && easternDay < draft.notBefore) || now > new Date(draft.expiresAt)) throw new Error("Creative date restriction");
const plan = JSON.parse(await readFile("wordpress/sless-refresh/holiday-posting-plan.json", "utf8"));
const slot = plan.posts.find(x => x.id === id);
if (!slot || now < new Date(slot.publishAt)) throw new Error("Not due: staggered posting plan prevents early publication");
const bytes = await readFile(`${dir}/exports/${draft.file}`);
const hash = value => createHash("sha256").update(value).digest("hex");
if (hash(bytes) !== approved.assetSha256 ||
    hash(JSON.stringify({ instagram: draft.instagram, facebook: draft.facebook })) !== approved.captionsSha256)
  throw new Error("Creative or caption changed after approval");
const token = process.env.INSTAGRAM_ACCESS_TOKEN;
if (!token) throw new Error("Saved publishing credential unavailable");
const reportPath = "wordpress/sless-refresh/instagram-campaign-publication.json";
let report;
try { report = JSON.parse(await readFile(reportPath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; report = { posts: {} }; }
let state = report.posts[id] || {};
if (state.status === "published") {
  console.log(JSON.stringify({ id, alreadyPublished: true, permalink: state.permalink }));
  process.exit(0);
}
const previous = Object.values(report.posts).filter(x => x.status === "published");
const dateKey = d => new Intl.DateTimeFormat("en-CA", { timeZone: plan.timezone }).format(d);
if (previous.some(x => !x.publishedAt)) throw new Error("Reconcile previous publication time before posting again");
if (previous.filter(x => dateKey(new Date(x.publishedAt)) === easternDay).length >= plan.maxPostsPerDay)
  throw new Error("Daily posting limit reached");
if (previous.some(x => now - new Date(x.publishedAt) < plan.minimumHoursBetweenPosts * 3600000))
  throw new Error("Minimum spacing between posts has not elapsed");
async function api(path, method = "GET", fields) {
  const response = await fetch(`https://graph.instagram.com/v24.0/${path}`, {
    method, headers: { Authorization: `Bearer ${token}` },
    body: method === "POST" ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(`Instagram ${method} failed: HTTP ${response.status}, code ${data.error?.code ?? "unknown"}, subcode ${data.error?.error_subcode ?? "none"}`);
    error.providerCode = data.error?.code;
    throw error;
  }
  return data;
}
async function persist(extra) {
  state = { ...state, ...extra, updatedAt: new Date().toISOString() };
  report.posts[id] = state;
  await saveJson(reportPath, report);
}
try {
  const profile = await api("me?fields=user_id,username");
  if (profile.username !== "slessismoree") throw new Error("Unexpected publishing account; no write permitted");
  const user = profile.user_id || profile.id;
  const recent = await api(`${user}/media?fields=id,caption,permalink&limit=25`);
  const existing = recent.data?.find(x => x.caption === draft.instagram);
  if (existing) {
    await persist({ status: "published", mediaId: existing.id, permalink: existing.permalink, reconciledExistingPost: true });
    console.log(JSON.stringify({ id, alreadyPublished: true, permalink: existing.permalink }));
    process.exit(0);
  }
  if (state.status === "publication_started" && state.errorCode === 9007 && state.containerId) {
    // A definite not-ready rejection is retryable only after read reconciliation:
    // no published caption match above, and the same container remains unpublished.
    const check = await api(`${state.containerId}?fields=status_code`);
    if (check.status_code === "FINISHED")
      await persist({ status: "container_ready_unpublished", reconciledNotPublished: true });
  }
  if (state.status === "publication_started" || state.status === "creation_started" && !state.containerId)
    throw new Error("Previous write outcome uncertain; reconcile before retrying");
  if (!state.publicImageUrl) {
    const upload = await sitegroundWordpress(String.raw`
$p=json_decode(stream_get_contents(STDIN),true);
$existing=get_posts(array('post_type'=>'attachment','post_status'=>'inherit','numberposts'=>1,'fields'=>'ids','meta_query'=>array(array('key'=>'_sless_campaign_creative','value'=>$p['id']))));
if($existing){$aid=$existing[0];if(get_post_meta($aid,'_sless_campaign_asset_hash',true)!==$p['hash'])throw new Exception('Existing campaign media differs');}
else{$raw=base64_decode($p['image'],true);if(!$raw||hash('sha256',$raw)!==$p['hash'])throw new Exception('Media hash mismatch');
$upload=wp_upload_bits('sless-approved-'.strtolower($p['id']).'-'.$p['file'],null,$raw);if(!empty($upload['error']))throw new Exception('Approved media upload failed');
$aid=wp_insert_attachment(array('post_title'=>'Approved Sless campaign '.$p['id'],'post_mime_type'=>'image/jpeg','post_status'=>'inherit'),$upload['file'],0,true);if(is_wp_error($aid))throw new Exception('Attachment creation failed');
update_post_meta($aid,'_sless_campaign_creative',$p['id']);update_post_meta($aid,'_sless_campaign_asset_hash',$p['hash']);
require_once ABSPATH.'wp-admin/includes/image.php';wp_update_attachment_metadata($aid,wp_generate_attachment_metadata($aid,$upload['file']));}
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('attachmentId'=>$aid,'url'=>wp_get_attachment_url($aid)));
`, { input: JSON.stringify({ id, file: draft.file, hash: approved.assetSha256, image: bytes.toString("base64") }), timeoutMs: 100_000 });
    await persist({ status: "media_prepared", publicImageUrl: upload.url, attachmentId: upload.attachmentId });
  }
  if (!state.containerId) {
    await persist({ status: "creation_started" });
    const created = await api(`${user}/media`, "POST", { image_url: state.publicImageUrl, caption: draft.instagram });
    if (!created.id) throw new Error("Missing media container ID");
    await persist({ status: "container_created", containerId: created.id });
  }
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await api(`${state.containerId}?fields=status_code`);
    if (status.status_code === "FINISHED") { ready = true; break; }
    if (["ERROR", "EXPIRED"].includes(status.status_code)) throw new Error(`Media container ${status.status_code}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!ready) throw new Error("Media not ready; resume using saved container, do not recreate");
  await persist({ status: "publication_started" });
  const published = await api(`${user}/media_publish`, "POST", { creation_id: state.containerId });
  if (!published.id) throw new Error("Publication outcome uncertain; reconcile before retrying");
  await persist({ status: "published", mediaId: published.id });
  const details = await api(`${published.id}?fields=id,permalink,media_type,timestamp`);
  await persist({ permalink: details.permalink, publishedAt: details.timestamp });
  console.log(JSON.stringify({ id, published: true, permalink: details.permalink, mediaType: details.media_type, paidSpend: 0 }));
} catch (error) {
  await persist({ lastError: error.message, errorCode: error.providerCode ?? null });
  console.error(error.message);
  process.exitCode = 1;
}
