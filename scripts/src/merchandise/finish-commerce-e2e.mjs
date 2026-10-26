import { readFile, rm } from "node:fs/promises";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

const path = "wordpress/sless-refresh/commerce-e2e-verification.json";
const proof = JSON.parse(await readFile(path, "utf8"));
if (!proof.twoPaidSandboxOrders || proof.orders.length !== 2) throw new Error("Two verified sandbox orders required");
const cleanup = await sitegroundWordpress(String.raw`
$p=json_decode(stream_get_contents(STDIN),true);$config=get_option('sless_commerce_qa',array());
if(($config['batch']??'')!==$p['batch']||!WC_Stripe_Mode::is_live())throw new Exception('Batch or public mode changed');
$orders=array();foreach($p['ids'] as $id){$order=wc_get_order($id);
if(!$order||$order->get_meta('_sless_e2e_batch')!==$p['batch']||$order->get_meta('_sless_e2e_do_not_fulfill')!=='yes'||!$order->is_paid())throw new Exception('QA order mismatch');
$orders[]=$order;}
foreach(array('cancelled_order','customer_cancelled_order') as $type)add_filter('woocommerce_email_enabled_'.$type,function($enabled,$order)use($p){return is_a($order,'WC_Order')&&$order->get_meta('_sless_e2e_batch')===$p['batch']?false:$enabled;},9999,2);
$closed=array();foreach($orders as $order){$order->update_status('cancelled','Sandbox verification complete: no real funds, no supplier production. Retained as a clearly marked QA audit record.',true);$closed[]=array('id'=>$order->get_id(),'status'=>$order->get_status());}
delete_option('sless_commerce_qa');if(function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();
$b=new CMPLZ_COOKIEBANNER(1);
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('testAccessDisabled'=>get_option('sless_commerce_qa',false)===false,'publicStripeLive'=>WC_Stripe_Mode::is_live(),'fulfillmentExclusionRetained'=>is_file(WPMU_PLUGIN_DIR.'/sless-commerce-e2e-guard.php'),'mobileManageConsent'=>$b->manage_consent_options,'closedQaOrders'=>$closed));
`, { input: JSON.stringify({ batch: proof.batch, ids: proof.orders.map(x => x.id) }), timeoutMs: 120_000 });
await saveJson(path, {
  ...proof, completedEndToEndTests: 2, requestedEndToEndTests: 2,
  browserVerification: {
    order1068: { ga4Purchase: true, metaPurchase: true, googleAdsPurchase: true, transactionId: "1068", value: 25.35, currency: "USD" },
    order1069: { ga4Events: ["view_item", "add_to_cart", "begin_checkout", "purchase"], metaEvents: ["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"], googleAdsPurchase: true, transactionId: "1069", value: 42.59, currency: "USD" },
    noPurchaseEventsOnReceiptReload: true,
    adsEndpointObservation: "Matching requests observed on conversion, viewthroughconversion and 1p-conversion endpoint families; the primary conversion included the order ID. No repeat purchase-label request on reload. Endpoint fan-out is not itself proof of multiple counted conversions.",
    mobileConsentPreferencesReopenVerified: true,
  },
  cleanup,
  limits: ["SMTP acceptance is not proof of inbox delivery.", "Sandbox payments do not verify real payouts or physical production/shipment.", "Live ad-click attribution requires actual eligible ad traffic."],
});
await rm("/tmp/sless-commerce-e2e-access.json", { force: true });
console.log(JSON.stringify(cleanup));
