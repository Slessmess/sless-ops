/**
 * Copy approved live merchandise to the owner's new Pop-Up as hidden drafts.
 * Never publishes, changes the source, submits orders, or touches billing/DNS.
 * An uncertain create stops the operation until an operator reconciles it.
 */
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { api, saveJson } from "./printify-api.mjs";

const directory = "wordpress/sless-refresh";
const receiptPath = `${directory}/printify-popup-drafts.json`;
const plan = JSON.parse(await readFile(`${directory}/printify-popup-preparation.json`, "utf8"));
const destination = 29392858;
if (plan.sourceShopId !== 29231820 || plan.destinationShopId !== destination ||
  plan.proposedHostname !== "shop.slessismore.org") throw new Error("Unexpected migration identity");
const apply = process.argv.includes("--apply");
const all = process.argv.includes("--all");
// Explicit continuation keeps failed items under review; it never relaxes
// geometry checks, republishes a source, or substitutes a supplier.
const continueSafe = process.argv.includes("--continue-safe-items");
let receipts;
try { receipts = JSON.parse(await readFile(receiptPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  receipts = { sourceShopId: plan.sourceShopId, destinationShopId: destination, products: {}, published: false };
}
if (receipts.sourceShopId !== plan.sourceShopId || receipts.destinationShopId !== destination)
  throw new Error("Receipt shop mismatch");
if (receipts.pendingWrite) throw new Error("Unconfirmed creation exists; reconcile before retrying");
if (receipts.pausedForReview && !continueSafe)
  throw new Error(`Copy paused for review: ${receipts.pauseReason}; do not resume before resolving this gate`);

const shops = await api("shops.json");
if (!shops.some(s => s.id === destination && s.sales_channel === "storefront"))
  throw new Error("Verified storefront destination missing");

async function listProducts(shop) {
  const items = [];
  for (let page = 1;; page++) {
    const result = await api(`shops/${shop}/products.json?limit=50&page=${page}`);
    items.push(...result.data);
    if (items.length >= result.total) return items;
    if (!result.data.length) throw new Error("Incomplete product pagination");
  }
}
const destinationProducts = await listProducts(destination);
function enabled(p) { return p.variants.filter(v => v.is_enabled).sort((a, b) => a.id - b.id); }
function imageLayout(image) {
  const permitted = ["id", "x", "y", "scale", "angle", "flipX", "flipY", "pattern"];
  const layout = Object.fromEntries(permitted.filter(k => image[k] !== undefined).map(k => [k, image[k]]));
  if (!layout.id || !["x", "y", "scale", "angle"].every(k => Number.isFinite(layout[k])))
    throw new Error("Incomplete artwork placement");
  if (image.layerType && image.layerType !== "image")
    throw new Error("Unsupported layer type; use native product copying");
  return layout;
}
function printAreas(p) {
  const ids = new Set(enabled(p).map(v => v.id));
  return p.print_areas.map(area => ({
    variant_ids: area.variant_ids.filter(id => ids.has(id)),
    placeholders: area.placeholders.filter(h => h.images?.length).map(h => ({
      position: h.position,
      ...(h.decoration_method ? { decoration_method: h.decoration_method } : {}),
      images: h.images.map(imageLayout),
    })),
    ...(area.background ? { background: area.background } : {}),
  })).filter(area => area.variant_ids.length && area.placeholders.length);
}
function canonical(p) {
  const areas = printAreas(p);
  return {
    title: p.title, description: p.description,
    blueprint: p.blueprint_id, provider: p.print_provider_id,
    variants: enabled(p).map(v => ({
      id: v.id, price: v.price,
      artwork: areas.filter(a => a.variant_ids.includes(v.id)).flatMap(a =>
        a.placeholders.map(h => ({
          position: h.position, method: h.decoration_method || null,
          background: a.background || null,
          // The provider can normalize 0.5000000000000001 to 0.5 and regroup areas.
          // Normalize only comparison precision; send original geometry unchanged.
          images: h.images.map(i => ({
            ...i,
            ...Object.fromEntries(["x", "y", "scale", "angle"].map(k => [k, Number(i[k].toFixed(10))])),
            flipX: i.flipX || false, flipY: i.flipY || false,
          })),
        }))).sort((a, b) => a.position.localeCompare(b.position)),
    })),
  };
}
const selected = all ? plan.catalog : plan.catalog.filter(i => !i.specialReview.length).slice(0, 1);
for (const item of selected) {
  if (receipts.products[item.sourceProductId]?.verified) {
    console.log(JSON.stringify({alreadyVerified: item.title, hidden: true}));
    continue;
  }
  if (receipts.blockedProducts?.[item.sourceProductId]) {
    console.log(JSON.stringify({skipped: item.title, reason: receipts.blockedProducts[item.sourceProductId].reason}));
    continue;
  }
  if (continueSafe && receipts.products[item.sourceProductId]?.reviewReason) {
    console.log(JSON.stringify({skipped: item.title, reason: receipts.products[item.sourceProductId].reviewReason}));
    continue;
  }
  const source = await api(`shops/${plan.sourceShopId}/products/${item.sourceProductId}.json`);
  if (!source.visible || source.is_locked || String(source.external?.id) !== String(item.wooProductId))
    throw new Error(`Source no longer a stable live product: ${item.sourceProductId}`);
  if (source.print_details?.separator_type && !source.print_details.separator_color) {
    const reason = "Native separator setting is incomplete in the read API; copy in Printify rather than guessing its color";
    if (apply) {
      receipts.blockedProducts ||= {};
      receipts.blockedProducts[source.id] = { title: source.title, reason };
      await saveJson(receiptPath, receipts);
    }
    console.log(JSON.stringify({skipped: source.title, reason, sourceUnchanged: true}));
    continue;
  }
  const original = canonical(source);
  const prior = receipts.products[item.sourceProductId];
  const matches = destinationProducts.filter(p => p.title === source.title);
  if (matches.length > 1 || (!prior && matches.length))
    throw new Error("Unreconciled destination match; refusing duplicate creation");
  if (!apply) {
    console.log(JSON.stringify({wouldCopy: source.title, enabledVariants: original.variants.length, visible: false}));
    continue;
  }
  let draft;
  if (prior) {
    if (!prior.productId) throw new Error("Incomplete receipt");
    draft = await api(`shops/${destination}/products/${prior.productId}.json`);
  } else {
    const areas = printAreas(source);
    if (enabled(source).some(v => !areas.some(a => a.variant_ids.includes(v.id))))
      throw new Error("Enabled variant lacks printable artwork");
    receipts.pendingWrite = {
      kind: "hidden_draft_creation", sourceProductId: source.id, title: source.title,
      requestedAt: new Date().toISOString(),
    };
    await saveJson(receiptPath, receipts);
    try {
      draft = await api(`shops/${destination}/products.json`, "POST", {
      title: source.title, description: source.description, visible: false,
      blueprint_id: source.blueprint_id, print_provider_id: source.print_provider_id,
      variants: enabled(source).map(v => ({
        id: v.id, price: v.price, is_enabled: true, is_default: v.is_default === true,
      })),
      print_areas: areas,
      ...(source.print_details && !Array.isArray(source.print_details) ? {print_details: source.print_details} : {}),
      });
    } catch (error) {
      // A definite unsupported-provider rejection creates no product. Do not
      // substitute a supplier or retry this item. Other failures remain pending.
      const unavailable = error.message.includes('"code":6002') &&
        /Decorator \d+ not available for this blueprint \d+/.test(error.message);
      const rejectedSettings = continueSafe && error.message.includes('"code":8150') &&
        error.message.includes("Validation failed");
      if (!error.message.startsWith("Printify HTTP 400:") || (!unavailable && !rejectedSettings)) throw error;
      const reason = unavailable
        ? "Printify rejected the original provider for destination creation; native copying/review required"
        : "Native creation rejected source-derived settings; native copying/review required";
      receipts.blockedProducts ||= {};
      receipts.blockedProducts[source.id] = { title: source.title, reason, outcome: "explicit_http_400_rejection" };
      delete receipts.pendingWrite;
      await saveJson(receiptPath, receipts);
      console.log(JSON.stringify({skipped: source.title, reason, sourceUnchanged: true}));
      continue;
    }
    if (!draft.id) throw new Error("Unconfirmed creation; reconcile provider state before retry");
    receipts.products[item.sourceProductId] = {
      productId: draft.id, title: source.title, verified: false, public: false,
      specialReview: item.specialReview, copiedAt: new Date().toISOString(),
    };
    delete receipts.pendingWrite;
    await saveJson(receiptPath, receipts);
    draft = await api(`shops/${destination}/products/${draft.id}.json`);
    destinationProducts.push(draft);
  }
  if (draft.visible !== false) throw new Error("Destination not confirmed hidden; stop before any further creation");
  if (!isDeepStrictEqual(original, canonical(draft))) {
    receipts.products[item.sourceProductId].reviewReason =
      "Per-variant placement or configuration comparison needs review; keep hidden";
    await saveJson(receiptPath, receipts);
    if (!continueSafe) throw new Error("Destination artwork, variants, or supplier prices differ; review before continuing");
    console.log(JSON.stringify({reviewRequired: source.title, hidden: true}));
    continue;
  }
  const currentSource = prior?.verified ? source : await api(`shops/${plan.sourceShopId}/products/${source.id}.json`);
  if (!isDeepStrictEqual(original, canonical(currentSource)) ||
    !isDeepStrictEqual(source.external, currentSource.external) || currentSource.visible !== source.visible)
    throw new Error("Source changed during copying; inspect before continuing");
  receipts.products[item.sourceProductId].verified = true;
  receipts.products[item.sourceProductId].enabledVariants = original.variants.length;
  receipts.updatedAt = new Date().toISOString();
  await saveJson(receiptPath, receipts);
  console.log(JSON.stringify({copied: source.title, verified: true, hidden: true, sourceUnchanged: true}));
}
console.log(JSON.stringify({verifiedDrafts: Object.values(receipts.products).filter(p => p.verified).length, published: false}));
