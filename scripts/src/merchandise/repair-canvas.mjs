/** Replace the unavailable canvas size using the original vector artwork recipe.
 * Draft-only; never publishes, creates a duplicate product, or places an order.
 */
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { api, directory, root, saveJson } from "./printify-api.mjs";
import { renderArtwork } from "./artwork.mjs";

if (!process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Explicit workspace --apply is required");
}
const planPath = resolve(directory, "merchandise-production-plan.json");
const receiptPath = resolve(directory, "merchandise-draft-receipts.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
const receipts = JSON.parse(await readFile(receiptPath, "utf8"));
if (receipts.pendingWrite) throw new Error("Reconcile the previous write first");
const item = plan.products.find(product => product.sku === "SLESS-052");
const record = receipts.products["SLESS-052"];
let product = await api(`shops/${receipts.shopId}/products/${record.id}.json`);
if (product.external?.id || product.is_locked || product.blueprint_id !== 937 ||
    product.print_provider_id !== 39 || product.title !== item.listingTitle) {
  throw new Error("Canvas draft changed; review before modifying");
}
if (record.variants.length !== 1 || product.variants.some(variant =>
  variant.is_enabled && (variant.id !== record.variants[0].id ||
    variant.price !== record.variants[0].proposedPriceCents))) {
  throw new Error("Canvas variants/prices changed outside the operator");
}
const id = 253230;
const live = product.variants.find(variant => variant.id === id);
if (!live?.is_available || live.cost <= 0) throw new Error("Replacement canvas is unavailable");
const [catalog, quote] = await Promise.all([
  api("catalog/blueprints/937/print_providers/39/variants.json"),
  api("catalog/blueprints/937/print_providers/39/shipping.json"),
]);
const variant = catalog.variants.find(variant => variant.id === id);
const front = variant?.placeholders.find(position => position.position === "front");
if (!front || !quote.profiles.some(profile => profile.variant_ids.includes(id) &&
    profile.countries.includes("US"))) throw new Error("Replacement print area or shipping missing");
const replacement = structuredClone(item);
replacement.listingTitle = "Sless Is More — Matte Canvas, 12 × 20 in";
replacement.variants = [variant];
replacement.primaryVariantId = id;
replacement.positions = [front];
await renderArtwork({ products: [replacement] }, { persist: false });
const artwork = replacement.artwork[0];
let image = receipts.images[artwork.sha256];
if (!image) {
  receipts.pendingWrite = { kind: "image_upload", sku: item.sku, sha256: artwork.sha256 };
  await saveJson(receiptPath, receipts);
  const uploaded = await api("uploads/images.json", "POST", {
    file_name: basename(artwork.pngPath),
    contents: (await readFile(resolve(root, artwork.pngPath))).toString("base64"),
  });
  if (!uploaded.id || uploaded.width !== artwork.width || uploaded.height !== artwork.height) {
    throw new Error("Replacement artwork upload was not verified");
  }
  image = { id: uploaded.id, width: uploaded.width, height: uploaded.height, fileName: basename(artwork.pngPath) };
  receipts.images[artwork.sha256] = image;
  delete receipts.pendingWrite;
  await saveJson(receiptPath, receipts);
}
const policy = plan.pricingPolicy;
const price = Math.ceil((live.cost + policy.paymentFeeAllowanceCents) /
  (1 - policy.paymentFeeAllowanceRate - policy.targetMargin) / 100) * 100;
receipts.pendingWrite = { kind: "canvas_variant_update", sku: item.sku, productId: product.id, variantId: id, imageId: image.id };
await saveJson(receiptPath, receipts);
await api(`shops/${receipts.shopId}/products/${product.id}.json`, "PUT", {
  title: replacement.listingTitle,
  description: "<p>Original Sless Is More artwork on a 12 × 20 inch portrait matte canvas.</p><p>Made to order. Shipping is charged separately to eligible destinations.</p>",
  variants: product.variants.map(variant => ({
    id: variant.id, price: variant.id === id ? price : variant.price,
    is_enabled: variant.id === id, is_default: variant.id === id,
  })),
  print_areas: [{ variant_ids: product.variants.map(variant => variant.id), placeholders: [{
    position: "front", images: [{ id: image.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
  }] }],
});
product = await api(`shops/${receipts.shopId}/products/${product.id}.json`);
const enabled = product.variants.filter(variant => variant.is_enabled);
if (enabled.length !== 1 || enabled[0].id !== id || !enabled[0].is_available ||
    enabled[0].price !== price || product.title !== replacement.listingTitle ||
    !product.print_areas.some(area => area.variant_ids.includes(id) &&
      area.placeholders.some(position => position.position === "front" &&
        position.images.some(placed => placed.id === image.id)))) {
  throw new Error("Canvas update not verified; reconcile before retrying");
}
plan.products[plan.products.indexOf(item)] = replacement;
Object.assign(record, {
  title: replacement.listingTitle,
  artworkImageIds: { front: image.id },
  variants: [{ id, title: enabled[0].title, costCents: enabled[0].cost, proposedPriceCents: price, available: true }],
  shipping: {
    handlingTime: quote.handling_time,
    profiles: quote.profiles.filter(profile => profile.variant_ids.includes(id)).map(profile => ({
      countries: profile.countries, firstItem: profile.first_item,
      additionalItems: profile.additional_items, variantIds: [id],
    })),
  },
  availabilityRepair: { checkedAt: new Date().toISOString(), reason: "Rebuilt original vector design for available 12 × 20 inch portrait canvas; no stretching or duplicate product." },
});
await saveJson(planPath, plan);
delete receipts.pendingWrite;
await saveJson(receiptPath, receipts);
console.log(JSON.stringify({ sku: item.sku, variant: enabled[0].title, priceCents: price, artworkDimensions: [artwork.width, artwork.height], published: false }));
