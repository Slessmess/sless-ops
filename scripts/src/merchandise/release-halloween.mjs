/**
 * Owner-authorized Halloween release. No order, payment or production endpoints.
 * Persist every write intent; uncertain writes must be reconciled, never retried.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve, basename } from "node:path";
import { api, root, directory, saveJson } from "./printify-api.mjs";

const require = createRequire(new URL("../../../artifacts/api-server/package.json", import.meta.url));
const sharp = require("sharp");
const mode = process.argv[2];
if (!["prepare", "price", "publish", "status"].includes(mode) ||
    !process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Explicit workspace prepare|price|publish|status --apply required");
}
const receiptPath = resolve(directory, "halloween-release.json");
let log;
try { log = JSON.parse(await readFile(receiptPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  log = {
    shopId: 29231820, images: {}, products: {},
    authorization: "Owner requested finish it up and get it on the site for sale.",
    ordersCreated: false, productionApproved: false,
  };
}
const save = () => saveJson(receiptPath, log);
const output = resolve(root, "attached_assets/generated_images/halloween-production");
await mkdir(output, { recursive: true });
const shops = await api("shops.json");
if (!shops.some(s => s.id === log.shopId && s.sales_channel === "woocommerce")) {
  throw new Error("Expected native WooCommerce shop missing");
}
const all = [];
for (let page = 1;; page++) {
  const result = await api(`shops/${log.shopId}/products.json?limit=50&page=${page}`);
  all.push(...result.data);
  if (all.length >= result.total) break;
  if (!result.data.length) throw new Error("Incomplete catalog");
}
if (log.pendingWrite) throw new Error("Unconfirmed provider write: inspect saved intent before proceeding");
const specs = [
  {
    key: "shirt", title: "Sless After Dark — Halloween Tee", blueprint: 6, provider: 99,
    source: "attached_assets/generated_images/merch-refresh-halloween-shirt-transparent.png",
    description: "<p>Sless Taylor perches above the ring in this original Sless After Dark Halloween illustration: a white cape, pumpkin lantern, orange moon, haunted houses and purple clouds.</p><p>The shaped artwork has a transparent outer edge—not a square background panel. Choose Purple, Orange or Black in adult unisex sizes S–3XL. Printed on the front of a Gildan 5000 heavy cotton tee, with a classic fit and crew neckline.</p><p>Approximate artwork width: 6.75 inches. Made to order. Shipping is calculated at checkout for supported destinations. No guaranteed Halloween arrival date.</p>",
    tags: ["Sless After Dark", "Halloween", "Sless Taylor"],
  },
  {
    key: "canvas", title: "Sless After Dark — Halloween Canvas, 6 × 6 in", blueprint: 937, provider: 105,
    source: "attached_assets/generated_images/merch-refresh-halloween-canvas-original.png",
    description: "<p>The complete approved Sless After Dark Halloween scene on a compact 6 × 6 inch matte stretched canvas with a 0.75-inch depth.</p><p>This wall-art edition uses the original full-square composition: Sless Taylor, the orange moon, purple clouds, haunted houses and curling mist. It is not the shirt-adapted cutout design.</p><p>Made to order by Jondo. Shipping is calculated at checkout for supported destinations. No guaranteed Halloween arrival date.</p>",
    tags: ["Sless After Dark", "Halloween", "Canvas", "Sless Taylor"],
  },
];
const upload = async path => {
  const bytes = await readFile(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (log.images[hash]) return log.images[hash];
  log.pendingWrite = { kind: "image_upload", hash, file: path.replace(root, "") };
  await save();
  const image = await api("uploads/images.json", "POST", {
    file_name: basename(path), contents: bytes.toString("base64"),
  });
  const meta = await sharp(bytes).metadata();
  if (!image.id || image.width !== meta.width || image.height !== meta.height) {
    throw new Error("Upload dimensions not verified");
  }
  log.images[hash] = { id: image.id, width: image.width, height: image.height };
  delete log.pendingWrite;
  await save();
  return log.images[hash];
};
if (mode === "price") {
  const record = log.products.canvas;
  if (!record || record.state !== "draft_created") throw new Error("Expected unpriced canvas draft missing");
  let product = await api(`shops/${log.shopId}/products/${record.id}.json`);
  const enabled = product.variants.filter(v => v.is_enabled);
  if (product.external?.id || product.is_locked || enabled.length !== 1 ||
      enabled[0].id !== 102202 || enabled[0].price !== 2500 || enabled[0].cost !== 1663) {
    throw new Error("Canvas changed before price review");
  }
  const price = 3100;
  log.pendingWrite = { kind: "canvas_price_update", productId: product.id, price };
  await save();
  await api(`shops/${log.shopId}/products/${product.id}.json`, "PUT", {
    variants: product.variants.map(v => ({
      id: v.id, price: v.id === 102202 ? price : v.price,
      is_enabled: v.id === 102202, is_default: v.id === 102202,
    })),
  });
  product = await api(`shops/${log.shopId}/products/${product.id}.json`);
  const current = product.variants.filter(v => v.is_enabled);
  if (current.length !== 1 || current[0].id !== 102202 || current[0].price !== price || !current[0].is_available) {
    throw new Error("Canvas price not verified");
  }
  record.variants = current.map(v => ({
    id: v.id, title: v.title, cost: v.cost, price: v.price, available: v.is_available,
  }));
  record.state = "draft_verified";
  delete log.pendingWrite;
  await save();
}
if (mode === "prepare") {
  for (const spec of specs) {
    if (log.products[spec.key]) continue;
    if (all.some(p => p.title === spec.title)) throw new Error("Matching product exists; reconcile before creation");
    const catalog = await api(`catalog/blueprints/${spec.blueprint}/print_providers/${spec.provider}/variants.json`);
    const variants = catalog.variants.filter(v => spec.key === "shirt"
      ? ["Purple", "Orange", "Black"].includes(v.options.color) &&
        ["S", "M", "L", "XL", "2XL", "3XL"].includes(v.options.size)
      : v.id === 102202);
    if (variants.length !== (spec.key === "shirt" ? 18 : 1)) throw new Error("Required catalog options missing");
    const shipping = await api(`catalog/blueprints/${spec.blueprint}/print_providers/${spec.provider}/shipping.json`);
    for (const v of variants) {
      if (!shipping.profiles.some(p => p.variant_ids.includes(v.id) && p.countries.includes("US"))) {
        throw new Error("US shipping quote missing");
      }
    }
    const groups = new Map();
    for (const v of variants) {
      const front = v.placeholders.find(p => p.position === "front");
      if (!front) throw new Error("Front template missing");
      const key = `${front.width}x${front.height}`;
      if (!groups.has(key)) groups.set(key, { front, ids: [] });
      groups.get(key).ids.push(v.id);
    }
    const areas = [];
    for (const [key, group] of groups) {
      const { width, height } = group.front;
      const file = resolve(output, `${spec.key}-${key}.png`);
      if (spec.key === "shirt") {
        const design = await sharp(resolve(root, spec.source)).resize(2025, 2025, { kernel: "lanczos3" }).toBuffer();
        await sharp({ create: { width, height, channels: 4, background: "#00000000" } })
          .composite([{ input: design, left: Math.round((width - 2025) / 2), top: 220 }])
          .withMetadata({ density: 300 }).png().toFile(file);
      } else {
        // Resampling only: no generated detail, cropping or composition changes.
        await sharp(resolve(root, spec.source)).resize(width, height, { fit: "fill", kernel: "lanczos3" })
          .withMetadata({ density: 300 }).png().toFile(file);
      }
      const image = await upload(file);
      areas.push({
        variant_ids: group.ids,
        placeholders: [{ position: "front", decoration_method: group.front.decoration_method,
          images: [{ id: image.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
      });
    }
    const provisional = v => spec.key === "canvas" ? 2500
      : v.options.size === "3XL" ? 3000 : v.options.size === "2XL" ? 2800 : 2500;
    const body = {
      title: spec.title, description: spec.description, blueprint_id: spec.blueprint,
      print_provider_id: spec.provider, tags: spec.tags,
      variants: variants.map(v => ({ id: v.id, price: provisional(v), is_enabled: true,
        is_default: spec.key === "canvas" || (v.options.color === "Purple" && v.options.size === "M") })),
      print_areas: areas,
    };
    log.pendingWrite = { kind: "product_create", key: spec.key, title: spec.title };
    await save();
    const product = await api(`shops/${log.shopId}/products.json`, "POST", body);
    if (!product.id) throw new Error("No product ID returned");
    log.products[spec.key] = { id: product.id, title: spec.title, state: "draft_created",
      blueprint: spec.blueprint, provider: spec.provider, source: spec.source,
      sourcePixels: 1024, sourceEffectivePpi: spec.key === "shirt" ? 1024 / 6.75 : 1024 / 6,
      variantIds: variants.map(v => v.id), areas, createdAt: new Date().toISOString(),
      shipping: shipping.profiles.filter(p => p.variant_ids.some(id => variants.some(v => v.id === id)))
        .map(p => ({ countries: p.countries, firstItem: p.first_item, additionalItems: p.additional_items,
          variantIds: p.variant_ids.filter(id => variants.some(v => v.id === id)) })),
    };
    delete log.pendingWrite;
    await save();
    const enabled = product.variants.filter(v => v.is_enabled);
    const minimum = v => Math.ceil((v.cost + 50) / (1 - 0.035 - 0.40) / 100) * 100;
    if (enabled.length !== variants.length || enabled.some(v => !v.is_available || v.cost <= 0)) {
      throw new Error("Draft has unavailable variants");
    }
    if (enabled.some(v => v.price < minimum(v))) {
      throw new Error("Draft price below production/estimated fee floor; review before publication");
    }
    log.products[spec.key].variants = enabled.map(v => ({
      id: v.id, title: v.title, cost: v.cost, price: v.price, available: v.is_available,
    }));
    log.products[spec.key].state = "draft_verified";
    await save();
    console.log(JSON.stringify({ key: spec.key, id: product.id, variants: enabled.length,
      prices: [...new Set(enabled.map(v => v.price))], mockups: product.images?.length || 0 }));
  }
}
for (const spec of specs) {
  const record = log.products[spec.key];
  if (!record) throw new Error("Prepare both products before release");
  let product = await api(`shops/${log.shopId}/products/${record.id}.json`);
  if (mode === "publish" && !product.external?.id) {
    if (record.state !== "draft_verified" || product.is_locked) throw new Error("Product not ready to publish");
    const enabled = product.variants.filter(v => v.is_enabled);
    if (enabled.length !== record.variantIds.length || !product.images?.length ||
        enabled.some(v => !v.is_available || !record.variants.some(saved => saved.id === v.id && saved.price === v.price))) {
      throw new Error("Draft changed before publication");
    }
    for (const area of record.areas) {
      for (const id of area.variant_ids) {
        if (!product.print_areas.some(a => a.variant_ids.includes(id) &&
            a.placeholders.some(p => p.position === "front" &&
              p.images.some(i => i.id === area.placeholders[0].images[0].id)))) {
          throw new Error("Print association changed");
        }
      }
    }
    record.state = "publish_requested";
    record.requestedAt = new Date().toISOString();
    await save();
    await api(`shops/${log.shopId}/products/${product.id}/publish.json`, "POST", {
      title: true, description: true, images: true, variants: true, tags: true, shipping_template: true,
    });
    record.state = "waiting_for_native_channel";
    await save();
    product = await api(`shops/${log.shopId}/products/${record.id}.json`);
  }
  if (product.external?.id) {
    record.state = "native_channel_linked";
    record.external = product.external;
    record.linkedAt = new Date().toISOString();
    await save();
  }
  const mockups = product.images?.filter(i => spec.key === "canvas" || i.position === "front") || [];
  console.log(JSON.stringify({ key: spec.key, state: record.state, id: record.id,
    external: product.external, locked: product.is_locked, variants: product.variants.filter(v => v.is_enabled)
      .map(v => ({ id: v.id, title: v.title, price: v.price, available: v.is_available })),
    mockups: mockups.map(i => ({ src: i.src, variant_ids: i.variant_ids, is_default: i.is_default })).slice(0, 7) }));
}
