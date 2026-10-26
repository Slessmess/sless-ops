/** Read-only provider watcher: never retries publication or unlocks products. */
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { api, saveJson } from "./printify-api.mjs";

const path = "generated-artifacts/catalog-refresh/operations.json";
const end = Date.now() + 20 * 60_000;
let previous = -1;
while (Date.now() < end) {
  const log = JSON.parse(await readFile(path, "utf8"));
  const products = [];
  for (let page = 1;; page++) {
    const response = await api(`shops/${log.shop}/products.json?limit=50&page=${page}`);
    products.push(...response.data);
    if (products.length >= response.total) break;
    if (!response.data.length) throw new Error("Provider pagination incomplete");
  }
  let pending = 0;
  for (const record of Object.values(log.products)) {
    const product = products.find(p => p.id === record.id);
    if (!product) throw new Error("Expected provider product disappeared");
    record.locked = product.is_locked;
    record.externalId = product.external?.id;
    record.mockups = product.images;
    if (product.is_locked || !product.external?.id) pending++;
  }
  await saveJson(path, log);
  if (pending !== previous) {
    console.log(JSON.stringify({ nativeSyncPending: pending, complete: 51 - pending }));
    previous = pending;
  }
  if (!pending) {
    console.log("NATIVE_CATALOG_SYNC_COMPLETE");
    process.exit(0);
  }
  await setTimeout(30_000);
}
throw new Error("Native sync remains pending; inspect before any publication retry");
