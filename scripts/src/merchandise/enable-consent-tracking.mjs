import { readFile } from "node:fs/promises";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

const integration = await readFile("wordpress/sless-refresh/marketing-consent.php", "utf8");
const hold = await readFile("wordpress/sless-refresh/tracking-connection-hold.php", "utf8");

await sitegroundWordpress(String.raw`
$p=json_decode(stream_get_contents(STDIN),true);
update_option('sless_marketing_tracking_hold',true,false);
foreach(array('integration'=>'sless-marketing-consent.php','hold'=>'sless-tracking-connection-hold.php') as $key=>$name){
    token_get_all($p[$key],TOKEN_PARSE);
    $path=WPMU_PLUGIN_DIR.'/'.$name;
    if(!is_file($path)||strpos(file_get_contents($path),'Plugin Name: Sless')===false)throw new Exception('Owned integration missing');
    if(file_put_contents($path,$p[$key])!==strlen($p[$key]))throw new Exception('Integration update failed');
}
remove_filter('option_facebook_config','sless_consent_browser_only_meta',PHP_INT_MAX);
$fb=(array)get_option('facebook_config',array());
$fb['use_s2s']=false;$fb['use_pii']=false;
update_option('facebook_config',$fb);
$ga=(array)get_option('googlesitekit_analytics-4_settings',array());
$ga['useSnippet']=true;
remove_filter('pre_update_option_googlesitekit_analytics-4_settings','sless_hold_google_tracking_snippets',PHP_INT_MAX);
update_option('googlesitekit_analytics-4_settings',$ga);
update_option('googlesitekit_conversion_tracking',array('enabled'=>true));
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('integrationsUpdated'=>true));
`, { input: JSON.stringify({ integration, hold }), timeoutMs: 100_000 });

const preflight = await sitegroundWordpress(String.raw`
$samples=array(
'analytics'=>'<script id="google_gtagjs-js" src="https://www.googletagmanager.com/gtag/js?id=G-RZLZGN6CRQ"></script><script id="google_gtagjs-js-after">gtag("config","G-RZLZGN6CRQ");</script>',
'ads'=>'<script src="https://www.googletagmanager.com/gtag/js?id=AW-971817202"></script><script>gtag("config","AW-971817202");</script><script>gtag("event","view_item",{send_to: "GLA"});</script>',
'meta'=>'<script src="https://connect.facebook.net/en_US/fbevents.js"></script><script>fbq("init","910105715704651");</script>'
);
$checks=array();
foreach($samples as $name=>$sample){
    $html=COMPLIANZ::$cookie_blocker->replace_tags($sample);
    preg_match_all('/<script\b([^>]*)>/i',$html,$matches);
    $expected=$name==='analytics'?'statistics':'marketing';
    $blocked=true;
    foreach($matches[1] as $attrs){
        if(strpos($attrs,'type="text/plain"')===false||strpos($attrs,'data-category="'.$expected.'"')===false)$blocked=false;
    }
    $checks[$name]=array('blockedInCorrectCategory'=>$blocked,'scriptCount'=>count($matches[1]));
}
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('checks'=>$checks,'siteKitWhitelistRemoved'=>has_filter('cmplz_whitelisted_script_tags','cmplz_google_site_kit_whitelisted_script_tags')===false,'metaServerSideDisabled'=>!WC_Facebookcommerce_Pixel::get_use_s2s(),'metaAdvancedMatchingDisabled'=>!facebook_for_woocommerce()->get_integration()->is_advanced_matching_enabled(),'privacyPublished'=>get_post_status((int)get_option('wp_page_for_privacy_policy'))==='publish'));
`);
if (Object.values(preflight.checks).some(x => !x.blockedInCorrectCategory) ||
    !preflight.siteKitWhitelistRemoved || !preflight.metaServerSideDisabled ||
    !preflight.metaAdvancedMatchingDisabled || !preflight.privacyPublished) {
  console.log(JSON.stringify({ preflight }, null, 2));
  throw new Error("Consent preflight failed; tracking remains held");
}

const result = await sitegroundWordpress(String.raw`
update_option('sless_marketing_tracking_hold',false,false);
if(function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();
$checks=array();$safe=true;
foreach(array(home_url('/'),home_url('/product/sless-after-dark-halloween-tee/'),get_privacy_policy_url()) as $url){
    $response=wp_remote_get(add_query_arg('sless_consent_check',time(),$url),array('timeout'=>30));
    if(is_wp_error($response)){$safe=false;continue;}
    $html=wp_remote_retrieve_body($response);
    preg_match_all('/<script\b([^>]*)>([\s\S]*?)<\/script>/i',$html,$scripts,PREG_SET_ORDER);
    $tracking=array();$leaks=array();$optionalCookies=array();
    foreach(wp_remote_retrieve_cookies($response) as $cookie){
        if(preg_match('/^(_fbp|_fbc|_ga(?:_|$)|_gcl_)/',$cookie->name)&&strlen($cookie->value)>0)$optionalCookies[]=$cookie->name;
    }
    foreach($scripts as $script){
        if(preg_match('/id="sless-consent-(bridge|defaults)"/i',$script[1]))continue;
        if(preg_match('/googletagmanager\.com\/gtag|connect\.facebook\.net|fbq\s*\(|AW-971817202|G-RZLZGN6CRQ|GT-5DDBFXJL|glaGtagData|gla-gtag-events|googlesitekit-events-provider-woocommerce|send_to:\s*"GLA"/i',$script[0])){
            $blocked=strpos($script[1],'type="text/plain"')!==false;
            $tracking[]=array('attributes'=>$script[1],'blocked'=>$blocked);
            if(!$blocked)$leaks[]=$script[1];
        }
    }
    $status=wp_remote_retrieve_response_code($response);
    $banner=strpos($html,'cmplz-cookiebanner-1')!==false;
    $capiHelperEnqueued=strpos($html,'id="facebook-capi-param-builder-js"')!==false;
    if($status!==200||!$banner||$leaks||$optionalCookies||$capiHelperEnqueued)$safe=false;
    $checks[]=array('url'=>$url,'httpStatus'=>$status,'cookieBannerPresent'=>$banner,'trackingScripts'=>$tracking,'unblockedTrackingScripts'=>$leaks,'optionalResponseCookies'=>$optionalCookies,'capiHelperEnqueued'=>$capiHelperEnqueued);
}
if(!$safe){update_option('sless_marketing_tracking_hold',true,false);if(function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();}
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('safe'=>$safe,'checks'=>$checks,'trackingHold'=>(bool)get_option('sless_marketing_tracking_hold')));
`, { timeoutMs: 120_000 });

await saveJson("wordpress/sless-refresh/consent-tracking-verification.json", {
  checkedAt: new Date().toISOString(), preflight, ...result,
});
console.log(JSON.stringify({ preflight, ...result }, null, 2));
if (!result.safe || result.trackingHold) throw new Error("Public consent check failed; tracking was re-held");
