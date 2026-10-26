/** Private, self-contained review copy. This script cannot publish anything. */
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const dir = "generated-artifacts/holiday-marketing";
const { products } = JSON.parse(await readFile(`${dir}/campaign-products.json`, "utf8"));
const byId = new Map(products.map(p => [p.id, p]));
const terms = "Sale ends October 25, 2026 at 11:59 p.m. Eastern. No code needed. Prices vary by size. Shipping and tax additional. Made to order; holiday arrival is not guaranteed.";
const images = [
  ["I01", "feed-01-660.jpg", 660, "Halloween tee", "Your Halloween fit deserves an entrance.", "Halloween style with Sless After Dark. The tee now starts at $20—20% off its regular price.", "#SlessIsMore #HalloweenStyle #WrestlingMerch"],
  ["I02", "feed-02-330.jpg", 330, "Halloween hoodie", "Hoodie season. Main-event energy.", "Sless After Dark brings the Halloween artwork to a heavy-blend hoodie. Now from $34.40 in the holiday sale.", "#SlessIsMore #HalloweenStyle #HoodieSeason"],
  ["I03", "feed-03-238.jpg", 238, "Halloween oversized tee", "Go oversized. Bring the after-dark energy.", "The Sless After Dark oversized garment-dyed tee is now from $28.80. Get 20% off this holiday top.", "#SlessIsMore #OversizedTee #HalloweenStyle"],
  ["I04", "feed-04-260.jpg", 260, "Thanksgiving triblend tee", "Bring more than a side dish.", "Be Thankful for Sless! The Thanksgiving triblend tee is now from $38.40, down from a starting price of $48.", "#SlessIsMore #ThanksgivingStyle #WrestlingMerch"],
  ["I05", "feed-05-323.jpg", 323, "Thanksgiving sweatshirt", "Gratitude, with a Sless twist.", "The Be Thankful for Sless! garment-dyed sweatshirt is now from $56, down from $70. Part of the 20%-off holiday-tops sale.", "#SlessIsMore #ThanksgivingStyle #SweatshirtSeason"],
  ["I06", "feed-06-735.jpg", 735, "Christmas tee", "Holiday cheer, but make it Sless.", "The Sless Is Cheer Christmas tee now starts at $20. Choose from the colors and sizes currently offered in the store.", "#SlessIsMore #ChristmasStyle #WrestlingMerch"],
  ["I07", "feed-07-314.jpg", 314, "Christmas crewneck", "Your holiday rotation needs more cheer.", "The Sless Is Cheer heavy-blend crewneck is now from $28.80. Get 20% off this Christmas sweatshirt.", "#SlessIsMore #ChristmasStyle #CrewneckSeason"],
  ["I08", "feed-08-all-seven.jpg", null, "All seven holiday tops", "Seven holiday tops. One 20%-off sale.", "Halloween, Thanksgiving, and Christmas artwork across tees, hoodies, and sweatshirts. Holiday tees start at $20. The offer applies to these seven holiday tops—not the entire store.", "#SlessIsMore #HolidayStyle #WrestlingMerch"],
  ["I09", "feed-09-last-call.jpg", null, "Last call — October 25 only", "Last call for 20% off the holiday tops.", "The holiday-tops sale ends tonight, October 25, at 11:59 p.m. Eastern. Choose your Sless holiday design before regular prices return.", "#SlessIsMore #HolidayStyle #WrestlingMerch"],
];
const reels = [
  ["V01", "reel-01-halloween.mp4", 660, "Halloween video", "Spooky season. Sless energy.", "Halloween tops are 20% off: the tee starts at $20, the oversized tee at $28.80, and the hoodie at $34.40.", "#SlessIsMore #HalloweenStyle #WrestlingMerch"],
  ["V02", "reel-02-thanksgiving.mp4", 260, "Thanksgiving video", "Be thankful. Be Sless.", "Thanksgiving style, served with personality. The triblend tee starts at $38.40 and the garment-dyed sweatshirt at $56 in the 20%-off holiday sale.", "#SlessIsMore #ThanksgivingStyle #WrestlingMerch"],
  ["V03", "reel-03-christmas.mp4", 735, "Christmas video", "The forecast calls for more cheer.", "Sless Is Cheer Christmas tops are 20% off. The tee starts at $20 and the heavy-blend crewneck at $28.80.", "#SlessIsMore #ChristmasStyle #WrestlingMerch"],
];
const suggestions = {
  I01: "Oct 20", I02: "Oct 21", I03: "Oct 23", I04: "Oct 20", I05: "Oct 22",
  I06: "Oct 22", I07: "Oct 24", I08: "Launch", I09: "Oct 25 only",
  V01: "Oct 19 or 21", V02: "Oct 21 or 23", V03: "Oct 23 or 24",
};
const revisedCopyFile = `${dir}/festive-copy.json`;
const revisedCopy = JSON.parse(await readFile(revisedCopyFile, "utf8"));
if (!Array.isArray(revisedCopy) || revisedCopy.length !== 12) {
  throw Error("The festive revision must supply copy for all 12 ads.");
}
const copyById = new Map(revisedCopy.map(p => [p.id, p]));
if (copyById.size !== 12) throw Error("Duplicate IDs in the festive revision.");
const drafts = [...images, ...reels].map(([id, file, pid, title, hook, body, tags]) => {
  const copy = copyById.get(id);
  if (!copy || [copy.hook, copy.body, copy.hashtags].some(s => typeof s !== "string" || !s.trim())) {
    throw Error(`Missing festive copy for ${id}`);
  }
  hook = copy.hook;
  body = copy.body;
  tags = copy.hashtags;
  const url = pid ? byId.get(pid).url : "https://slessismore.org/";
  const instagram = `${hook}\n\n${body}\n\n${terms}\n\nShop the holiday sale through the link in bio.\n\n${tags}`;
  const facebook = `${hook}\n\n${body}\n\n${terms}\n\nShop this ${pid ? "design" : "sale"}: ${url}?utm_source=facebook&utm_medium=organic_social&utm_campaign=holiday_tops_oct2026&utm_content=${id.toLowerCase()}`;
  if (hook.length > 125 || instagram.length > 2200) throw Error(`Caption too long: ${id}`);
  return {
    id, file, title, productId: pid, productUrl: url, hook,
    kind: id.startsWith("I") ? "image" : "video",
    suggestedUse: suggestions[id], notBefore: id === "I09" ? "2026-10-25" : null,
    expiresAt: "2026-10-25T23:59:59-04:00",
    approvalStatus: "awaiting_owner_review", instagram, facebook,
  };
});
for (const draft of drafts) {
  const s = await stat(`${dir}/exports/${draft.file}`);
  if (!s.size) throw Error(`Missing creative ${draft.id}`);
}
await writeFile(`${dir}/review-drafts.json`, JSON.stringify({
  approvalRequiredBeforePublishing: true,
  approvalAppliesTo: "Actual image/video files and their final captions, not the separate animation preview.",
  copySource: revisedCopyFile,
  bioLinkNeedsConfirmation: false,
  bioLinkConfirmation: { confirmed: true, source: "owner_confirmation" },
  note: "The owner confirmed the store link is in the Instagram bio. The revised ads and captions still need approval.",
  automaticSchedulingConfigured: false,
  drafts,
}, null, 2));
const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const blocks = [];
for (const p of drafts) {
  const bytes = await readFile(`${dir}/exports/${p.file}`);
  const mime = p.kind === "image" ? "image/jpeg" : "video/mp4";
  const src = `data:${mime};base64,${bytes.toString("base64")}`;
  const media = p.kind === "image"
    ? `<img src="${src}" alt="${esc(p.title)}">`
    : `<video controls playsinline preload="metadata" src="${src}"></video>`;
  blocks.push(`<article id="${p.id}"><header><b>${p.id}</b><h2>${esc(p.title)}</h2><span>${esc(p.suggestedUse)}</span></header>
    <div class="body"><div class="media">${media}<button type="button" data-filename="${esc(p.file)}" onclick="const a=document.createElement('a');a.href=this.previousElementSibling.src;a.download=this.dataset.filename;a.click()">Download ${p.kind === "video" ? "MP4" : "JPG"}</button></div>
    <div class="copy"><h3>Instagram caption</h3><pre>${esc(p.instagram)}</pre><details><summary>Facebook caption and clickable shopping link</summary><pre>${esc(p.facebook)}</pre></details>
    ${p.id === "I09" ? '<p class="notice">LAST-DAY AD: use only October 25, before 11:59 p.m. Eastern.</p>' : ""}
    </div></div></article>`);
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sless holiday campaign — festive revision for approval</title><style>
*{box-sizing:border-box}body{margin:0;background:#eeeae2;color:#171714;font:16px/1.5 Arial,sans-serif}main{max-width:1180px;margin:auto;padding:30px 20px 60px}h1{font-size:clamp(32px,6vw,60px);line-height:1.05;margin:12px 0}h2{font-size:23px;margin:0}h3{font-size:15px;text-transform:uppercase;letter-spacing:.05em}p{max-width:900px}.flag,header b{background:#ffd700;color:#0a0a0a;padding:7px 12px;font-weight:800}.intro{background:#0a0a0a;color:#f6f3eb;padding:30px;border-radius:12px}.notice{padding:14px 18px;border:2px solid #a45308;background:#fff4da;color:#633400;border-radius:8px}nav{display:flex;gap:8px;flex-wrap:wrap;padding:18px 0}nav a{padding:8px 12px;border:1px solid #aaa;color:inherit;text-decoration:none;border-radius:6px}article{background:white;border:1px solid #c9c5bb;border-radius:10px;overflow:hidden;margin:22px 0;scroll-margin-top:15px}article header{display:flex;align-items:center;gap:14px;padding:17px 20px;background:#f6f3eb;flex-wrap:wrap}header span{margin-left:auto;font-size:13px;color:#555}.body{display:grid;grid-template-columns:minmax(260px,430px) 1fr;gap:28px;padding:24px}.media img,.media video{display:block;width:100%;height:auto;background:#111}.media video{max-height:690px}.media>a{display:block;text-align:center;margin-top:12px;color:#171714;font-weight:bold}.copy{min-width:0}pre{font:15px/1.6 Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:bold;border-top:1px solid #ddd;padding-top:18px}footer{font-size:14px;color:#555}@media(max-width:700px){main{padding:16px}.intro{padding:22px}.body{grid-template-columns:1fr;padding:16px;gap:12px}article header{padding:14px}h2{font-size:19px}header span{margin-left:0}}
</style><main><section class="intro"><span class="flag">DRAFTS · NOT PUBLISHED</span><h1>Review every ad<br>before it goes live.</h1><p>9 feed images + 3 actual 10-second MP4 videos. Each item has its final proposed caption. Reply with the IDs you approve, or name an ID and the change you want.</p><p><b>Offer:</b> 20% off the seven holiday tops, through October 25, 2026 at 11:59 p.m. Eastern. No coupon needed.</p></section>
<p class="notice"><b>Festive revision — awaiting your approval.</b> You confirmed the store link is in your Instagram bio. I09 is for October 25 only. Suggested dates are a posting plan, not an active schedule.</p>
<nav>${drafts.map(p => `<a href="#${p.id}">${p.id}</a>`).join("")}</nav>${blocks.join("\n")}
<footer>No posts, ad purchases or publishing jobs have been created. The separate animated preview is not identical to the three uploadable MP4s reviewed here.</footer></main></html>`;
await writeFile(`${dir}/campaign-review-festive.html`, html);
console.log(JSON.stringify({reviewPage:resolve(`${dir}/campaign-review-festive.html`),creatives:drafts.length,allAwaitingApproval:true,bytes:Buffer.byteLength(html)}));
