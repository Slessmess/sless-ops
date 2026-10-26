import { writeFile } from "node:fs/promises";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";

// Explicit owner-authorized launch only. Never changes merchant keys, submits
// payments, creates orders, or touches unrelated content.
const apply = process.argv.includes("--apply");
const result = await sitegroundWordpress(`
$s=get_option('woocommerce_stripe_settings',array());
$get=function($path)use($s){
  $r=wp_remote_get('https://api.stripe.com/v1/'.$path,array(
    'headers'=>array('Authorization'=>'Bearer '.($s['secret_key']??'')),
    'timeout'=>25));
  if(is_wp_error($r)||wp_remote_retrieve_response_code($r)!==200)return null;
  return json_decode(wp_remote_retrieve_body($r),true);
};
$a=$get('account');$b=$get('balance');$hooks=$get('webhook_endpoints?limit=100');
$hookReady=false;
foreach(($hooks['data']??array())as $h){
  if($h['url']===WC_Stripe_Helper::get_webhook_url()&&
    $h['status']==='enabled'&&!empty($h['livemode'])&&
    (in_array('*',$h['enabled_events'],true)||
     in_array('payment_intent.succeeded',$h['enabled_events'],true))){
    $hookReady=true;
  }
}
$ready=!empty($a['charges_enabled'])&&!empty($a['payouts_enabled'])&&
  !empty($b['livemode'])&&$hookReady&&
  strpos($s['publishable_key']??'','pk_live_')===0&&
  strpos($s['webhook_secret']??'','whsec_')===0&&
  ($s['enabled']??'')==='yes'&&
  function_exists('sless_core_us_only_is_restricted_product');
$before=array('testMode'=>$s['testmode']??null,
  'comingSoon'=>get_option('woocommerce_coming_soon'));
if(${apply ? "true" : "false"}&&$ready){
  $s['testmode']='no';
  WC_Stripe_Helper::update_main_stripe_settings($s);
  WC_Stripe::get_instance()->connect->clear_caches_after_key_update();
  update_option('woocommerce_coming_soon','no');
  if(function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();
}
$after=get_option('woocommerce_stripe_settings',array());
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array(
  'ready'=>$ready,'chargesEnabled'=>$a['charges_enabled']??false,
  'payoutsEnabled'=>$a['payouts_enabled']??false,
  'liveWebhookEnabled'=>$hookReady,
  'webhookSigningSecretConfigured'=>strpos($s['webhook_secret']??'','whsec_')===0,
  'before'=>$before,'stripeTestMode'=>$after['testmode']??null,
  'comingSoon'=>get_option('woocommerce_coming_soon'),
  'merchantKeysChanged'=>false,'ordersOrChargesCreated'=>false));
`);
const report = { checkedAt: new Date().toISOString(), applied: apply, ...result };
console.log(JSON.stringify(report, null, 2));
if (!result.ready) throw new Error("Launch readiness check failed; store settings unchanged");
if (apply) {
  if (result.stripeTestMode !== "no" || result.comingSoon !== "no") {
    throw new Error("Launch settings did not persist; reconcile before retrying");
  }
  await writeFile("wordpress/sless-refresh/merchandise-store-launch.json", `${JSON.stringify(report, null, 2)}\n`);
}
