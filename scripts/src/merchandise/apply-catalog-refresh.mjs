/**
 * Owner-authorized illustration/copy refresh. Catalog writes only.
 * No order, payment, billing or production endpoints are reachable here.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { api, root, saveJson } from "./printify-api.mjs";

const mode = process.argv[2];
if (!["prepare", "publish", "status"].includes(mode) ||
    !process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Workspace prepare|publish|status --apply required");
}
const shop = 29231820;
const dir = resolve(root, "generated-artifacts/catalog-refresh");
const manifest = JSON.parse(await readFile(resolve(dir, "rendered.json"), "utf8"));
const before = JSON.parse(await readFile(resolve(dir, "before.json"), "utf8"));
const receiptFile = resolve(dir, "operations.json");
let log;
try { log = JSON.parse(await readFile(receiptFile, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  log = { shop, products: {}, uploads: {}, ordersCreated: false, productionApproved: false,
    authorization: "Owner approved holiday designs for the site and requested illustrated artwork plus revised copy on the other merchandise." };
}
const save = () => saveJson(receiptFile, log);
if (log.pendingWrite) throw new Error("Unconfirmed write requires reconciliation before any retry");
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7).split(",");
const selected = manifest.filter(item => !only || only.includes(item.sku));
const protectedIds = new Set([
  "6ad4ff607e86416ffc097c36", "6ad4ff59e2ff8ddc0b0e6627",
  "6ac5cc05014b7d9bf2098516", "6ac5cc03a6afd99ddd03f538", "6ac5cc01399aa3961002c5af",
]);
const signature = p => JSON.stringify(p.variants.map(v => ({
  id: v.id, price: v.price, sku: v.sku, enabled: v.is_enabled,
})).sort((a, b) => a.id - b.id));
async function write(path, method, body, intent) {
  if (!/^(uploads\/images\.json|shops\/29231820\/products(?:\/[a-z0-9]+(?:\/publish)?)?\.json)$/.test(path)) {
    throw new Error("Non-catalog write rejected");
  }
  log.pendingWrite = { ...intent, time: new Date().toISOString() };
  await save();
  const result = await api(path, method, body);
  // Caller commits returned IDs before clearing uncertain-write state.
  return result;
}
async function upload(file) {
  const bytes = await readFile(resolve(root, file.file));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (log.uploads[hash]) return log.uploads[hash];
  const image = await write("uploads/images.json", "POST", {
    file_name: `sless-illustrated-${hash.slice(0, 12)}-${basename(file.file)}`,
    contents: bytes.toString("base64"),
  }, { kind: "image_upload", hash, file: file.file });
  if (!image.id || image.width !== file.width || image.height !== file.height) {
    throw new Error("Uploaded image geometry mismatch");
  }
  log.uploads[hash] = { id: image.id, width: image.width, height: image.height };
  delete log.pendingWrite;
  await save();
  return log.uploads[hash];
}
async function allProducts() {
  const result = [];
  for (let page = 1;; page++) {
    const response = await api(`shops/${shop}/products.json?limit=50&page=${page}`);
    result.push(...response.data);
    if (result.length >= response.total) return result;
    if (!response.data.length) throw new Error("Incomplete provider catalog");
  }
}
const shops = await api("shops.json");
if (!shops.some(s => s.id === shop && s.sales_channel === "woocommerce")) {
  throw new Error("Connected WooCommerce shop missing");
}
const live = await allProducts();
for (const item of selected) {
  let record = log.products[item.sku];
  if (mode === "prepare" && (!record?.prepared || process.argv.includes("--reprepare"))) {
    if (record?.printSizing === "large-front" || item.printSizing === "large-front") {
      throw new Error("Use the calibrated tee enlargement operator; full-template rendering would regress the approved chest size");
    }
    if (item.id && protectedIds.has(item.id)) throw new Error("Protected product rejected");
    const old = item.new ? null : before.find(p => p.id === item.id);
    let current = item.new ? null : live.find(p => p.id === item.id);
    if (!item.new && (!old || !current || current.is_locked ||
        current.external?.id !== item.externalId || signature(current) !== signature(old))) {
      throw new Error(`Existing product changed outside this operation: ${item.sku}`);
    }
    if (item.new && live.some(p => p.title === item.title) && !record?.id) {
      throw new Error("Matching Christmas tee already exists; reconcile rather than duplicate");
    }
    const files = [];
    for (const file of item.files) files.push({ ...file, image: await upload(file) });
    let areas;
    if (item.new) {
      const shipping = await api(`catalog/blueprints/${item.blueprint}/print_providers/${item.provider}/shipping.json`);
      if (item.variants.some(v => !shipping.profiles.some(p =>
        p.variant_ids.includes(v.id) && p.countries.includes("US")))) {
        throw new Error("New shirt lacks required shipping coverage");
      }
      areas = files.map(file => ({
        variant_ids: file.variantIds, placeholders: [{
          position: "front", decoration_method: file.method,
          images: [{ id: file.image.id, x: .5, y: .5, scale: 1, angle: 0 }],
        }],
      }));
      current = await write(`shops/${shop}/products.json`, "POST", {
        title: item.title, description: item.description, blueprint_id: item.blueprint,
        print_provider_id: item.provider, variants: item.variants, print_areas: areas,
        tags: ["Sless Taylor", "Christmas", "Sless Is Cheer"],
      }, { kind: "product_create", sku: item.sku, title: item.title });
      if (!current.id) throw new Error("New product response missing ID");
    } else {
      areas = current.print_areas.map(area => ({
        variant_ids: area.variant_ids,
        placeholders: area.placeholders.filter(p => p.images.length).map(p => {
          const file = files.find(f => f.position === p.position &&
            f.width === p.images[0].width && f.height === p.images[0].height);
          if (!file) throw new Error(`Unrendered position ${item.sku}/${p.position}`);
          return { position: p.position, decoration_method: p.decoration_method,
            images: [{ id: file.image.id, x: .5, y: .5, scale: 1, angle: 0 }] };
        }),
      }));
      current = await write(`shops/${shop}/products/${item.id}.json`, "PUT", {
        title: item.title, description: item.description, print_areas: areas,
        tags: [...new Set([...(current.tags || []), "Sless Taylor", "Illustrated Sless", item.collection])],
      }, { kind: "product_update", sku: item.sku, id: item.id, title: item.title });
    }
    record = log.products[item.sku] = {
      id: current.id, title: item.title, externalId: current.external?.id,
      areas, expectedImages: files.map(f => f.image.id), prepared: false,
      preparedAt: new Date().toISOString(),
    };
    delete log.pendingWrite;
    await save();
    current = await api(`shops/${shop}/products/${record.id}.json`);
    if (!item.new && signature(current) !== signature(old)) throw new Error("Prices/SKUs/enabled variants changed unexpectedly");
    const enabled = current.variants.filter(v => v.is_enabled);
    if (!enabled.length || (item.new && (enabled.length !== 18 ||
        enabled.some(v => !v.is_available || v.price * .965 - 50 <= v.cost)))) {
      throw new Error("New shirt availability/production-cost check failed");
    }
    for (const area of areas) for (const id of area.variant_ids) {
      for (const place of area.placeholders) {
        if (!current.print_areas.some(a => a.variant_ids.includes(id) &&
            a.placeholders.some(p => p.position === place.position &&
              p.images.some(i => i.id === place.images[0].id)))) {
          throw new Error("New artwork coverage not verified");
        }
      }
    }
    record.prepared = true;
    record.variants = enabled.map(v => ({ id: v.id, title: v.title, price: v.price, cost: v.cost, available: v.is_available }));
    record.mockups = current.images;
    await save();
    console.log(JSON.stringify({ sku: item.sku, prepared: true, id: current.id, variants: enabled.length, mockups: current.images.length }));
  }
  if (!record) {
    if (mode === "status") continue;
    throw new Error(`Not prepared: ${item.sku}`);
  }
  let current = await api(`shops/${shop}/products/${record.id}.json`);
  if (mode === "publish" && !record.publishRequestedAt) {
    if (!record.prepared || current.is_locked || !current.images.length ||
        current.title !== item.title || record.expectedImages.some(id =>
          !current.print_areas.some(a => a.placeholders.some(p => p.images.some(i => i.id === id))))) {
      throw new Error(`Publication preflight failed: ${item.sku}`);
    }
    const old = before.find(p => p.id === current.id);
    if (old && signature(old) !== signature(current)) throw new Error("Variant safety check failed");
    record.publishRequestedAt = new Date().toISOString();
    await save();
    await write(`shops/${shop}/products/${record.id}/publish.json`, "POST", {
      title: true, description: true, images: true, variants: true,
      tags: true, shipping_template: Boolean(item.new),
    }, { kind: "publish_request", sku: item.sku, id: record.id });
    delete log.pendingWrite;
    record.publishAccepted = true;
    await save();
    console.log(JSON.stringify({ sku: item.sku, publishAccepted: true }));
  }
  if (mode === "status") {
    record.externalId = current.external?.id;
    record.locked = current.is_locked;
    record.mockups = current.images;
    await save();
    console.log(JSON.stringify({ sku: item.sku, id: record.id, external: current.external, locked: current.is_locked, publishedRequested: Boolean(record.publishRequestedAt) }));
  }
}
