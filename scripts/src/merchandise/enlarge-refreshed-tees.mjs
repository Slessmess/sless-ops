/**
 * Actual 10.5-inch front artwork, measured against SUPPLIER print-area pixels.
 * Cropped artwork is positioned directly: never a tiny image inside a big canvas.
 * Existing catalog updates only; no creation, orders, payments or production.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { api, saveJson } from "./printify-api.mjs";

const mode = process.argv[2];
if (!["inspect", "prepare", "publish", "status", "verify"].includes(mode) || !process.argv.includes("--apply") ||
    process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Workspace inspect|prepare|publish|status --apply required");
const shop = 29231820, dir = "generated-artifacts/large-tee-correction";
const manifest = JSON.parse(await readFile("generated-artifacts/catalog-refresh/rendered.json", "utf8"));
const operationsPath = "generated-artifacts/catalog-refresh/operations.json";
const operations = JSON.parse(await readFile(operationsPath, "utf8"));
if (operations.pendingWrite) throw new Error("Existing uncertain catalog write");
const targetSkus = [...Array.from({ length: 11 }, (_, i) => `SLESS-${String(i + 4).padStart(3, "0")}`), "SLESS-CHRISTMAS-TEE"];
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7).split(",");
const targets = manifest.filter(p => targetSkus.includes(p.sku) && (!only || only.includes(p.sku)));
const forbidden = new Set(["6ad4ff607e86416ffc097c36", "6ad4ff59e2ff8ddc0b0e6627",
  "6ac5cc05014b7d9bf2098516", "6ac5cc03a6afd99ddd03f538", "6ac5cc01399aa3961002c5af"]);
const signature = p => JSON.stringify(p.variants.map(v => ({ id: v.id, sku: v.sku, price: v.price, enabled: v.is_enabled })).sort((a, b) => a.id - b.id));
let journal;
try { journal = JSON.parse(await readFile(`${dir}/operations.json`, "utf8")); }
catch (e) { if (e.code !== "ENOENT") throw e; journal = { shop, uploads: {}, products: {}, ordersCreated: false, productionApproved: false }; }
const save = () => saveJson(`${dir}/operations.json`, journal);
if (journal.pendingWrite) throw new Error("Reconcile uncertain enlargement write before retry");
let baseline;
if (mode === "inspect") {
  try { await readFile(`${dir}/before.json`); throw new Error("Enlargement baseline already exists; do not overwrite"); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  const all = [];
  for (let page = 1;; page++) {
    const response = await api(`shops/${shop}/products.json?limit=50&page=${page}`);
    all.push(...response.data);
    if (all.length >= response.total) break;
  }
  baseline = all.filter(p => targetSkus.some(s => operations.products[s]?.id === p.id) || forbidden.has(p.id));
  await saveJson(`${dir}/before.json`, baseline);
} else baseline = JSON.parse(await readFile(`${dir}/before.json`, "utf8"));
async function write(path, method, body, intent) {
  if (!/^uploads\/images\.json$|^shops\/29231820\/products\/[a-f0-9]+(?:\/publish)?\.json$/.test(path)) throw new Error("Noncatalog write rejected");
  journal.pendingWrite = { ...intent, at: new Date().toISOString() }; await save();
  return api(path, method, body);
}
for (const item of targets) {
  const id = operations.products[item.sku].id;
  if (forbidden.has(id)) throw new Error("Protected merchandise");
  const old = baseline.find(p => p.id === id);
  let current = mode === "inspect" ? old : await api(`shops/${shop}/products/${id}.json`);
  if (!old || !current || signature(current) !== signature(old) ||
      String(current.external?.id) !== String(old.external?.id)) throw new Error("Product/price/SKU identity changed");
  const catalogPath = `${dir}/catalog-${old.blueprint_id}-${old.print_provider_id}.json`;
  let catalog;
  try { catalog = JSON.parse(await readFile(catalogPath)); }
  catch (e) { if (e.code !== "ENOENT") throw e; catalog = await api(`catalog/blueprints/${old.blueprint_id}/print_providers/${old.print_provider_id}/variants.json`); await saveJson(catalogPath, catalog); }
  if (mode === "inspect") {
    console.log(JSON.stringify({ sku: item.sku, id, templates: [...new Set(old.variants.filter(v => v.is_enabled).map(v => {
      const p = catalog.variants.find(c => c.id === v.id)?.placeholders.find(p => p.position === "front");
      if (!p) throw new Error("Actual front print area missing");
      return `${p.width}x${p.height}`;
    }))] }));
    continue;
  }
  let record = journal.products[item.sku];
  if (mode === "prepare" && (!record?.prepared || process.argv.includes("--reprepare"))) {
    if (current.is_locked) throw new Error("Native publication still pending");
    const masters = JSON.parse(await readFile(`${dir}/masters.json`));
    const master = masters[item.family];
    if (!master) throw new Error("Approved family master missing");
    const bytes = await readFile(master.file), hash = createHash("sha256").update(bytes).digest("hex");
    let image = journal.uploads[hash];
    if (!image) {
      image = await write("uploads/images.json", "POST", {
        file_name: `sless-large-chest-${item.family}-${hash.slice(0, 12)}.png`, contents: bytes.toString("base64"),
      }, { kind: "large_master_upload", hash });
      if (!image.id || image.width !== master.width || image.height !== master.height) throw new Error("Master dimensions changed");
      journal.uploads[hash] = { id: image.id, width: image.width, height: image.height };
      delete journal.pendingWrite; await save();
    }
    const enabled = current.variants.filter(v => v.is_enabled), ids = new Set(enabled.map(v => v.id));
    const areas = current.print_areas.map(a => ({
      variant_ids: a.variant_ids.filter(id => !ids.has(id)),
      placeholders: a.placeholders.filter(p => p.images.length).map(p => ({
        position: p.position, decoration_method: p.decoration_method,
        images: p.images.map(i => ({ id: i.id, x: i.x, y: i.y, scale: i.scale, angle: i.angle })),
      })),
    })).filter(a => a.variant_ids.length);
    const groups = new Map(), sizes = [];
    for (const v of enabled) {
      const front = catalog.variants.find(c => c.id === v.id)?.placeholders.find(p => p.position === "front");
      if (!front) throw new Error("Enabled variant front missing");
      const width = Math.min(3150, front.width * .92, (front.height - 340) * master.width / master.height);
      if (width < 1500) throw new Error("Print area too small for large graphic; inspect manually");
      const height = width * master.height / master.width;
      const key = JSON.stringify([front.width, front.height, width, front.decoration_method]);
      if (!groups.has(key)) groups.set(key, { variant_ids: [], placeholders: [{
        position: "front", decoration_method: front.decoration_method,
        images: [{ id: image.id, x: .5, y: (220 + height / 2) / front.height, scale: width / front.width, angle: 0 }],
      }] });
      groups.get(key).variant_ids.push(v.id);
      sizes.push({ id: v.id, title: v.title, widthInches: Number((width / 300).toFixed(2)), templateWidth: front.width, templateHeight: front.height });
    }
    areas.push(...groups.values());
    await write(`shops/${shop}/products/${id}.json`, "PUT", { print_areas: areas }, { kind: "actual_front_enlargement", sku: item.sku, id });
    journal.products[item.sku] = record = { id, prepared: true, imageId: image.id, sizes, areas };
    delete journal.pendingWrite; await save();
    current = await api(`shops/${shop}/products/${id}.json`);
    if (signature(current) !== signature(old)) throw new Error("Prices/options changed");
    record.mockups = current.images;
    const op = operations.products[item.sku];
    op.expectedImages = [image.id]; op.areas = areas; op.mockups = current.images; op.printSizing = "large-front";
    await saveJson(operationsPath, operations); await save();
    console.log(JSON.stringify({ sku: item.sku, enlarged: true, rangeInches: [Math.min(...sizes.map(v => v.widthInches)), Math.max(...sizes.map(v => v.widthInches))] }));
  }
  if (mode === "publish" && !record?.publishRequestedAt) {
    if (!record?.prepared || current.is_locked) throw new Error("Enlargement not ready for publication");
    record.publishRequestedAt = new Date().toISOString(); await save();
    await write(`shops/${shop}/products/${id}/publish.json`, "POST", {
      title: false, description: false, images: true, variants: false, tags: false, shipping_template: false,
    }, { kind: "large_front_native_publication", sku: item.sku, id });
    delete journal.pendingWrite; record.publishAccepted = true; await save();
    console.log(JSON.stringify({ sku: item.sku, publishAccepted: true }));
  }
  if (mode === "verify") {
    if (!record?.prepared) throw new Error("Missing calibrated print");
    for (const size of record.sizes) {
      const image = current.print_areas.find(a => a.variant_ids.includes(size.id))?.placeholders
        .find(p => p.position === "front")?.images.find(i => i.id === record.imageId);
      if (!image || Math.abs(image.scale * size.templateWidth / 300 - size.widthInches) > .02 ||
          Math.abs(image.x - .5) > .001) throw new Error("Physical print width not verified: " + item.sku);
    }
    console.log(JSON.stringify({ sku: item.sku, physicalPrintVerified: true, variants: record.sizes.length, locked: current.is_locked }));
  }
  if (mode === "status" || mode === "verify") {
    record.locked = current.is_locked; record.mockups = current.images;
    operations.products[item.sku].locked = current.is_locked;
    operations.products[item.sku].mockups = current.images;
    await saveJson(operationsPath, operations); await save();
    console.log(JSON.stringify({ sku: item.sku, locked: current.is_locked }));
  }
}
