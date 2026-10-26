import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { api, directory, saveJson } from "./printify-api.mjs";
import { selectPrintPositions } from "./print-positions.mjs";

const assortment = JSON.parse(await readFile(resolve(directory, "merchandise-assortment.json"), "utf8"));
const allProviders = await api("catalog/print_providers.json");
const providerInfo = new Map(allProviders.map((provider) => [provider.id, provider]));
const preferredNames = ["Monster Digital", "SwiftPOD", "District Photo", "MWW On Demand", "SPOKE Custom Products", "Printed Mint", "Sensaria"];
const rank = (provider) => {
  const info = providerInfo.get(provider.id);
  const preferred = preferredNames.findIndex((name) => name.toLowerCase() === provider.title.toLowerCase());
  return (info?.location?.country === "US" ? 0 : 100) +
    (preferred >= 0 ? preferred : 30) + (/Printify Choice/i.test(provider.title) ? 200 : 0);
};

function selectVariants(product, variants) {
  let selected = variants.filter((variant) => variant.is_available !== false && variant.placeholders?.length);
  if (!selected.length) return [];
  const colors = product.category === "Headwear" || product.collection === "Halloween"
    ? ["Black", "White", "Natural"]
    : product.collection === "Thanksgiving"
      ? ["Natural", "Ivory", "Cream", "White", "Black"]
      : product.collection === "Christmas"
        ? ["White", "Natural", "Black"]
        : ["Black", "White", "Natural"];
  const colorKey = Object.keys(selected[0].options || {}).find((key) => /color/i.test(key));
  if (colorKey) {
    const color = colors.find((preferred) => selected.some((v) => v.options[colorKey] === preferred))
      || selected[0].options[colorKey];
    selected = selected.filter((v) => v.options[colorKey] === color);
  }
  if (product.category === "Apparel") {
    const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
    const sizeKey = Object.keys(selected[0].options || {}).find((key) => /size/i.test(key));
    const sized = sizeKey ? selected.filter((v) => sizes.includes(v.options[sizeKey])) : selected;
    return (sized.length ? sized : selected).slice(0, 7);
  }
  if (/Phone Cases/i.test(product.catalogTitle)) {
    const recent = selected.filter((v) => /iPhone\s*(18|17|16|15)(\D|$)/i.test(v.title));
    const choices = (recent.length ? recent : selected).sort((a, b) =>
      b.title.localeCompare(a.title, undefined, { numeric: true }));
    const models = new Set();
    return choices.filter((v) => {
      const model = Object.values(v.options).find((value) => /iPhone/i.test(value)) || v.title;
      if (models.has(model) || models.size >= 6) return false;
      models.add(model);
      return true;
    });
  }
  const preferred = selected.find((v) => /11oz|18[″"]?\s*[x×]\s*18|one size|20oz/i.test(v.title));
  return [preferred || selected[0]];
}

const products = [];
const failures = [];
let cursor = 0;
async function worker() {
  while (cursor < assortment.products.length) {
    const product = assortment.products[cursor++];
    try {
      const providers = (await api(`catalog/blueprints/${product.blueprintId}/print_providers.json`))
        .sort((a, b) => rank(a) - rank(b));
      let chosen;
      const providerErrors = [];
      for (const provider of providers) {
        try {
          const catalog = await api(`catalog/blueprints/${product.blueprintId}/print_providers/${provider.id}/variants.json`);
          const variants = selectVariants(product, catalog.variants || []);
          if (!variants.length) continue;
          const primary = variants.find((v) => Object.values(v.options || {}).includes("L")) || variants[0];
          const positions = selectPrintPositions(product, primary.placeholders);
          if (!positions.length || positions.some((p) => !(p.width > 0 && p.height > 0))) continue;
          chosen = {
            ...product,
            collection: product.collection || assortment.defaultCollection,
            listingTitle: product.listingTitle || `Sless Is More — ${product.catalogTitle}`,
            provider: {
              id: provider.id, title: provider.title,
              country: providerInfo.get(provider.id)?.location?.country || "unconfirmed",
            },
            variants,
            primaryVariantId: primary.id,
            positions,
            artworkStatus: "pending",
          };
          break;
        } catch (error) {
          providerErrors.push({ providerId: provider.id, reason: error.message });
        }
      }
      if (!chosen) throw new Error(`No compatible provider/print areas: ${JSON.stringify(providerErrors)}`);
      products.push(chosen);
      console.log(JSON.stringify({
        sku: product.sku, collection: chosen.collection, provider: chosen.provider.title,
        country: chosen.provider.country, variants: chosen.variants.length,
        positions: chosen.positions.map((p) => p.position),
      }));
    } catch (error) {
      failures.push({ sku: product.sku, title: product.catalogTitle, reason: error.message });
      console.log(JSON.stringify({ sku: product.sku, failed: true, reason: error.message }));
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
products.sort((a, b) => a.sku.localeCompare(b.sku));
await saveJson(resolve(directory, "merchandise-production-plan.json"), {
  status: failures.length ? "incomplete" : "providers_selected",
  products, failures,
  pricingPolicy: {
    status: "proposed_not_approved_for_publication",
    scope: "Fallback for products without a current verified consumer benchmark; benchmark-backed products use the dated retail benchmark and production/estimated-fee floor.",
    targetMargin: 0.40, paymentFeeAllowanceRate: 0.035, paymentFeeAllowanceCents: 50,
    shipping: "Separate customer charge, using verified Printify rates.",
    disclaimer: "Fee allowances are planning estimates, not verified Stripe fees. Taxes, destinations and actual margins need merchant review before publication.",
  },
});
console.log(`PLAN_COMPLETE products=${products.length} failures=${failures.length}`);
if (failures.length) process.exitCode = 1;
