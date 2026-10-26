/**
 * Owner approved the 10.5-inch proof for all three colors.
 * Existing product only; prices, SKUs, orders and canvas are not written.
 */
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { api, saveJson, directory } from "./printify-api.mjs";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";

const mode = process.argv[2];
if (!["artwork", "publish", "photos", "verify"].includes(mode) ||
    !process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Explicit workspace artwork|publish|photos|verify --apply required");
}
const before = JSON.parse(await fs.readFile(resolve(directory, "larger-shirt-before.json"), "utf8"));
const proof = JSON.parse(await fs.readFile(resolve(directory, "halloween-large-proof.json"), "utf8"));
const path = resolve(directory, "larger-shirt-live-update.json");
let log;
try { log = JSON.parse(await fs.readFile(path, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  log = { authorization: "Owner approved the 10.5-inch proof and update of all three colors.",
    shopId: proof.shopId, productId: proof.liveProductId, imageId: proof.image.id,
    ordersCreated: false, canvasChanged: false, priceChanges: false };
}
if (log.pendingWrite) throw new Error("Uncertain write: reconcile saved intent before proceeding");
const save = () => saveJson(path, log);
const endpoint = `shops/${log.shopId}/products/${log.productId}`;
const prices = p => JSON.stringify(p.variants.filter(v => v.is_enabled)
  .map(v => ({ id: v.id, price: v.price, sku: v.sku })).sort((a, b) => a.id - b.id));
let current = await api(`${endpoint}.json`);
if (current.external?.id !== "660" || current.blueprint_id !== 6 ||
    current.print_provider_id !== 99 || prices(current) !== prices(before.printify)) {
  throw new Error("Live product identity, variants, prices or SKUs changed");
}
const desired = before.printify.print_areas.map(area => {
  const active = before.printify.variants.filter(v => v.is_enabled && area.variant_ids.includes(v.id));
  if (!active.length) throw new Error("Unexpected area without selected variants");
  const templates = active.map(v => before.catalog.variants.find(x => x.id === v.id)
    ?.placeholders.find(x => x.position === "front"));
  const template = templates[0];
  if (!template || templates.some(t => !t || t.width !== template.width || t.height !== template.height)) {
    throw new Error("Mixed print-area dimensions");
  }
  if (template.width < 3150 || template.height < 3370) throw new Error("Larger artwork does not fit");
  return { variant_ids: area.variant_ids, placeholders: [{
    position: "front", decoration_method: template.decoration_method,
    images: [{ id: proof.image.id, x: 0.5, y: 1795 / template.height,
      scale: 3150 / template.width, angle: 0 }],
  }] };
});
function verifyArt(product) {
  for (const v of product.variants.filter(v => v.is_enabled)) {
    const expected = desired.find(a => a.variant_ids.includes(v.id)).placeholders[0].images[0];
    const actual = product.print_areas.find(a => a.variant_ids.includes(v.id))
      ?.placeholders.find(p => p.position === "front")?.images;
    if (actual?.length !== 1 || actual[0].id !== expected.id ||
        ["x", "y", "scale", "angle"].some(k => Math.abs(actual[0][k] - expected[k]) > 0.00001)) {
      throw new Error(`Artwork not verified for variant ${v.id}`);
    }
  }
  if (prices(product) !== prices(before.printify)) throw new Error("Price or SKU changed");
}
if (mode === "artwork" && !log.artworkVerified) {
  if (current.is_locked) throw new Error("Live product is locked");
  const description = before.printify.description.replace("6.75 inches", "10.5 inches");
  if (description === before.printify.description) throw new Error("Expected original print-size text missing");
  log.pendingWrite = { kind: "approved_shirt_artwork", imageId: proof.image.id, printAreas: desired };
  await save();
  await api(`${endpoint}.json`, "PUT", { print_areas: desired, description });
  current = await api(`${endpoint}.json`);
  verifyArt(current);
  log.artworkVerified = true;
  log.variantsVerified = current.variants.filter(v => v.is_enabled).map(v => ({ id: v.id, title: v.title, price: v.price }));
  log.artworkUpdatedAt = new Date().toISOString();
  delete log.pendingWrite;
  await save();
}
if (mode === "publish" && !log.nativePublishRequested) {
  verifyArt(current);
  if (current.is_locked) throw new Error("Native update already queued; reconcile instead of resubmitting");
  log.pendingWrite = { kind: "native_shirt_description_sync" };
  await save();
  // Keep the explicitly curated front-only gallery; photos are updated below.
  await api(`${endpoint}/publish.json`, "POST", {
    title: false, description: true, images: false, variants: false, tags: false, shipping_template: false,
  });
  log.nativePublishRequested = true;
  log.nativePublishRequestedAt = new Date().toISOString();
  delete log.pendingWrite;
  await save();
}
if (mode === "photos") {
  verifyArt(current);
  if (current.is_locked) throw new Error("Wait for native synchronization before updating photos");
  log.pendingWrite = { kind: "front_photos_and_variation_images" };
  await save();
  const php = await fs.readFile(new URL("./apply-large-shirt-photos.php", import.meta.url), "utf8");
  const payload = Buffer.from(JSON.stringify({ before: before.wordpress, mockups: proof.mockups })).toString("base64");
  log.wordpress = await sitegroundWordpress(
    `$payload=json_decode(base64_decode('${payload}'),true);` + php.replace(/^<\?php\s*/, ""),
    { timeoutMs: 180000 });
  if (!log.wordpress.verified || !log.wordpress.canvasUnchanged || !log.wordpress.homepageUnchanged) {
    throw new Error("Storefront image update not fully verified");
  }
  delete log.pendingWrite;
  log.photosUpdated = true;
  await save();
}
if (mode === "verify") verifyArt(current);
console.log(JSON.stringify({ mode, artworkVerified: Boolean(log.artworkVerified),
  nativePublishRequested: Boolean(log.nativePublishRequested), locked: current.is_locked,
  photosUpdated: Boolean(log.photosUpdated), variants: current.variants.filter(v => v.is_enabled).length,
  wordpress: log.wordpress || null }));
