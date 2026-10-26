/**
 * Repair selected merchandise variants and audit the existing assortment.
 * Does not publish, alter the original three shirts, change payment mode,
 * or create/approve production orders. Uncertain writes require reconciliation.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { api, directory, saveJson } from "./printify-api.mjs";

const apply = process.argv.includes("--apply");
if (process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Workspace operator only");
const planPath = resolve(directory, "merchandise-production-plan.json");
const receiptPath = resolve(directory, "merchandise-draft-receipts.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
const receipts = JSON.parse(await readFile(receiptPath, "utf8"));
if (receipts.pendingWrite) throw new Error("Reconcile the previous provider write before continuing");
const shops = (await api("shops.json")).filter(shop => shop.sales_channel === "woocommerce");
if (shops.length !== 1 || shops[0].id !== receipts.shopId) throw new Error("Destination shop mismatch");
const shopId = shops[0].id;
const repairs = [
  { sku: "SLESS-005", variantIds: [125656, 125659], reason: "Replace unavailable Vintage White with available Light Washed Denim in L and 3XL." },
  { sku: "SLESS-041", variantIds: [65211, 65212, 65213, 65214, 65210], reason: "Offer the available 2, 3.5, 5, and 8-inch sticker sizes as well as the existing 15-inch size." },
];
const changes = [];
for (const repair of repairs) {
  const item = plan.products.find(product => product.sku === repair.sku);
  const record = receipts.products[repair.sku];
  if (!item || !record?.verified) throw new Error(`Verified draft missing: ${repair.sku}`);
  let product = await api(`shops/${shopId}/products/${record.id}.json`);
  if (product.external?.id && !apply) {
    changes.push({ sku: repair.sku, applied: false, alreadyPublished: true });
    continue;
  }
  if (product.external?.id || product.is_locked || product.title !== item.listingTitle ||
      product.blueprint_id !== item.blueprintId || product.print_provider_id !== item.provider.id) {
    throw new Error(`Draft ownership or publication state changed: ${repair.sku}`);
  }
  const [catalog, shipping] = await Promise.all([
    api(`catalog/blueprints/${item.blueprintId}/print_providers/${item.provider.id}/variants.json`),
    api(`catalog/blueprints/${item.blueprintId}/print_providers/${item.provider.id}/shipping.json`),
  ]);
  const selected = repair.variantIds.map(id => {
    const live = product.variants.find(variant => variant.id === id);
    const definition = catalog.variants.find(variant => variant.id === id);
    if (!live?.is_available || !definition || !Number.isInteger(live.cost) || live.cost <= 0) {
      throw new Error(`Replacement is unavailable: ${repair.sku}/${id}`);
    }
    if (!shipping.profiles.some(profile => profile.variant_ids.includes(id) && profile.countries.includes("US"))) {
      throw new Error(`US shipping quote unavailable: ${repair.sku}/${id}`);
    }
    for (const [position, imageId] of Object.entries(record.artworkImageIds)) {
      const area = product.print_areas.find(area => area.variant_ids.includes(id));
      if (!area?.placeholders.some(placeholder => placeholder.position === position &&
          placeholder.images.some(image => image.id === imageId))) {
        throw new Error(`Existing artwork does not cover replacement: ${repair.sku}/${id}/${position}`);
      }
    }
    const saved = record.variants.find(variant => variant.id === id);
    const policy = plan.pricingPolicy;
    const price = saved?.proposedPriceCents ?? Math.ceil(
      (live.cost + policy.paymentFeeAllowanceCents) /
      (1 - policy.paymentFeeAllowanceRate - policy.targetMargin) / 100,
    ) * 100;
    return { live, definition, price };
  });
  const ids = new Set(repair.variantIds);
  const oldIds = new Set(record.variants.map(variant => variant.id));
  if (product.variants.some(variant => variant.is_enabled && !oldIds.has(variant.id))) {
    throw new Error(`Unexpected enabled variants; review manually: ${repair.sku}`);
  }
  for (const variant of product.variants.filter(variant => oldIds.has(variant.id))) {
    if (variant.price !== record.variants.find(saved => saved.id === variant.id).proposedPriceCents) {
      throw new Error(`Draft prices changed outside this operator: ${repair.sku}`);
    }
  }
  const needsUpdate = product.variants.some(variant =>
    variant.is_enabled !== ids.has(variant.id) ||
    (ids.has(variant.id) && variant.price !== selected.find(item => item.live.id === variant.id).price));
  if (needsUpdate && apply) {
    receipts.pendingWrite = { kind: "availability_update", sku: repair.sku, productId: product.id, variantIds: repair.variantIds };
    await saveJson(receiptPath, receipts);
    await api(`shops/${shopId}/products/${product.id}.json`, "PUT", {
      variants: product.variants.map(variant => ({
        id: variant.id,
        price: selected.find(item => item.live.id === variant.id)?.price ?? variant.price,
        is_enabled: ids.has(variant.id),
        is_default: variant.id === repair.variantIds[0],
      })),
    });
    product = await api(`shops/${shopId}/products/${product.id}.json`);
    const enabled = product.variants.filter(variant => variant.is_enabled);
    if (enabled.length !== selected.length || selected.some(item =>
      !enabled.some(variant => variant.id === item.live.id && variant.is_available && variant.price === item.price))) {
      throw new Error(`Availability update was not confirmed: ${repair.sku}; reconcile before retrying`);
    }
    item.variants = selected.map(item => item.definition);
    item.primaryVariantId = repair.variantIds[0];
    item.positions = item.variants[0].placeholders.filter(position =>
      Object.hasOwn(record.artworkImageIds, position.position));
    record.variants = enabled.map(variant => ({
      id: variant.id, title: variant.title, costCents: variant.cost,
      proposedPriceCents: variant.price, available: variant.is_available,
    }));
    record.shipping = {
      handlingTime: shipping.handling_time,
      profiles: shipping.profiles.filter(profile => profile.variant_ids.some(id => ids.has(id))).map(profile => ({
        countries: profile.countries,
        firstItem: profile.first_item,
        additionalItems: profile.additional_items,
        variantIds: profile.variant_ids.filter(id => ids.has(id)),
      })),
    };
    record.availabilityRepair = { checkedAt: new Date().toISOString(), reason: repair.reason };
    await saveJson(planPath, plan);
    delete receipts.pendingWrite;
    await saveJson(receiptPath, receipts);
  }
  changes.push({ sku: repair.sku, applied: needsUpdate && apply, variants: selected.map(item => ({
    id: item.live.id, title: item.live.title, proposedPriceCents: item.price,
  })) });
}

const products = [];
for (let page = 1;; page++) {
  const result = await api(`shops/${shopId}/products.json?limit=50&page=${page}`);
  products.push(...result.data);
  if (products.length >= result.total) break;
  if (!result.data.length) throw new Error("Incomplete product pagination");
}
const items = plan.products.map(item => {
  const record = receipts.products[item.sku];
  const product = products.find(product => product.id === record?.id);
  const reasons = [];
  const enabled = product?.variants.filter(variant => variant.is_enabled) || [];
  if (!product) reasons.push("Provider product missing");
  if (!enabled.length) reasons.push("No enabled variants");
  if (enabled.some(variant => !variant.is_available)) reasons.push("Selected variant is out of stock");
  if (product?.is_locked) reasons.push("Provider publication lock");
  if (!product?.images?.length) reasons.push("Mockups missing");
  if (enabled.some(variant => !record.variants.some(saved =>
    saved.id === variant.id && saved.proposedPriceCents === variant.price))) reasons.push("Price or variant mismatch");
  for (const variant of enabled) {
    for (const [position, imageId] of Object.entries(record.artworkImageIds || {})) {
      if (!product.print_areas.some(area => area.variant_ids.includes(variant.id) &&
          area.placeholders.some(placeholder => placeholder.position === position &&
            placeholder.images.some(image => image.id === imageId)))) {
        reasons.push(`Artwork missing for variant ${variant.id}/${position}`);
      }
    }
  }
  return {
    sku: item.sku, id: product?.id, title: product?.title,
    catalogReady: reasons.length === 0, reasons, enabledVariants: enabled.length,
    pricesCents: [...new Set(enabled.map(variant => variant.price))],
    websitePublished: Boolean(product?.external?.id),
  };
});
const report = {
  checkedAt: new Date().toISOString(), shopId, changes, items,
  catalogReady: items.filter(item => item.catalogReady).length,
  held: items.filter(item => !item.catalogReady).length,
  websitePublished: items.filter(item => item.websitePublished).length,
  checkoutVerified: false, publicationPerformed: false, ordersCreated: false,
};
await saveJson(resolve(directory, "merchandise-launch-audit.json"), report);
console.log(JSON.stringify({ changes, catalogReady: report.catalogReady, held: items.filter(item => !item.catalogReady), websitePublished: report.websitePublished }));
