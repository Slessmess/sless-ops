/**
 * Explicit workspace operator. Creates unpublished Printify drafts only.
 * Never publishes, enables payment, or creates/approves an order.
 */
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { api, directory, root, saveJson } from "./printify-api.mjs";

if (process.argv[2] !== "--apply" || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Run explicitly in the workspace with --apply");
}
const plan = JSON.parse(await readFile(resolve(directory, "merchandise-production-plan.json"), "utf8"));
if (plan.products.length !== 50 || plan.products.some((p) => !p.artwork?.length)) {
  throw new Error("A complete 50-product artwork/production plan is required");
}
const benchmarkDoc = JSON.parse(await readFile(
  resolve(root, "reports/sless-merchandise/verified-retail-benchmarks.json"), "utf8",
));
const benchmarks = benchmarkDoc.benchmarks;
const benchmarkPolicy = benchmarkDoc.pricingPolicy;
const planSkus = new Set(plan.products.map((product) => product.sku));
if (benchmarkDoc.schemaVersion !== 1 ||
    Object.keys(benchmarks).some((sku) => !planSkus.has(sku)) ||
    benchmarkPolicy.status !== "proposed_not_approved_for_publication" ||
    benchmarkPolicy.undercutCents !== 200 ||
    benchmarkPolicy.minimumGrossProfitCents < 1 ||
    benchmarkPolicy.paymentFeeAllowanceRateBps <= 0 ||
    benchmarkPolicy.paymentFeeAllowanceRateBps >= 10000) {
  throw new Error("The retail benchmark policy is invalid or outside the 50-product plan");
}
for (const [sku, benchmark] of Object.entries(benchmarks)) {
  if (!Number.isInteger(benchmark.retailPriceCents) || benchmark.retailPriceCents <= 0 ||
      !["included", "separate", "unknown"].includes(benchmark.shippingMode) ||
      !benchmark.source || !benchmark.proof || !benchmark.similarity) {
    throw new Error(`Incomplete or invalid retail benchmark: ${sku}`);
  }
  if (benchmark.shippingMode === "included" &&
      !Number.isInteger(benchmark.competitorShippingCents)) {
    throw new Error(`Included shipping needs a verified amount: ${sku}`);
  }
}
const receiptPath = resolve(directory, "merchandise-draft-receipts.json");
let receipts;
try { receipts = JSON.parse(await readFile(receiptPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  receipts = { images: {}, products: {}, failures: [] };
}
const shops = (await api("shops.json")).filter((shop) => shop.sales_channel === "woocommerce");
if (shops.length !== 1) throw new Error("Ambiguous connected WooCommerce shop");
const shop = shops[0];
if (receipts.shopId && receipts.shopId !== shop.id) throw new Error("Receipt shop does not match destination");
receipts.shopId = shop.id;
const save = () => saveJson(receiptPath, receipts);
const existingProducts = [];
for (let page = 1;; page++) {
  const list = await api(`shops/${shop.id}/products.json?limit=20&page=${page}`);
  existingProducts.push(...list.data);
  if (existingProducts.length >= list.total) break;
  if (!list.data.length) throw new Error("Unexpected product pagination");
}
if (receipts.pendingWrite) {
  const pending = receipts.pendingWrite;
  if (pending.kind !== "draft_price_update" || !process.argv.includes("--resume-price-update")) {
    throw new Error("A previous write was unconfirmed; inspect its provider result before resuming");
  }
  const staged = plan.products.find((product) => product.sku === pending.sku);
  const current = await api(`shops/${shop.id}/products/${pending.productId}.json`);
  if (!staged || current.external?.id || current.blueprint_id !== staged.blueprintId ||
      current.print_provider_id !== staged.provider.id ||
      receipts.products[pending.sku]?.id !== current.id) {
    throw new Error("Pending update ownership/product state mismatch");
  }
  const enabled = current.variants.filter((variant) => variant.is_enabled);
  const savedVariants = receipts.products[pending.sku]?.variants || [];
  const allowedPrices = (variant) => [
    pending.previousPrices?.[variant.id],
    pending.targetPrices?.[variant.id],
    savedVariants.find((saved) => saved.id === variant.id)?.proposedPriceCents,
    3500,
  ].filter(Number.isInteger);
  if (enabled.some((variant) => !allowedPrices(variant).includes(variant.price))) {
    throw new Error("Pending draft has other price changes; inspect before resuming");
  }
  // The target is a verified existing draft, and price PUTs are idempotent.
  delete receipts.pendingWrite;
  await save();
}

async function imageFor(artwork, sku) {
  if (receipts.images[artwork.sha256]) return receipts.images[artwork.sha256].id;
  const path = resolve(root, artwork.pngPath);
  const data = await readFile(path);
  if (data.length > 48_000_000) throw new Error(`Artwork file is too large: ${sku}`);
  receipts.pendingWrite = { kind: "image_upload", sku, fileName: basename(path) };
  await save();
  const uploaded = await api("uploads/images.json", "POST", {
    file_name: basename(path), contents: data.toString("base64"),
  });
  if (!(uploaded.id && uploaded.width === artwork.width && uploaded.height === artwork.height)) {
    throw new Error(`Uploaded artwork dimensions do not match ${sku}`);
  }
  receipts.images[artwork.sha256] = {
    id: uploaded.id, width: uploaded.width, height: uploaded.height,
    fileName: basename(path),
  };
  delete receipts.pendingWrite;
  await save();
  return uploaded.id;
}

function printAreas(product, images) {
  const groups = new Map();
  for (const variant of product.variants) {
    const placeholders = product.artwork.map((artwork) => {
      const frame = variant.placeholders.find((p) => p.position === artwork.position);
      if (!frame) throw new Error(`Missing print position for ${product.sku}/${variant.id}`);
      const scale = Math.min(1, (frame.height / frame.width) / (artwork.height / artwork.width));
      return { position: artwork.position, images: [{
        id: images[artwork.position], x: 0.5, y: 0.5, scale, angle: 0,
      }] };
    });
    const key = JSON.stringify(placeholders);
    if (!groups.has(key)) groups.set(key, { variant_ids: [], placeholders });
    groups.get(key).variant_ids.push(variant.id);
  }
  return [...groups.values()];
}

function verifyDraft(draft, product, images) {
  if (draft.external?.id) throw new Error(`Unexpected published product: ${product.sku}`);
  if (draft.blueprint_id !== product.blueprintId || draft.print_provider_id !== product.provider.id) {
    throw new Error(`Product/provider mismatch: ${product.sku}`);
  }
  const enabled = draft.variants.filter((variant) => variant.is_enabled);
  if (enabled.length !== product.variants.length ||
      product.variants.some((variant) => !enabled.some((v) => v.id === variant.id))) {
    throw new Error(`Enabled variants do not match ${product.sku}`);
  }
  for (const variant of enabled) {
    const area = draft.print_areas.find((candidate) => candidate.variant_ids.includes(variant.id));
    for (const [position, imageId] of Object.entries(images)) {
      if (!area?.placeholders.some((placeholder) =>
        placeholder.position === position && placeholder.images.some((image) => image.id === imageId))) {
        throw new Error(`Artwork linkage mismatch: ${product.sku}/${variant.id}/${position}`);
      }
    }
    if (!(Number.isInteger(variant.cost) && variant.cost > 0)) {
      throw new Error(`Production cost unavailable for ${product.sku}/${variant.id}`);
    }
  }
  return enabled;
}

function firstUsShippingCents(productReceipt, variantId) {
  const profile = productReceipt?.shipping?.profiles?.find((candidate) =>
    candidate.countries?.includes("US") && candidate.variantIds?.includes(variantId));
  const cost = profile?.firstItem?.cost;
  return Number.isInteger(cost) && cost >= 0 ? cost : null;
}

function minimumGrossPrice(cost) {
  const rateBps = benchmarkPolicy.paymentFeeAllowanceRateBps;
  const denominator = 10000 - rateBps;
  const requiredCents = cost + benchmarkPolicy.paymentFeeAllowanceCents +
    benchmarkPolicy.minimumGrossProfitCents;
  return Math.ceil((requiredCents * 10000) / denominator);
}

function proposedPrice(cost, sku, variantId, productReceipt) {
  const benchmark = benchmarks[sku];
  if (benchmark) {
    let marketTarget = benchmark.retailPriceCents - benchmarkPolicy.undercutCents;
    const comparatorHasKnownDelivery =
      benchmark.shippingMode === "included" || Number.isInteger(benchmark.competitorShippingCents);
    if (comparatorHasKnownDelivery) {
      const ownShippingCents = firstUsShippingCents(productReceipt, variantId);
      if (ownShippingCents === null) {
        throw new Error(`Verified US first-item shipping is required for ${sku}/${variantId}`);
      }
      marketTarget += (benchmark.competitorShippingCents || 0) - ownShippingCents;
    }
    return Math.max(marketTarget, minimumGrossPrice(cost));
  }
  const policy = plan.pricingPolicy;
  return Math.ceil((cost + policy.paymentFeeAllowanceCents) /
    (1 - policy.paymentFeeAllowanceRate - policy.targetMargin) / 100) * 100;
}

for (const product of plan.products) {
  try {
    const images = {};
    for (const artwork of product.artwork) images[artwork.position] = await imageFor(artwork, product.sku);
    const record = receipts.products[product.sku];
    const matches = existingProducts.filter((draft) => draft.title === product.listingTitle);
    if (matches.length > 1) throw new Error(`Duplicate destination titles: ${product.sku}`);
    let draft = record?.id
      ? await api(`shops/${shop.id}/products/${record.id}.json`)
      : matches[0];
    if (!draft) {
      receipts.pendingWrite = { kind: "product_creation", sku: product.sku, title: product.listingTitle };
      await save();
      draft = await api(`shops/${shop.id}/products.json`, "POST", {
        title: product.listingTitle,
        description: `<p>Original Sless Is More ${product.collection === "Evergreen" ? "year-round" : product.collection} artwork.</p><p>${product.catalogTitle}.</p><p>Made to order. Available options are shown in the product selector.</p>`,
        blueprint_id: product.blueprintId,
        print_provider_id: product.provider.id,
        variants: product.variants.map((variant) => ({ id: variant.id, price: 3500, is_enabled: true })),
        print_areas: printAreas(product, images),
      });
      receipts.products[product.sku] = { id: draft.id, title: product.listingTitle, verified: false };
      delete receipts.pendingWrite;
      await save();
      existingProducts.push(draft);
    }
    let enabled = verifyDraft(draft, product, images);
    const prices = new Map(enabled.map((variant) => [
      variant.id, proposedPrice(variant.cost, product.sku, variant.id, record),
    ]));
    if (record?.verified && enabled.some((variant) =>
      !record.variants.some((saved) => saved.id === variant.id && saved.proposedPriceCents === variant.price))) {
      throw new Error(`Draft prices were edited outside this operator: ${product.sku}`);
    }
    if (enabled.some((variant) => variant.price !== prices.get(variant.id))) {
      receipts.pendingWrite = {
        kind: "draft_price_update",
        sku: product.sku,
        productId: draft.id,
        previousPrices: Object.fromEntries(enabled.map((variant) => [variant.id, variant.price])),
        targetPrices: Object.fromEntries(prices),
      };
      await save();
      await api(`shops/${shop.id}/products/${draft.id}.json`, "PUT", {
        variants: enabled.map((variant) => ({
          id: variant.id, price: prices.get(variant.id), is_enabled: true,
        })),
      });
      draft = await api(`shops/${shop.id}/products/${draft.id}.json`);
      enabled = verifyDraft(draft, product, images);
    }
    if (enabled.some((variant) => variant.price !== prices.get(variant.id))) {
      throw new Error(`Proposed prices did not persist for ${product.sku}`);
    }
    delete receipts.pendingWrite;
    let shipping = record?.shipping;
    try {
      if (!shipping?.profiles?.length) {
      const quote = await api(`catalog/blueprints/${product.blueprintId}/print_providers/${product.provider.id}/shipping.json`);
      shipping = {
        handlingTime: quote.handling_time,
        profiles: quote.profiles?.filter((profile) =>
          profile.variant_ids.some((id) => prices.has(id))).map((profile) => ({
          countries: profile.countries,
          firstItem: profile.first_item,
          additionalItems: profile.additional_items,
          variantIds: profile.variant_ids.filter((id) => prices.has(id)),
        })),
      };
      }
    } catch (error) {
      shipping = { verified: false, reason: error.message };
    }
    receipts.products[product.sku] = {
      id: draft.id, title: product.listingTitle, collection: product.collection,
      provider: product.provider, verified: true, websitePublished: false,
      artworkImageIds: images,
      variants: enabled.map((variant) => ({
        id: variant.id, title: variant.title, costCents: variant.cost,
        proposedPriceCents: variant.price, available: variant.is_available,
      })),
      shipping,
      pricingPolicy: benchmarks[product.sku] ? benchmarkPolicy : plan.pricingPolicy,
      retailBenchmark: benchmarks[product.sku] || null,
      pricingMethod: benchmarks[product.sku]
        ? "current_single_item_retail_minus_2_or_minimum_gross_floor"
        : "existing_cost_plus_planning_margin_proposal_retained",
    };
    receipts.failures = receipts.failures.filter((failure) => failure.sku !== product.sku);
    await save();
    console.log(JSON.stringify({
      sku: product.sku, collection: product.collection, result: "verified_unpublished_draft",
      variants: enabled.length,
      proposedPriceRange: [Math.min(...enabled.map((v) => v.price)), Math.max(...enabled.map((v) => v.price))],
      shippingQuoteAvailable: Boolean(shipping.profiles?.length),
    }));
  } catch (error) {
    receipts.failures = receipts.failures.filter((failure) => failure.sku !== product.sku);
    receipts.failures.push({ sku: product.sku, reason: error.message });
    if (/Printify HTTP (400|401|403|404|422):/.test(error.message)) {
      delete receipts.pendingWrite;
      await save();
      console.error(`DRAFT_FAILED ${product.sku} ${error.message}`);
      continue;
    }
    await save();
    throw error;
  }
}
const verified = Object.values(receipts.products).filter((product) => product.verified).length;
console.log(`DRAFTS_COMPLETE verified=${verified} failures=${receipts.failures.length}`);
if (verified !== 50 || receipts.failures.length) process.exitCode = 1;
