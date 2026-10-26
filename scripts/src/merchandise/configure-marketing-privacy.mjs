import { readFile } from "node:fs/promises";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

const integration = await readFile("wordpress/sless-refresh/marketing-consent.php", "utf8");
const policy = await readFile("wordpress/sless-refresh/privacy-policy.html", "utf8");

const result = await sitegroundWordpress(String.raw`
wp_set_current_user(1);
if (!current_user_can('manage_options')) throw new Exception('Administrator context unavailable');
$payload=json_decode(stream_get_contents(STDIN),true);
token_get_all($payload['integration'],TOKEN_PARSE);
$path=WPMU_PLUGIN_DIR.'/sless-marketing-consent.php';
if (file_exists($path) && strpos(file_get_contents($path),'Plugin Name: Sless Marketing Consent Integration')===false) throw new Exception('Unexpected existing integration');
if (file_put_contents($path,$payload['integration'])!==strlen($payload['integration'])) throw new Exception('Integration write failed');
update_option('sless_meta_catalog_sync_hold',true,false);
update_option('gla_ads_enhanced_conversions_enabled',false,false);

$from=get_option('woocommerce_email_from_address');
if (!is_email($from) || !preg_match('/@slessismore\.org$/i',$from)) {
    $from=apply_filters('wp_mail_from',get_option('admin_email'));
}
$contactAvailable=is_email($from) && preg_match('/@slessismore\.org$/i',$from) && !preg_match('/^(wordpress|no-?reply)@/i',$from);
$policyId=(int)get_option('wp_page_for_privacy_policy');
$old=get_post($policyId);
if (!$old || ($old->post_status!=='draft' && strpos($old->post_content,'This notice explains how Sless Is More handles information on')===false)) throw new Exception('Expected draft or owned privacy policy');
$policyPublished=false;
if ($contactAvailable) {
    $content=str_replace('{{CONTACT_EMAIL}}',esc_attr($from),$payload['policy']);
    if (strpos($content,'{{')!==false) throw new Exception('Unresolved policy placeholder');
    $updated=wp_update_post(array('ID'=>$policyId,'post_content'=>wp_slash($content),'post_status'=>'publish','post_name'=>'privacy-policy'),true);
    if (is_wp_error($updated)) throw new Exception('Privacy page update failed');
    $policyPublished=true;
}

$options=(array)get_option('cmplz_options',array());
$options=array_merge($options,array(
    'regions'=>'eu',
    'eu_consent_regions'=>'yes',
    'country_company'=>'US',
    'organisation_name'=>'Sless Is More',
    'enable_cookie_banner'=>'yes',
    'enable_cookie_blocker'=>'yes',
    'uses_cookies'=>'yes',
    'cookie_banner_required'=>true,
    'compile_statistics'=>'google-analytics',
    'configuration_by_complianz'=>'no',
    'uses_ad_cookies'=>'yes',
    'uses_ad_cookies_personalized'=>'yes',
    'uses_thirdparty_services'=>'yes',
    'socialmedia_on_site'=>array('facebook'),
    'privacy-statement'=>'custom',
    'cookie-statement'=>'custom',
    'privacy-statement_custom_page'=>$policyId,
    'cookie-statement_custom_page'=>$policyId,
    'respect_dnt'=>'yes',
    'use_cdb_api'=>'no',
    'consent-mode'=>'no',
    'cookie_expiry'=>180,
    'use_country'=>false
));
update_option('cmplz_options',$options);
update_option('cmplz_privacy-statement_custom_page',$policyId);
update_option('cmplz_cookie-statement_custom_page',$policyId);
cmplz_install_cookiebanner_table();
$id=cmplz_get_default_banner_id();
$banner=new CMPLZ_COOKIEBANNER($id?:false);
$banner->default=true;
$banner->title='Sless Is More privacy choices';
$banner->header='Your privacy choices';
$banner->accept='Accept all';
$banner->dismiss='Reject optional';
$banner->view_preferences='Choose cookies';
$banner->save_preferences='Save choices';
$banner->revoke='Cookie settings';
$banner->message_optin='We use necessary cookies to run the store. With your permission, Google Analytics measures visits, and Google Ads and Meta measure sales and help us show relevant ads. You can reject optional cookies and still browse and buy.';
$banner->category_functional='Necessary';
$banner->category_stats='Statistics';
$banner->category_all='Marketing';
$banner->functional_text='Required for cart, checkout, security and remembering your privacy choices.';
$banner->statistics_text='Google Analytics measures visits and site interactions only if you allow it.';
$banner->marketing_text='Google Ads and Meta measure advertising results and build remarketing audiences only if you allow them.';
$banner->use_categories='view-preferences';
$banner->disable_cookiebanner=false;
$banner->soft_cookiewall=false;
$banner->dismiss_on_scroll=false;
$banner->dismiss_on_timeout=false;
$banner->position='bottom';
$banner->colorpalette_background=array('color'=>'#ffffff','border'=>'#dddddd');
$banner->colorpalette_text=array('color'=>'#171717','hyperlink'=>'#134d9e');
$button=array('background'=>'#171717','border'=>'#171717','text'=>'#ffffff');
$banner->colorpalette_button_accept=$button;
$banner->colorpalette_button_deny=$button;
$banner->colorpalette_button_settings=array('background'=>'#ffffff','border'=>'#171717','text'=>'#171717');
$banner->save();
update_option('cmplz_wizard_completed_once',true,false);
$settings=(array)get_option('googlesitekit_analytics-4_settings',array());
$settings['adsLinked']=true;
update_option('googlesitekit_analytics-4_settings',$settings);

echo 'SLESS_SAFE_JSON:'.wp_json_encode(array(
    'privacyPolicyPublished'=>$policyPublished,
    'businessContactAvailable'=>(bool)$contactAvailable,
    'privacyPolicyUrl'=>$policyPublished?get_permalink($policyId):null,
    'bannerId'=>$banner->ID,
    'cookieBannerEnabled'=>cmplz_get_option('enable_cookie_banner'),
    'cookieBlockerEnabled'=>cmplz_get_option('enable_cookie_blocker'),
    'trackingHold'=>(bool)get_option('sless_marketing_tracking_hold'),
    'ga4AdsLinked'=>(bool)$settings['adsLinked']
));
`, { input: JSON.stringify({ integration, policy }), timeoutMs: 110_000 });

await saveJson("wordpress/sless-refresh/privacy-configuration-status.json", {
  checkedAt: new Date().toISOString(), ...result,
});
console.log(JSON.stringify(result, null, 2));
