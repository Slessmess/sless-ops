/** Read-only provider audit. No publishing, scheduling, order or settings writes. */
import { readFile } from "node:fs/promises";
import { saveJson } from "./printify-api.mjs";

const base = "wordpress/sless-refresh";
const catalog = JSON.parse(await readFile(`${base}/printify-popup-drafts.json`, "utf8"));
const review = JSON.parse(await readFile("generated-artifacts/holiday-marketing/review-drafts.json", "utf8"));
const published = Object.values(catalog.products).filter(p => p.public && p.destinationUrl);
const report = { checkedAt: new Date().toISOString(), readOnly: true, liveProducts: [], legacyCampaignLinks: [] };

async function inspect(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    return {
      status: response.status, finalUrl: response.url,
      addToCartReference: /add to cart/i.test(html),
      ga4IdPresent: html.includes("G-RZLZGN6CRQ"),
      metaIdPresent: html.includes("910105715704651"),
    };
  } catch (error) {
    return { error: error.name === "TimeoutError" ? "Timed out" : "Public request failed" };
  }
}

// Bound concurrency; this is a public-page check, not a load test.
for (let i = 0; i < published.length; i += 5) {
  report.liveProducts.push(...await Promise.all(published.slice(i, i + 5).map(async p => ({
    title: p.title, url: p.destinationUrl, ...await inspect(p.destinationUrl),
  }))));
}
const oldLinks = [...new Set(review.drafts.map(d => d.productUrl).filter(Boolean))];
for (const url of oldLinks) {
  report.legacyCampaignLinks.push({
    url, draftIds: review.drafts.filter(d => d.productUrl === url).map(d => d.id),
    ...await inspect(url),
  });
}

async function facebookGet(path, token) {
  const response = await fetch(`https://graph.facebook.com/v26.0/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    // Never include provider payloads or credentials in a durable report.
    throw new Error(`Facebook read rejected: HTTP ${response.status}, code ${data.error?.code ?? "unknown"}`);
  }
  return data;
}

if (process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
  try {
    const pageId = "401634216613866";
    const page = await facebookGet(`${pageId}?fields=id,name,access_token`, process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
    if (page.id !== pageId || page.name !== "Sless Taylor") throw new Error("Unexpected Facebook Page");
    const token = page.access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const posts = [];
    let after;
    for (let n = 0; n < 5; n++) {
      const params = new URLSearchParams({
        fields: "id,message,scheduled_publish_time,is_published", limit: "100",
      });
      if (after) params.set("after", after);
      const data = await facebookGet(`${pageId}/scheduled_posts?${params}`, token);
      posts.push(...data.data.map(post => ({
        postId: post.id, published: post.is_published,
        scheduledFor: post.scheduled_publish_time
          ? new Date(Number(post.scheduled_publish_time) * 1000).toISOString() : null,
        draftId: review.drafts.find(d => d.facebook === post.message)?.id ?? null,
        containsSaleClaims: /(?:20%|sale ends|down from|20 percent)/i.test(post.message ?? ""),
      })));
      after = data.paging?.next ? data.paging?.cursors?.after : null;
      if (!after) break;
      if (n === 4) throw new Error("Facebook schedule exceeds audit pagination limit");
    }
    report.facebook = { verifiedPage: true, scheduledPosts: posts };
  } catch (error) {
    report.facebook = { verified: false, error: error.message };
  }
} else {
  report.facebook = { verified: false, error: "Saved credential unavailable" };
}
report.summary = {
  expectedLiveProducts: published.length,
  reachableProducts: report.liveProducts.filter(p => p.status === 200).length,
  productPagesWithCartReference: report.liveProducts.filter(p => p.addToCartReference).length,
  legacyLinksReachingHostedProduct: report.legacyCampaignLinks.filter(p =>
    /^https:\/\/shop\.slessismore\.org\/product\//.test(p.finalUrl ?? "")).length,
  legacyLinksChecked: report.legacyCampaignLinks.length,
  scheduledSalePosts: report.facebook.scheduledPosts?.filter(p => p.containsSaleClaims).length ?? null,
  ordersCreated: 0, postsPublished: 0, schedulesChanged: 0, paidSpend: 0,
};
await saveJson(`${base}/marketing-launch-audit.json`, report);
console.log(JSON.stringify(report.summary));
console.log(JSON.stringify({ facebook: report.facebook, legacyCampaignLinks: report.legacyCampaignLinks }));
