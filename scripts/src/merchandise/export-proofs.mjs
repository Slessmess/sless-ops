import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { directory, root } from "./printify-api.mjs";

const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const sharp = require("sharp");
const plan = JSON.parse(await readFile(resolve(directory, "merchandise-production-plan.json"), "utf8"));
const receipts = JSON.parse(await readFile(resolve(directory, "merchandise-draft-receipts.json"), "utf8"));
const benchmarkDoc = JSON.parse(await readFile(
  resolve(root, "reports/sless-merchandise/verified-retail-benchmarks.json"), "utf8",
));
const output = resolve(root, "reports/sless-merchandise");
await mkdir(output, { recursive: true });
const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const usd = (value) => `$${(value / 100).toFixed(2)}`;
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const costFloor = (costCents) => Math.ceil(
  ((costCents + benchmarkDoc.pricingPolicy.paymentFeeAllowanceCents +
    benchmarkDoc.pricingPolicy.minimumGrossProfitCents) * 10000) /
    (10000 - benchmarkDoc.pricingPolicy.paymentFeeAllowanceRateBps),
);
const usFirstShipping = (receipt, variantId) => {
  const profile = receipt?.shipping?.profiles?.find((candidate) =>
    candidate.countries?.includes("US") && candidate.variantIds?.includes(variantId));
  return Number.isInteger(profile?.firstItem?.cost) ? profile.firstItem.cost : null;
};
const marketTarget = (benchmark, receipt, variantId) => {
  let target = benchmark.retailPriceCents - benchmarkDoc.pricingPolicy.undercutCents;
  if (benchmark.shippingMode === "included" ||
      Number.isInteger(benchmark.competitorShippingCents)) {
    const ownShipping = usFirstShipping(receipt, variantId);
    if (ownShipping === null) return null;
    target += (benchmark.competitorShippingCents || 0) - ownShipping;
  }
  return target;
};
const range = (values) => values.length
  ? { min: Math.min(...values), max: Math.max(...values) }
  : { min: null, max: null };
const cards = [];
const rows = [[
  "SKU", "Collection", "Product", "Printify provider", "Provider country",
  "Verified Printify draft", "Enabled options", "Lowest production cost USD",
  "Highest production cost USD", "Lowest proposed retail USD", "Highest proposed retail USD",
  "Lowest estimated-fee cost floor USD", "Highest estimated-fee cost floor USD",
  "Comparator item price USD", "Comparator shipping status", "Lowest market target USD",
  "Highest market target USD", "Comparator product", "Comparator checked date",
  "Comparator source", "Benchmark notes", "Catalog shipping quote available", "Website published",
]];
const benchmarkedCount = plan.products.filter((product) =>
  benchmarkDoc.benchmarks[product.sku]).length;
for (const product of plan.products) {
  const receipt = receipts.products[product.sku];
  const availableCosts = receipt?.variants?.map((variant) => variant.costCents) || [];
  const proposedPrices = receipt?.variants?.map((variant) => variant.proposedPriceCents) || [];
  const costFloors = receipt?.variants?.map((variant) => costFloor(variant.costCents)) || [];
  const benchmark = benchmarkDoc.benchmarks[product.sku];
  const targetPrices = benchmark
    ? (receipt?.variants || []).map((variant) =>
      marketTarget(benchmark, receipt, variant.id)).filter(Number.isInteger)
    : [];
  const minPrice = proposedPrices.length ? Math.min(...proposedPrices) : null;
  const maxPrice = proposedPrices.length ? Math.max(...proposedPrices) : null;
  const floorRange = range(costFloors);
  const targetRange = range(targetPrices);
  const color = Object.values(product.variants[0].options || {}).join(" ");
  const dark = (/Black/i.test(color) && !/straps/i.test(product.catalogTitle)) ||
    /Black Mug/i.test(product.catalogTitle);
  const bg = dark ? "#121212" : "#f0ede5";
  const thumb = await sharp(resolve(root, product.artwork[0].pngPath))
    .resize(420, 440, { fit: "contain", background: bg })
    .flatten({ background: bg }).jpeg({ quality: 84 }).toBuffer();
  const price = minPrice === null ? "Not yet verified"
    : minPrice === maxPrice ? usd(minPrice) : `${usd(minPrice)}–${usd(maxPrice)}`;
  const benchmarkSummary = benchmark
    ? `Current single-item comparator: ${usd(benchmark.retailPriceCents)}. ` +
      `Market target before the cost/fee floor: ${targetRange.min === null
        ? "US shipping quote missing" : `${usd(targetRange.min)}–${usd(targetRange.max)}`}. ` +
      `${benchmark.similarity}`
    : `No sufficiently similar current single-item retail offer verified on ${benchmarkDoc.checkedOn}; the existing proposal was retained.`;
  cards.push(`<article class="card">
    <div class="art"><img src="data:image/jpeg;base64,${thumb.toString("base64")}" alt="${esc(product.listingTitle)} artwork preview"/></div>
    <div class="detail"><div class="label">${esc(product.sku)} · ${esc(product.collection)}</div>
    <h2>${esc(product.listingTitle)}</h2><p>${esc(product.provider.title)} · ${esc(product.provider.country)}</p>
    <p>${receipt?.verified ? "Verified Printify draft" : "Draft preparation incomplete"} · ${receipt?.variants?.length || product.variants.length} option(s)</p>
    <p class="price">${price} <span>proposed—not a live offer</span></p>
    <p>${esc(benchmarkSummary)}</p>
    ${benchmark ? `<small><a href="${esc(benchmark.source)}" target="_blank" rel="noreferrer">Retail source checked ${esc(benchmarkDoc.checkedOn)}</a></small>` : ""}
    <small>Original artwork preview, not a physical sample or garment mockup.</small></div>
  </article>`);
  rows.push([
    product.sku, product.collection, product.listingTitle, product.provider.title,
    product.provider.country, receipt?.verified ? "Yes" : "No",
    receipt?.variants?.map((v) => v.title).join(" | ") || "",
    availableCosts.length ? (Math.min(...availableCosts) / 100).toFixed(2) : "",
    availableCosts.length ? (Math.max(...availableCosts) / 100).toFixed(2) : "",
    minPrice === null ? "" : (minPrice / 100).toFixed(2),
    maxPrice === null ? "" : (maxPrice / 100).toFixed(2),
    floorRange.min === null ? "" : (floorRange.min / 100).toFixed(2),
    floorRange.max === null ? "" : (floorRange.max / 100).toFixed(2),
    benchmark ? (benchmark.retailPriceCents / 100).toFixed(2) : "",
    benchmark?.shippingMode || "",
    targetRange.min === null ? "" : (targetRange.min / 100).toFixed(2),
    targetRange.max === null ? "" : (targetRange.max / 100).toFixed(2),
    benchmark?.product || "",
    benchmark ? benchmarkDoc.checkedOn : "",
    benchmark?.source || "",
    benchmark?.similarity || (benchmark ? "" : "No eligible current comparator; existing proposal retained."),
    receipt?.shipping?.profiles?.length ? "Yes" : "No", "No",
  ]);
}
const counts = plan.products.reduce((acc, product) =>
  (acc[product.collection] = (acc[product.collection] || 0) + 1, acc), {});
