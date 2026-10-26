/** Keep the three core shirts US-only; let Printify quote other products abroad.
 * Does not open the storefront, change payments, or create orders.
 */
import { resolve } from "node:path";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { directory, saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--apply")) throw new Error("Explicit --apply required");
const result = await sitegroundWordpress(`
$before=array(
  'allowed'=>get_option('woocommerce_allowed_countries'),
  'shipping'=>get_option('woocommerce_ship_to_countries'),
  'allowedSpecific'=>get_option('woocommerce_specific_allowed_countries',array()),
  'shippingSpecific'=>get_option('woocommerce_specific_ship_to_countries',array())
);
if(get_option('woocommerce_coming_soon')!=='yes' ||
   !function_exists('sless_core_us_only_is_restricted_product')){exit(52);}
$already=$before['allowed']==='all' && $before['shipping']==='';
if(!$already && !($before['allowed']==='specific' && $before['shipping']==='specific' &&
   $before['allowedSpecific']===array('US') && $before['shippingSpecific']===array('US'))){exit(53);}
if(!$already){
  update_option('woocommerce_allowed_countries','all');
  update_option('woocommerce_ship_to_countries','');
}
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array(
  'internationalEligibilityEnabled'=>get_option('woocommerce_allowed_countries')==='all' &&
    get_option('woocommerce_ship_to_countries')==='',
  'coreUsOnlyGuardLoaded'=>function_exists('sless_core_us_only_is_restricted_product'),
  'printifyQuotesStillDetermineDeliverability'=>true,
  'comingSoonStillEnabled'=>get_option('woocommerce_coming_soon')==='yes',
  'paymentSettingsChanged'=>false,'ordersCreated'=>false
)).PHP_EOL;
`);
if (!result.internationalEligibilityEnabled || !result.coreUsOnlyGuardLoaded || !result.comingSoonStillEnabled) {
  throw new Error("Destination update not verified; reconcile before any retry");
}
await saveJson(resolve(directory, "merchandise-destination-readiness.json"), {
  checkedAt: new Date().toISOString(), ...result,
});
console.log(JSON.stringify(result));
