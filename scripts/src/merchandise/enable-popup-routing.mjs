/** Owner-authorized partial cutover. Does not publish products or submit orders. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--accept-unpaid-only"))
  throw new Error("Explicit owner acceptance of unpaid-only testing required");
const path = "wordpress/sless-refresh";
const plan = JSON.parse(await readFile(`${path}/printify-popup-preparation.json`, "utf8"));
const receipts = JSON.parse(await readFile(`${path}/printify-popup-drafts.json`, "utf8"));
if (!plan.catalogCopy.ownerPreviewApproval || !plan.catalogCopy.partialLaunchApproved ||
    !plan.nativeReadinessReview.sellerReadinessConfirmed ||
    receipts.publicationVerification?.published !== 46 ||
    receipts.publicationVerification?.held !== 10)
  throw new Error("Readiness evidence incomplete");
const products = {};
for (const item of plan.catalog) {
  const receipt = receipts.products[item.sourceProductId];
  if (!item.publishedToPopup) continue;
  const url = new URL(item.destinationUrl);
  if (!receipt?.public || !receipt.verified || receipt.specialReview.length ||
      receipt.destinationUrl !== url.href || !Number.isInteger(item.wooProductId) ||
      url.origin !== "https://shop.slessismore.org" ||
      !/^\/product\/\d+$/.test(url.pathname) || url.search || url.hash)
    throw new Error("Unsafe or unapproved product mapping");
  products[item.wooProductId] = url.href;
}
if (Object.keys(products).length !== 46) throw new Error("Expected 46 unique mappings");
const source = await readFile("wordpress/sless-refresh/woocommerce-plugins/sless-popup-routing/sless-popup-routing.php");
const hash = createHash("sha256").update(source).digest("hex");
const acceptedAt = new Date().toISOString();
const approval = {
  acceptedAt, ownerAcceptedUnpaidOnly: true,
  scope: "Switch main-site merchandise links to the approved 46-product shop",
  actualPaymentVerified: false, completedOrderReturnVerified: false,
  finalShippingAndTaxVerified: false, noTransactionAuthorized: true,
};
const payload = Buffer.from(JSON.stringify({ products, approval })).toString("base64");
const result = await sitegroundWordpress(`
require_once ABSPATH.'wp-admin/includes/plugin.php';
$file=WP_PLUGIN_DIR.'/sless-popup-routing/sless-popup-routing.php';
if(!is_plugin_active('sless-popup-routing/sless-popup-routing.php')||hash_file('sha256',$file)!=='${hash}')throw new Exception('Staged plugin changed');
$prior=get_option('sless_popup_routing',array());
if(!empty($prior['enabled']))throw new Exception('Already enabled; reconcile instead of retrying');
$payload=json_decode(base64_decode('${payload}'),true);
foreach($payload['products'] as $id=>$url){
  if(!sless_popup_physical($id)||!sless_popup_safe_target($url))throw new Exception('Remote product mismatch');
}
global $wpdb;
$snapshot=function()use($wpdb){
  $data=array();
  foreach(array('wc_orders','wc_orders_meta','wc_order_addresses','wc_order_operational_data','woocommerce_order_items','woocommerce_order_itemmeta','woocommerce_sessions') as $suffix){
    $table=$wpdb->prefix.$suffix;
    if($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s',$wpdb->esc_like($table)))===$table){
      $rows=$wpdb->get_results("SELECT * FROM ".$table,ARRAY_A);$rows=array_map('serialize',$rows);sort($rows);
      $data[$suffix]=hash('sha256',serialize($rows));
    }
  }
  $data['content']=hash('sha256',serialize($wpdb->get_results("SELECT ID,post_status,post_content,post_title FROM ".$wpdb->posts." ORDER BY ID",ARRAY_A)));
  $data['pricesAndArtwork']=hash('sha256',serialize($wpdb->get_results("SELECT meta_id,post_id,meta_key,meta_value FROM ".$wpdb->postmeta." WHERE meta_key IN ('_price','_regular_price','_sale_price','_sale_price_dates_to','_thumbnail_id','_product_image_gallery') ORDER BY meta_id",ARRAY_A)));
  return $data;
};
$before=$snapshot();
$next=array_merge($prior,array('enabled'=>true,'brand_verified'=>true,'return_links_verified'=>true,'catalog_verified'=>true,'origin'=>'https://shop.slessismore.org','products'=>$payload['products'],'unpaid_only_acceptance'=>$payload['approval']));
if(!update_option('sless_popup_routing',$next,false)||!sless_popup_ready())throw new Exception('Cutover option not enabled');
$checks=array();
foreach(array('/ai/','/download/','/my-account/','/my-account/view-order/702/','/checkout-2/order-received/702/?key=private','/cart/','/wrestling/','/giveaway/') as $url){
  $checks[$url]=sless_popup_rewrite_url($url)===$url;
}
foreach($payload['products'] as $id=>$url){
  $checks['product_'.$id]=sless_popup_product_target($id)===$url;
}
$checks['shop']=sless_popup_rewrite_url('/shop/')==='https://shop.slessismore.org/';
$checks['tracking']=sless_popup_rewrite_url('/shop/?utm_source=cutover&key=private')==='https://shop.slessismore.org/?utm_source=cutover';
$after=$snapshot();
if(in_array(false,$checks,true)||$before!==$after){
  update_option('sless_popup_routing',$prior,false);
  throw new Exception('Preservation checks failed; cutover disabled');
}
if(function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('enabled'=>sless_popup_ready(),'mappedProducts'=>count($payload['products']),'checksPassed'=>count($checks),'ordersAndSessionsUnchanged'=>$before===$after,'contentPricesAndArtworkUnchanged'=>$before===$after,'cachePurgeAvailable'=>function_exists('sg_cachepress_purge_cache'),'pluginSha256'=>hash_file('sha256',$file)));
`);
await saveJson(`${path}/printify-popup-routing-live.json`, { ...result, approval, enabledAt: acceptedAt });
plan.status = "approved_46_products_live_main_site_routing_enabled";
plan.lastReviewedAt = acceptedAt;
plan.catalogCopy.nativeBrandingAndReturnNavigationCompleted = true;
plan.nativeReadinessReview.finalRoutingGate = "Owner explicitly accepted unpaid-only checks and authorized cutover. Actual payment, final shipping/tax and completed-order return remain unverified; no transaction authorized.";
plan.nativeReadinessReview.unpaidOnlyAcceptance = approval;
plan.mainSiteRouting = result;
receipts.pausedForReview = false;
receipts.pauseReason = null;
receipts.updatedAt = acceptedAt;
await saveJson(`${path}/printify-popup-preparation.json`, plan);
await saveJson(`${path}/printify-popup-drafts.json`, receipts);
console.log(JSON.stringify(result));
