/**
 * Native Printify → WooCommerce catalog synchronization.
 * Does not open the storefront, switch payment mode, or place production orders.
 * Never fabricates external IDs or uses publishing_succeeded to fake a sync.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { api, directory, saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Explicit workspace --apply is required");
}
const audit = JSON.parse(await readFile(resolve(directory, "merchandise-launch-audit.json"), "utf8"));
const receipts = JSON.parse(await readFile(resolve(directory, "merchandise-draft-receipts.json"), "utf8"));
if (receipts.pendingWrite || audit.shopId !== receipts.shopId) throw new Error("Unreconciled write or shop mismatch");
const shops = await api("shops.json");
if (shops.filter(shop => shop.sales_channel === "woocommerce").length !== 1 ||
    !shops.some(shop => shop.id === audit.shopId && shop.sales_channel === "woocommerce")) {
  throw new Error("Native destination channel changed");
}
const logPath = resolve(directory, "merchandise-publish-receipts.json");
let log;
try { log = JSON.parse(await readFile(logPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  log = { shopId: audit.shopId, publicLaunchPerformed: false, ordersCreated: false, products: {} };
}
if (log.shopId !== audit.shopId) throw new Error("Publication receipt shop mismatch");
const save = () => saveJson(logPath, log);
const targets = audit.items.filter(item => item.catalogReady).map(item => ({
  ...item, expectedVariants: receipts.products[item.sku].variants,
  expectedImages: receipts.products[item.sku].artworkImageIds,
}));
if (targets.length !== 50) throw new Error("All 50 additional products must pass the catalog audit");
if (process.argv.includes("--include-core")) {
  const sourceShops = shops.filter(shop => shop.sales_channel === "disconnected");
  if (sourceShops.length !== 1) throw new Error("Core artwork source shop is ambiguous");
  const source = await api(`shops/${sourceShops[0].id}/products.json?limit=20`);
  const copies = [];
  for (let page = 1;; page++) {
    const result = await api(`shops/${audit.shopId}/products.json?limit=50&page=${page}`);
    copies.push(...result.data);
    if (copies.length >= result.total) break;
    if (!result.data.length) throw new Error("Incomplete core copy pagination");
  }
  const titles = ["NO INTRODUCTION NEEDED", "STAY UNDENIABLE", "BUILT DIFFERENT. PROVEN DAILY."];
  const layout = (product, variantId) => {
    const area = product.print_areas.find(area => area.variant_ids.includes(variantId));
    return (area?.placeholders || []).filter(position => position.images.length).map(position => ({
      position: position.position,
      images: position.images.map(image => ({ id: image.id, x: image.x, y: image.y, scale: image.scale, angle: image.angle })),
    })).sort((a, b) => a.position.localeCompare(b.position));
  };
  for (let index = 0; index < titles.length; index++) {
    const originals = source.data.filter(product => product.title === titles[index]);
    const matches = copies.filter(product => product.title === titles[index]);
    if (originals.length !== 1 || matches.length !== 1) throw new Error("Core source/copy is ambiguous");
    const original = originals[0], copy = matches[0];
    const enabled = copy.variants.filter(variant => variant.is_enabled);
    if (enabled.length !== 6 || copy.blueprint_id !== original.blueprint_id ||
        copy.print_provider_id !== original.print_provider_id) throw new Error("Core configuration changed");
    const sizes = copy.options.find(option => /size/i.test(option.name))?.values;
    const colors = copy.options.find(option => /color/i.test(option.name))?.values;
    const prices = { S: 2500, M: 2500, L: 2500, XL: 2500, "2XL": 2800, "3XL": 3000 };
    for (const variant of enabled) {
      const size = sizes?.find(size => variant.options.includes(size.id))?.title;
      if (!variant.is_available || prices[size] !== variant.price ||
          !colors?.some(color => color.title === "White" && variant.options.includes(color.id)) ||
          JSON.stringify(layout(copy, variant.id)) !== JSON.stringify(layout(original, variant.id))) {
        throw new Error("Core artwork, availability, color, or approved price changed");
      }
    }
    targets.push({
      sku: `CORE-${index + 1}`, id: copy.id, title: copy.title,
      expectedVariants: enabled.map(variant => ({ id: variant.id, proposedPriceCents: variant.price })),
      coreUsOnlyRequiredBeforeLaunch: true,
    });
  }
}
for (const item of targets) {
  const product = await api(`shops/${audit.shopId}/products/${item.id}.json`);
  if (product.external?.id) {
    log.products[item.sku] = {
      ...log.products[item.sku], id: item.id, status: "native_channel_linked",
      externalId: product.external.id, handle: product.external.handle,
      verifiedAt: new Date().toISOString(),
    };
    await save();
    continue;
  }
  if (log.products[item.sku]) {
    if (product.is_locked && log.products[item.sku].status === "accepted_waiting_for_native_channel") continue;
    throw new Error(`Prior sync exists for ${item.sku}; reconcile before any retry`);
  }
  const enabled = product.variants.filter(variant => variant.is_enabled);
  if (product.is_locked || product.title !== item.title || enabled.length !== item.expectedVariants.length ||
      !product.images?.length || enabled.some(variant => !variant.is_available ||
        !item.expectedVariants.some(saved => saved.id === variant.id && saved.proposedPriceCents === variant.price))) {
    throw new Error(`Catalog changed before synchronization: ${item.sku}`);
  }
  for (const variant of enabled) {
    for (const [position, imageId] of Object.entries(item.expectedImages || {})) {
      if (!product.print_areas.some(area => area.variant_ids.includes(variant.id) &&
        area.placeholders.some(placeholder => placeholder.position === position &&
          placeholder.images.some(image => image.id === imageId)))) {
        throw new Error(`Print file changed before synchronization: ${item.sku}`);
      }
    }
  }
  log.products[item.sku] = {
    id: item.id, status: "request_pending", requestedAt: new Date().toISOString(),
    coreUsOnlyRequiredBeforeLaunch: item.coreUsOnlyRequiredBeforeLaunch || false,
  };
  await save();
  try {
    await api(`shops/${audit.shopId}/products/${item.id}/publish.json`, "POST", {
      title: true, description: true, images: true, variants: true, tags: true, shipping_template: true,
    });
    log.products[item.sku].status = "accepted_waiting_for_native_channel";
    await save();
    console.log(JSON.stringify({ sku: item.sku, result: "native_sync_requested" }));
  } catch (error) {
    log.products[item.sku].status = "unconfirmed_or_rejected";
    await save();
    throw error;
  }
}
const deadline = Date.now() + 300_000;
for (;;) {
  const pending = Object.entries(log.products).filter(([, record]) =>
    record.status === "accepted_waiting_for_native_channel");
  if (!pending.length || Date.now() >= deadline) break;
  for (const [sku, record] of pending) {
    const product = await api(`shops/${audit.shopId}/products/${record.id}.json`);
    if (product.external?.id) {
      Object.assign(record, {
        status: "native_channel_linked", externalId: product.external.id,
        handle: product.external.handle, verifiedAt: new Date().toISOString(),
      });
      console.log(JSON.stringify({ sku, result: "native_channel_linked" }));
    } else if (!product.is_locked) {
      record.status = "native_channel_failed_or_unlinked";
      console.log(JSON.stringify({ sku, result: record.status }));
    }
    await save();
  }
  if (Object.values(log.products).some(record => record.status === "accepted_waiting_for_native_channel")) {
    await new Promise(resolve => setTimeout(resolve, 20_000));
  }
}
const values = Object.values(log.products);
log.summary = {
  checkedAt: new Date().toISOString(), targetCount: targets.length,
  linked: values.filter(record => record.status === "native_channel_linked").length,
  pending: values.filter(record => record.status === "accepted_waiting_for_native_channel").length,
  failed: values.filter(record => /failed|rejected/.test(record.status)).length,
  publicLaunchPerformed: false, checkoutVerified: false, ordersCreated: false,
};
await save();
console.log(JSON.stringify(log.summary));
