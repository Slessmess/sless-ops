import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { saveJson } from "./printify-api.mjs";

// Operator action: run only after explicit owner approval of these actual files.
const dir = "generated-artifacts/holiday-marketing";
const review = JSON.parse(await readFile(`${dir}/review-drafts.json`, "utf8"));
if (review.drafts.length !== 12) throw new Error("Expected the 12 owner-reviewed drafts");
const approvedAt = new Date().toISOString();
const approved = [];
for (const draft of review.drafts) {
  const bytes = await readFile(`${dir}/exports/${draft.file}`);
  const captions = JSON.stringify({ instagram: draft.instagram, facebook: draft.facebook });
  approved.push({
    id: draft.id, file: draft.file,
    assetSha256: createHash("sha256").update(bytes).digest("hex"),
    captionsSha256: createHash("sha256").update(captions).digest("hex"),
    notBefore: draft.notBefore, expiresAt: draft.expiresAt,
  });
  draft.approvalStatus = "approved_by_owner";
}
await saveJson("wordpress/sless-refresh/holiday-campaign-approval.json", {
  approvedAt, approval: "Owner selected Approve all 12", approved,
  paidAdvertisingSpendAuthorized: false,
  storyLinkStickerRequired: true,
  automaticSchedulingConfigured: false,
});
review.note = "Owner approved all 12 actual assets and captions. No paid spend authorized. Dates remain suggested, not an active schedule.";
review.creativeApprovalGranted = true;
review.approvedAt = approvedAt;
await saveJson(`${dir}/review-drafts.json`, review);
const readinessPath = "wordpress/sless-refresh/marketing-tracking-readiness.json";
const readiness = JSON.parse(await readFile(readinessPath, "utf8"));
readiness.creativeApprovalGranted = true;
readiness.creativeApprovalRecord = "holiday-campaign-approval.json";
readiness.nextBlocker = "Creative approved for all 12 assets/captions; verify organic publishing access. No paid spend authorized. Stories require a native clickable link sticker. Suggested dates are not an active schedule.";
await saveJson(readinessPath, readiness);
console.log(JSON.stringify({ approved: approved.map(x => x.id), paidSpendAuthorized: false }));
