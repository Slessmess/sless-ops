/**
 * Owner-requested unpublished larger-print proof. No live update or publication.
 * Uses the existing native provider to produce honest supplier mockups.
 */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve, relative } from "node:path";
import { api, directory, root, saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Explicit workspace --apply required");
}
const require = createRequire(new URL("../../../artifacts/api-server/package.json", import.meta.url));
const sharp = require("sharp");
const output = resolve(root, "attached_assets/generated_images/halloween-large-proof");
const receiptPath = resolve(directory, "halloween-large-proof.json");
const title = "Sless After Dark — Larger Print PROOF — NOT PUBLISHED";
let receipt;
try { receipt = JSON.parse(await fs.readFile(receiptPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  receipt = {
    title, shopId: 29231820, liveProductId: "6ad4ff59e2ff8ddc0b0e6627",
    authorization: "Prepare a sharper, larger-print proof; review before replacing live artwork.",
    publicationAuthorized: false, liveProductChanged: false, canvasChanged: false,
    ordersCreated: false, productionApproved: false, approximatePrintWidthInches: 10.5,
  };
}
if (receipt.pendingWrite) throw new Error("Uncertain write; reconcile saved intent before retrying");
const live = await api(`shops/${receipt.shopId}/products/${receipt.liveProductId}.json`);
if (live.title !== "Sless After Dark — Halloween Tee" || live.external?.id !== "660") {
  throw new Error("Expected live product identity changed");
}
// Supplier reads regenerate layer UUIDs. Compare meaningful artwork/placement
// and prices, not transient render metadata or response ordering.
const signature = p => createHash("sha256").update(JSON.stringify({
  areas: p.print_areas.map(a => ({
    ids: [...a.variant_ids].sort((a, b) => a - b),
    placeholders: a.placeholders.filter(x => x.images.length).map(x => ({
      position: x.position,
      images: x.images.map(i => ({ id: i.id, x: i.x, y: i.y, scale: i.scale, angle: i.angle })),
    })).sort((a, b) => a.position.localeCompare(b.position)),
  })).sort((a, b) => a.ids[0] - b.ids[0]),
  variants: p.variants.filter(v => v.is_enabled).map(v => ({ id: v.id, price: v.price }))
    .sort((a, b) => a.id - b.id),
})).digest("hex");
if (receipt.signatureVersion !== 2) {
  const baseline = JSON.parse(await fs.readFile(resolve(directory, "shirt-image-audit.json"), "utf8")).printify;
  if (signature(baseline) !== signature(live)) throw new Error("Original artwork or prices changed before proof");
  receipt.liveBeforeSignature = signature(live);
  receipt.signatureVersion = 2;
  await saveJson(receiptPath, receipt);
}
const catalog = await api("catalog/blueprints/6/print_providers/99/variants.json");
const variantIds = [12017, 12125, 12011]; // Purple/M, Black/M, Orange/M.
const variants = variantIds.map(id => catalog.variants.find(v => v.id === id));
if (variants.some(v => !v || v.options.size !== "M")) throw new Error("Proof variants changed");
const placeholder = variants[0].placeholders.find(p => p.position === "front");
if (variants.some(v => !v.placeholders.some(p =>
  p.position === "front" && p.width === placeholder.width && p.height === placeholder.height))) {
  throw new Error("Proof requires a shared M front template");
}
const source = resolve(output, "shirt-art-enhanced-4096.png");
const enhanced = await sharp(source).metadata();
if (enhanced.width !== 4096 || enhanced.height !== 4096 || !enhanced.hasAlpha) {
  throw new Error("Expected transparent enhanced master missing");
}
await fs.mkdir(output, { recursive: true });
const uploadPath = resolve(output, "shirt-larger-3150.png");
if (!receipt.image) {
  await sharp(source).resize(3150, 3150, { kernel: "lanczos3" })
    .withMetadata({ density: 300 }).png().toFile(uploadPath);
  const bytes = await fs.readFile(uploadPath);
  receipt.pendingWrite = { kind: "proof_image_upload", sha256: createHash("sha256").update(bytes).digest("hex") };
  await saveJson(receiptPath, receipt);
  const image = await api("uploads/images.json", "POST", {
    file_name: "sless-halloween-large-print-proof-3150.png", contents: bytes.toString("base64"),
  });
  if (!image.id || image.width !== 3150 || image.height !== 3150) {
    throw new Error("Enhanced proof upload dimensions not verified");
  }
  receipt.image = { id: image.id, width: image.width, height: image.height };
  delete receipt.pendingWrite;
  await saveJson(receiptPath, receipt);
}
const placement = {
  id: receipt.image.id, x: 0.5, y: (220 + 3150 / 2) / placeholder.height,
  scale: 3150 / placeholder.width, angle: 0,
};
if (!receipt.productId) {
  const existing = [];
  for (let page = 1;; page++) {
    const products = await api(`shops/${receipt.shopId}/products.json?limit=50&page=${page}`);
    existing.push(...products.data);
    if (existing.length >= products.total) break;
    if (!products.data.length) throw new Error("Incomplete proof duplicate check");
  }
  if (existing.some(p => p.title === title)) throw new Error("Matching proof already exists; reconcile before creation");
  receipt.pendingWrite = { kind: "unpublished_proof_creation", title };
  await saveJson(receiptPath, receipt);
  const product = await api(`shops/${receipt.shopId}/products.json`, "POST", {
    title, visible: false,
    description: "<p>Owner-review proof only. Enhanced existing artwork, approximately 10.5-inch front placement. Not a native 300-DPI original and not a physical print sample. Do not publish or approve production without owner approval.</p>",
    blueprint_id: 6, print_provider_id: 99,
    variants: variantIds.map(id => ({ id, price: 2500, is_enabled: true, is_default: id === 12017 })),
    print_areas: [{ variant_ids: variantIds, placeholders: [{
      position: "front", decoration_method: placeholder.decoration_method, images: [placement],
    }] }],
  });
  if (!product.id) throw new Error("No proof product ID");
  receipt.productId = product.id;
  receipt.placement = placement;
  receipt.template = placeholder;
  receipt.createdAt = new Date().toISOString();
  delete receipt.pendingWrite;
  await saveJson(receiptPath, receipt);
}
const proof = await api(`shops/${receipt.shopId}/products/${receipt.productId}.json`);
if (proof.external?.id || proof.title !== title) throw new Error("Proof identity/publication changed");
const enabled = proof.variants.filter(v => v.is_enabled);
if (enabled.length !== 3 || enabled.some(v => !variantIds.includes(v.id))) {
  throw new Error("Proof variant set changed");
}
receipt.mockups = [];
for (const variant of variants) {
  const candidates = proof.images.filter(i => i.position === "front" && i.variant_ids.includes(variant.id));
  // Provider camera labels can be "front-2"; the canonical position is authoritative.
  const image = candidates.find(i => i.is_default) || candidates[0];
  if (!image) throw new Error("Straight-on front mockup missing");
  const response = await fetch(image.src, { signal: AbortSignal.timeout(90000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("Proof mockup download failed");
  }
  const color = variant.options.color.toLowerCase();
  const file = resolve(output, `larger-${color}-supplier.jpg`);
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
  receipt.mockups.push({ color, variantId: variant.id, file: relative(root, file), url: image.src });
}
const after = await api(`shops/${receipt.shopId}/products/${receipt.liveProductId}.json`);
if (after.external?.id !== "660" || signature(after) !== receipt.liveBeforeSignature) {
  throw new Error("Live product changed during proof preparation");
}
receipt.liveProductUnchangedVerified = true;
receipt.nativeChannelLinked = Boolean(proof.external?.id);
await saveJson(receiptPath, receipt);
console.log(JSON.stringify({ productId: proof.id, published: false, approximatePrintWidthInches: 10.5,
  liveProductUnchangedVerified: true, mockups: receipt.mockups.map(m => ({ color: m.color, file: m.file })) }));
