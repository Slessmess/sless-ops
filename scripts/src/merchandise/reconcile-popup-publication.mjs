/**
 * Reconcile native Pop-Up publication into local receipts.
 * External reads only: never publishes, changes products, or submits orders.
 */
import { readFile } from "node:fs/promises";
import { api, directory, saveJson } from "./printify-api.mjs";

const planPath = `${directory}/printify-popup-preparation.json`;
const receiptPath = `${directory}/printify-popup-drafts.json`;
const plan = JSON.parse(await readFile(planPath, "utf8"));
const receipts = JSON.parse(await readFile(receiptPath, "utf8"));
if (plan.destinationShopId !== 29392858 ||
    receipts.destinationShopId !== plan.destinationShopId ||
    plan.proposedHostname !== "shop.slessismore.org" ||
    !plan.catalogCopy.ownerPreviewApproval ||
    !plan.catalogCopy.partialLaunchApproved ||
    !plan.nativeReadinessReview.sellerReadinessConfirmed) {
  throw new Error("Destination or owner/seller approval mismatch");
}

const products = [];
for (let page = 1; ; page++) {
  const result = await api(`shops/${plan.destinationShopId}/products.json?limit=50&page=${page}`);
  products.push(...result.data);
  if (products.length >= result.total) break;
  if (!result.data.length) throw new Error("Incomplete destination pagination");
}
if (products.length !== 56 || plan.catalog.length !== 56)
  throw new Error("Unexpected catalog count; reconcile before updating receipts");

let published = 0, held = 0, variants = 0, mockups = 0;
for (const item of plan.catalog) {
  const receipt = receipts.products[item.sourceProductId];
  if (!receipt?.verified) throw new Error(`Unverified product: ${item.sourceProductId}`);
  const product = products.find(p => p.id === receipt.productId);
  if (!product || product.is_locked) throw new Error(`Missing or queued product: ${receipt.productId}`);
  if (receipt.specialReview.length) {
    if (product.visible || product.external?.id || product.external?.handle)
      throw new Error(`Held product unexpectedly published: ${product.id}`);
    receipt.public = false;
    receipt.nativePublishingStatus = "Unpublished";
    held++;
    continue;
  }

  const expected = item.enabledVariants
    .map(v => [v.sourceVariantId, v.supplierRetailCents]).sort((a, b) => a[0] - b[0]);
  const actual = product.variants.filter(v => v.is_enabled)
    .map(v => [v.id, v.price]).sort((a, b) => a[0] - b[0]);
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error(`Enabled variants or approved prices changed: ${product.id}`);
  if (!product.visible || !product.external?.id || !product.external?.handle || !product.images?.length)
    throw new Error(`Publication, visibility, or mockups incomplete: ${product.id}`);
  const url = new URL(product.external.handle);
  if (url.origin !== "https://shop.slessismore.org" ||
      url.pathname !== `/product/${product.external.id}` || url.search || url.hash)
    throw new Error(`Unexpected public mapping: ${product.id}`);

  receipt.public = true;
  receipt.nativePublishingStatus = "Published";
  receipt.apiVisible = true;
  receipt.destinationUrl = url.href;
  receipt.externalProductId = String(product.external.id);
  item.destinationProductId = product.id;
  item.destinationUrl = url.href;
  item.publishedToPopup = true;
  published++;
  variants += actual.length;
  mockups += product.images.length;
}
if (published !== 46 || held !== 10) throw new Error("Approved partial scope mismatch");

const reviewedAt = new Date().toISOString();
Object.assign(plan.catalogCopy, {
  totalVerifiedProducts: 56,
  verifiedHiddenDrafts: 10,
  nativeCopiedUnpublishedDrafts: 0,
  totalVerifiedUnpublishedDrafts: 10,
  publicProductsPublishedByOperator: 46,
  publicStorefrontStillHasNoProducts: false,
  partialCatalogLive: true,
});
const routingEnabled = plan.mainSiteRouting?.enabled === true;
plan.status = routingEnabled ? "approved_46_products_live_main_site_routing_enabled"
  : "approved_46_products_live_awaiting_final_routing_gate";
plan.lastReviewedAt = reviewedAt;
receipts.published = true;
receipts.partialPublication = true;
receipts.publishedCount = published;
receipts.heldCount = held;
receipts.updatedAt = reviewedAt;
receipts.publicationIntent.state = "all_46_publication_and_visibility_reconciled";
receipts.publicationVerification = {
  reviewedAt, published, held, enabledVariants: variants, mockups,
  heldProductsMapped: 0, heldProductsVisible: 0, pendingLocks: 0,
  supplierPricesPreserved: true,
  nativeIndividualDetailsPreserved: true,
  noOrderOrPaymentSubmitted: true,
};
receipts.pausedForReview = !routingEnabled;
receipts.pauseReason = routingEnabled ? null :
  "Approved 46 products are live and verified. Ten products remain held. Main-site routing remains disabled pending the final return-path gate; no payment or order submitted.";
await saveJson(planPath, plan);
await saveJson(receiptPath, receipts);
console.log(JSON.stringify({ published, held, variants, mockups, externalWrites: false }));
