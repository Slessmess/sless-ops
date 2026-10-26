/** Owner-approved WooCommerce-only sale; supplier artwork/prices are not written. */
import { readFile } from "node:fs/promises";
import { api, saveJson } from "./printify-api.mjs";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";

const mode = process.argv[2];
if (!["apply", "verify"].includes(mode) || !process.argv.includes("--apply") ||
    process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Workspace apply|verify --apply required");
const dir = "generated-artifacts/holiday-sale-2026-10-25";
const preflight = JSON.parse(await readFile(`${dir}/preflight.json`));
const ids = [238, 260, 314, 323, 330, 660, 735];
const reportPath = "wordpress/sless-refresh/holiday-sale-2026-10-25.json";
if (mode === "apply") {
  try { await readFile(reportPath); throw new Error("Sale already has a receipt; verify instead of reapplying"); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  const all = [];
  for (let page = 1;; page++) {
    const response = await api(`shops/29231820/products.json?limit=50&page=${page}`);
    all.push(...response.data);
    if (all.length >= response.total) break;
  }
  const margins = [];
  for (const p of preflight.products) {
    const supplier = all.find(s => Number(s.external?.id) === p.id);
    if (!supplier) throw new Error("Supplier mapping missing");
    for (const v of p.variants) {
      const quoted = supplier.variants.find(s => s.is_enabled && s.sku === v.sku);
      if (!quoted) throw new Error("Enabled supplier SKU missing");
      const sale = Math.round(Number(v.regular) * 80) / 100;
      const cost = quoted.cost / 100;
      // Conservative allowance only, not a claim about actual processor fees.
      if (sale * .965 - .50 <= cost) throw new Error("Sale would cross production/fee allowance floor");
      margins.push({ parentId: p.id, variantId: v.id, sale, productionCost: cost,
        grossProfitBeforeFeesAndShipping: Math.round((sale - cost) * 100) / 100 });
    }
  }
  await saveJson(`${dir}/cost-check.json`, margins);
  await saveJson(`${dir}/intent.json`, { ids, discountPercent: 20, endDate: "2026-10-25", timezone: "America/New_York", writeStartedAt: new Date().toISOString(), ordersCreated: false });
}
const php = await readFile("scripts/src/merchandise/holiday-sale.php", "utf8");
const result = await sitegroundWordpress(php.replace(/^<\?php\s*/, ""), {
  input: JSON.stringify({ mode, ids, discount: 20, endDate: "2026-10-25", products: preflight.products }),
  timeoutMs: 180_000,
});
if (result.products.length !== 7 || result.verifiedVariants !== 61 ||
    result.expiryEvent !== result.endTimestamp + 1) throw new Error("Sale verification incomplete");
await saveJson(reportPath, { ...result, checkedAt: new Date().toISOString(),
  authorization: "Owner approved 20% off all seven holiday tops through October 25, 2026 at 11:59 p.m. Eastern." });
console.log(JSON.stringify({ products: result.products.map(({ id, title, saleMin, saleMax }) =>
  ({ id, title, saleMin, saleMax })), verifiedVariants: result.verifiedVariants,
  endsAtEastern: result.endsAtEastern, expiryScheduled: true,
  regularPricesPreserved: result.regularPricesPreserved, nonholidayMerchandiseUnchanged: result.nonholidayMerchandiseUnchanged, ordersCreated: false }));