const verified = Object.values(receipts.products).filter((product) => product.verified).length;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sless merchandise artwork proofs</title><style>
*{box-sizing:border-box}body{margin:0;background:#111;color:#f6f3eb;font:16px/1.55 Arial,sans-serif}
header,main,footer{max-width:1240px;margin:auto;padding:32px 24px}header{padding-top:52px}
.eyebrow,.label{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#ffd700}
h1{font-size:clamp(34px,6vw,62px);line-height:1.05;margin:14px 0}h2{font-size:18px;line-height:1.3;margin:8px 0}
.note{background:#242017;border:1px solid #5d4d1c;padding:18px;margin-top:22px;border-radius:8px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.card{border:1px solid #39372f;background:#1b1b18;border-radius:8px;overflow:hidden}
.art{height:320px;background:#eee}.art img{display:block;width:100%;height:100%;object-fit:contain}
.detail{padding:18px}.detail p{font-size:13px;color:#d0ccc2;margin:8px 0}.price{font-weight:bold}
.price span,small{display:block;font-weight:normal;font-size:11px;color:#aaa69b}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}.stat{border:1px solid #474239;padding:12px 18px}
footer{color:#aaa69b;font-size:12px;border-top:1px solid #39372f}
@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.grid{grid-template-columns:1fr}header,main,footer{padding:24px 16px}}
</style></head><body><header><div class="eyebrow">Sless Is More · merchant review</div>
<h1>Merchandise artwork proofs</h1><p>50 additional products, separate from the owner's three original shirts.</p>
<div class="stats">${Object.entries(counts).map(([name, count]) => `<div class="stat"><strong>${count}</strong> ${esc(name)}</div>`).join("")}</div>
<div class="note"><strong>${verified} of 50 additional products verified as unpublished Printify drafts.</strong>
<p>As of ${esc(benchmarkDoc.checkedOn)}, ${benchmarkedCount} products have a current single-item consumer retail benchmark. Those proposed prices target $2 below the item or delivered offer when the estimated fee/cost floor permits it. Other products retain their existing cost-plus proposals because no sufficiently similar current offer was verified. The 3.5% + $0.50 fee allowance is not a verified Stripe fee; taxes, production costs, shipping, and checkout behavior still need merchant review. No holiday delivery dates are promised.</p>
<p>Some providers fulfill outside the US. Artwork previews do not establish physical print quality, embroidery digitization quality, or production/shipping availability. No purchase buttons are enabled by this report.</p></div>
</header><main><div class="grid">${cards.join("")}</div></main>
<footer>Generated for review of the Sless merchandise assortment. Source category recommendations: Printify 2026 bestseller and trend articles. This is not a ranked sales report, customer storefront, or proof of a completed order.</footer></body></html>`;
await writeFile(resolve(output, "artwork-proofs.html"), html);
await writeFile(resolve(output, "draft-assortment.csv"), rows.map((row) => row.map(csv).join(",")).join("\n") + "\n");
console.log(JSON.stringify({
  verified, collections: counts,
  html: "reports/sless-merchandise/artwork-proofs.html",
  csv: "reports/sless-merchandise/draft-assortment.csv",
}));
