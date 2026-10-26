/**
 * Explicit operator command. Copies core shirts into the connected Printify
 * WooCommerce shop. Never deletes originals, publishes products, or places orders.
 * node scripts/src/transfer-sless-core-shirts.mjs --check|--apply
 */
import { createHash } from "node:crypto";

const mode = process.argv[2];
if (!["--check", "--apply"].includes(mode)) {
  throw new Error("Use --check or --apply explicitly");
}
if (process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("This operator command must not run in deployment");
}
if (!process.env.PRINTIFY_API_TOKEN) throw new Error("Printify credentials missing");

const titles = [
  "NO INTRODUCTION NEEDED",
  "STAY UNDENIABLE",
  "BUILT DIFFERENT. PROVEN DAILY.",
];
const priceBySize = { S: 2500, M: 2500, L: 2500, XL: 2500, "2XL": 2800, "3XL": 3000 };
const digest = (data) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

async function api(path, method = "GET", body) {
  const response = await fetch(`https://api.printify.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Unconfirmed HTTP ${response.status}; inspect products before retrying`);
  }
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Printify rejected request: HTTP ${response.status}; ${JSON.stringify({
      code: result.code, message: result.message, errors: result.errors,
    })}`);
  }
  return result;
}

function cleanPrintAreas(product) {
  const enabledIds = new Set(product.variants.filter((v) => v.is_enabled).map((v) => v.id));
  return product.print_areas.map((area) => ({
    variant_ids: area.variant_ids.filter((id) => enabledIds.has(id)),
    placeholders: area.placeholders.filter((placeholder) => placeholder.images.length).map((placeholder) => ({
      position: placeholder.position,
      images: placeholder.images.map((image) => ({
        id: image.id, x: image.x, y: image.y, scale: image.scale, angle: image.angle,
        ...(image.pattern ? { pattern: image.pattern } : {}),
      })),
    })),
    ...(area.background ? { background: area.background } : {}),
  })).filter((area) => area.variant_ids.length && area.placeholders.length);
}

function normalizedLayout(areas) {
  return areas.flatMap((area) => area.variant_ids.map((id) => ({
    id,
    placeholders: [...area.placeholders].sort((a, b) => a.position.localeCompare(b.position)),
    ...(area.background ? { background: area.background } : {}),
  }))).sort((a, b) => a.id - b.id);
}

function validateCopiedProduct(product, original, expectedVariants, expectedAreas) {
  if (product.blueprint_id !== original.blueprint_id ||
      product.print_provider_id !== original.print_provider_id ||
      digest(normalizedLayout(cleanPrintAreas(product))) !== digest(normalizedLayout(expectedAreas))) {
    throw new Error(`Artwork/provider mismatch for ${original.title}; inspect before retrying`);
  }
  const expected = expectedVariants.filter((v) => v.is_enabled);
  const actual = product.variants.filter((v) => v.is_enabled);
  if (actual.length !== 6 ||
      expected.some((v) => !actual.some((a) => a.id === v.id && a.price === v.price))) {
    throw new Error(`Variant/price mismatch for ${original.title}; inspect before retrying`);
  }
  if (product.external?.id) throw new Error("Unexpected website linkage; inspect publication state");
}

async function main() {
  const shops = await api("shops.json");
  const sources = shops.filter((shop) => shop.sales_channel === "disconnected");
  const destinations = shops.filter((shop) => shop.sales_channel === "woocommerce");
  if (sources.length !== 1 || destinations.length !== 1) {
    throw new Error("Ambiguous source/destination shops; choose them explicitly before transfer");
  }
  const source = sources[0], destination = destinations[0];
  const [sourceList, destinationList] = await Promise.all([
    api(`shops/${source.id}/products.json?limit=20`),
    api(`shops/${destination.id}/products.json?limit=20`),
  ]);
  if (sourceList.total > 20 || destinationList.total > 20) {
    throw new Error("Pagination required before safely checking for duplicates");
  }
  const plans = [];
  for (const title of titles) {
    const originals = sourceList.data.filter((product) => product.title === title);
    const copies = destinationList.data.filter((product) => product.title === title);
    if (originals.length !== 1 || copies.length > 1) {
      throw new Error(`Ambiguous existing products for ${title}`);
    }
    const original = originals[0];
    const sizeOptions = original.options.find((option) => option.type === "size")?.values || [];
    const colorOptions = original.options.find((option) => option.type === "color")?.values || [];
    const enabled = original.variants.filter((variant) => variant.is_enabled);
    const sizes = enabled.map((variant) =>
      sizeOptions.find((option) => variant.options.includes(option.id))?.title);
    if (enabled.length !== 6 || new Set(sizes).size !== 6 ||
        sizes.some((size) => !(size in priceBySize)) ||
        enabled.some((variant) =>
          !colorOptions.some((color) => color.title === "White" && variant.options.includes(color.id)))) {
      throw new Error(`Unexpected core-shirt colors/sizes for ${title}`);
    }
    const variants = enabled.map((variant) => ({
      id: variant.id,
      price: variant.is_enabled
        ? priceBySize[sizeOptions.find((size) => variant.options.includes(size.id)).title]
        : variant.price,
      is_enabled: variant.is_enabled,
    }));
    const printAreas = cleanPrintAreas(original);
    if (copies[0]) validateCopiedProduct(copies[0], original, variants, printAreas);
    plans.push({ original, existing: copies[0], variants, printAreas });
  }
  console.log(JSON.stringify({
    mode, sourceCount: sourceList.total, destinationCount: destinationList.total,
    plannedProducts: plans.map(({ original, existing }) => ({
      title: original.title, action: existing ? "reuse_verified_draft" : "create_draft",
    })),
  }));
  for (const plan of plans) {
    if (mode === "--check") continue;
    const { original, existing, variants, printAreas } = plan;
    let copy = existing;
    if (!copy) {
      const created = await api(`shops/${destination.id}/products.json`, "POST", {
        title: original.title,
        description: original.description,
        blueprint_id: original.blueprint_id,
        print_provider_id: original.print_provider_id,
        variants,
        print_areas: printAreas,
        ...(original.safety_information ? { safety_information: original.safety_information } : {}),
      });
      copy = await api(`shops/${destination.id}/products/${created.id}.json`);
    }
    validateCopiedProduct(copy, original, variants, printAreas);
    console.log(JSON.stringify({
      title: copy.title, result: existing ? "verified_existing_draft" : "created_verified_draft",
      enabledSizes: 6, websitePublished: false,
      approvedPrices: { throughXL: 25, "2XL": 28, "3XL": 30 },
    }));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
