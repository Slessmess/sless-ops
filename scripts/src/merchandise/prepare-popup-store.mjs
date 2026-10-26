/**
 * Read-only preparation for a branded Printify Pop-Up store.
 * No products, DNS records, checkout routes, orders, or payments are written.
 */
import { createHash } from "node:crypto";
import { api, saveJson } from "./printify-api.mjs";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";

if (process.argv.includes("--apply")) throw new Error("Preparation only; no remote writes supported");
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const [shops, site] = await Promise.all([
  api("shops.json"),
  sitegroundWordpress(`
$rows=array();foreach(wc_get_products(array('status'=>'publish','limit'=>-1))as$p){
 $variants=array();foreach($p->get_children()as$id){$v=wc_get_product($id);if(!$v)continue;
 $variants[]=array('id'=>$id,'sku'=>$v->get_sku(),'price'=>$v->get_price(),
 'regularPrice'=>$v->get_regular_price(),'salePrice'=>$v->get_sale_price(),
 'saleEnd'=>$v->get_date_on_sale_to()?$v->get_date_on_sale_to()->date('c'):null);}
 $rows[]=array('id'=>$p->get_id(),'title'=>$p->get_name(),'url'=>$p->get_permalink(),
 'virtual'=>$p->is_virtual(),'downloadable'=>$p->is_downloadable(),'variants'=>$variants);}
$links=array(array('label'=>'Back to main website','url'=>home_url('/')));
foreach(array('wrestling'=>'Wrestling','ai'=>'SlessBox AI','giveaway'=>'Giveaway')as$slug=>$label){
 $p=get_page_by_path($slug);if($p&&$p->post_status==='publish')$links[]=array('label'=>$label,'url'=>get_permalink($p));}
$logo=function_exists('sm_logo_url')?sm_logo_url():wp_get_attachment_image_url(get_theme_mod('custom_logo'),'full');
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('home'=>home_url('/'),'logo'=>$logo?:null,'navigation'=>$links,'products'=>$rows));`),
]);
const sources = shops.filter(shop => shop.sales_channel === "woocommerce");
if (sources.length !== 1) throw new Error("Ambiguous WooCommerce source; preparation stopped");
const source = sources[0];
let products = [];
for (let page = 1;; page++) {
  const result = await api(`shops/${source.id}/products.json?limit=50&page=${page}`);
  products.push(...result.data);
  if (products.length >= result.total) break;
  if (!result.data.length) throw new Error("Incomplete source catalog");
}
const coreTitles = ["NO INTRODUCTION NEEDED", "STAY UNDENIABLE", "BUILT DIFFERENT. PROVEN DAILY."];
const excluded = [];
const items = [];
for (const product of products) {
  const woo = site.products.find(row => String(row.id) === String(product.external?.id));
  if (!product.visible || !woo || woo.virtual || woo.downloadable) {
    excluded.push({ id: product.id, title: product.title, reason: "Not a live, mapped physical product" });
    continue;
  }
  const enabled = product.variants.filter(variant => variant.is_enabled);
  if (!enabled.length) throw new Error(`No enabled variants: ${product.id}`);
  const prices = enabled.map(variant => {
    const match = woo.variants.filter(v => v.sku === variant.sku);
    if (match.length !== 1) throw new Error(`Cannot uniquely match enabled variant: ${product.id}/${variant.id}`);
    const row = match[0];
    const currentPrice = Math.round(Number(row.price) * 100);
    if (!Number.isSafeInteger(currentPrice) || currentPrice <= 0)
      throw new Error("Invalid storefront price");
    return {
      sourceVariantId: variant.id, sku: variant.sku,
      supplierRetailCents: variant.price, websiteCurrentCents: currentPrice,
      websiteRegularCents: Math.round(Number(row.regularPrice) * 100),
      websiteSaleEnd: row.saleEnd,
    };
  });
  items.push({
    sourceProductId: product.id, wooProductId: woo.id, title: woo.title,
    currentWebsiteUrl: woo.url, sourceLocked: product.is_locked === true,
    sourceArtworkAndVariantsSha256: digest({
      blueprint: product.blueprint_id, provider: product.print_provider_id,
      printAreas: product.print_areas, variants: product.variants,
    }),
    enabledVariants: prices,
    specialReview: [
      ...(coreTitles.includes(product.title) ? ["US-only shipping rule must be reproduced or item withheld"] : []),
      ...(prices.some(p => p.websiteCurrentCents !== p.supplierRetailCents)
        ? ["WooCommerce-only pricing/discount does not automatically transfer; review expiry before publication"] : []),
      ...(product.is_locked ? ["Source currently locked; do not recopy before reconciling"] : []),
    ],
    destinationProductId: null, destinationUrl: null, publishedToPopup: false,
  });
}
const unmatchedPhysical = site.products.filter(row => !row.virtual && !row.downloadable &&
  !items.some(item => item.wooProductId === row.id));
if (unmatchedPhysical.length) throw new Error("Live physical items remain unmapped; do not claim complete catalog");
const plan = {
  preparedAt: new Date().toISOString(), status: "awaiting_owner_popup_creation",
  sourceShopId: source.id, sourceSalesChannel: source.sales_channel,
  observedShops: shops.map(s => ({ id: s.id, title: s.title, salesChannel: s.sales_channel })),
  proposedHostname: "shop.slessismore.org", hostnameConnected: false,
  destinationShopId: null, destinationVerified: false,
  branding: {
    name: "Sless Is More", logo: site.logo,
    background: "#0a0a0a", panels: "#141410", accent: "#ffd700",
    text: "#f6f3eb", mutedText: "#b8b5ad", displayFontPreference: "Anton",
    note: "Use native builder options; exact layout/font availability needs owner preview approval.",
  },
  returnNavigation: site.navigation,
  catalog: items, excluded,
  gates: [
    "Owner creates an empty Pop-Up store in Printify and confirms its actual URL.",
    "Owner completes native identity/bank verification without sharing those details in chat.",
    "Copy approved live products as drafts; exclude unpublished proof. Do not alter source artwork.",
    "Review variant mappings, print geometry, mockups, current discounts and shipping restrictions.",
    "Match branding and publish header links back to the existing website.",
    "Verify mobile navigation and a supported return path after checkout; no automatic redirect promised.",
    "Obtain actual DNS records from Printify for the proposed shop subdomain; preserve root website/mail records.",
    "Review checkout, tracking/consent, tax and return policies before owner-approved cutover.",
    "Any real test payment or production submission needs separate explicit approval.",
  ],
  websiteChanged: false, dnsChanged: false, sourceProductsChanged: false,
  existingOrdersChanged: false, paymentsRetried: false, publicCutoverPerformed: false,
};
await saveJson("wordpress/sless-refresh/printify-popup-preparation.json", plan);
console.log(JSON.stringify({
  prepared: true, liveProductsMapped: items.length, unpublishedProductsExcluded: excluded.length,
  saleOrPriceReviewItems: items.filter(i => i.enabledVariants.some(p => p.websiteCurrentCents !== p.supplierRetailCents)).length,
  shippingReviewItems: items.filter(i => i.specialReview.some(x => x.startsWith("US-only"))).length,
  returnNavigationLinks: site.navigation.length, sourceChanged: false, publicCutoverPerformed: false,
}));
