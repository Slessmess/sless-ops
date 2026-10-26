<?php
/**
 * Plugin Name: Sless Marketing Consent Integration
 * Description: Consent-first native Google and Meta tracking, with no server-side advertising matching.
 * Version: 1.1.0
 */
defined('ABSPATH') || exit;

function sless_has_marketing_consent() {
    return isset($_COOKIE['cmplz_marketing']) && $_COOKIE['cmplz_marketing'] === 'allow'
        && ($_SERVER['HTTP_SEC_GPC'] ?? '') !== '1'
        && ($_SERVER['HTTP_DNT'] ?? '') !== '1';
}

function sless_consent_filter_response_cookies() {
    if (sless_has_marketing_consent() || headers_sent()) return;
    $headers = headers_list();
    header_remove('Set-Cookie');
    foreach ($headers as $header) {
        if (stripos($header, 'Set-Cookie:') !== 0) continue;
        if (preg_match('/^Set-Cookie:\s*_(fbp|fbc)=/i', $header)) continue;
        header($header, false);
    }
}
// Meta's PHP attribution helper writes cookies even with CAPI disabled. Enforce
// consent at the response boundary, including normal, AJAX and REST requests.
if (function_exists('header_register_callback')) header_register_callback('sless_consent_filter_response_cookies');
add_action('send_headers', 'sless_consent_filter_response_cookies', PHP_INT_MAX);
add_action('wp_enqueue_scripts', function () {
    // This CAPI helper can create cookies independently of the blocked pixel.
    // Browser pixel tracking does not require it.
    wp_dequeue_script('facebook-capi-param-builder');
    wp_deregister_script('facebook-capi-param-builder');
}, PHP_INT_MAX);

// Keep the native browser-only Meta implementation. Server-side events and
// advanced matching require a separate, verified consent-aware implementation.
function sless_consent_browser_only_meta($settings) {
    if (is_array($settings)) {
        $settings['use_s2s'] = false;
        $settings['use_pii'] = false;
    }
    return $settings;
}
add_filter('option_facebook_config', 'sless_consent_browser_only_meta', PHP_INT_MAX);
add_filter('pre_update_option_facebook_config', 'sless_consent_browser_only_meta', PHP_INT_MAX);
add_filter('wc_facebook_is_advanced_matching_enabled', '__return_false', PHP_INT_MAX);

// A catalog is not an advertising-consent category. Keep sync separately held
// after the account-connection hold is released; never exclude/delete products.
function sless_consent_hold_catalog_option($enabled) {
    return get_option('sless_meta_catalog_sync_hold', true) ? 'no' : $enabled;
}
function sless_consent_hold_catalog_enabled($enabled) {
    return get_option('sless_meta_catalog_sync_hold', true) ? false : $enabled;
}
function sless_consent_hold_catalog_rollout($switches) {
    if (get_option('sless_meta_catalog_sync_hold', true) && is_array($switches) && $switches) {
        $switches['woo_all_products_sync_enabled'] = 'no';
    }
    return $switches;
}
add_filter('option_wc_facebook_enable_product_sync', 'sless_consent_hold_catalog_option', PHP_INT_MAX);
add_filter('wc_facebook_is_product_sync_enabled', 'sless_consent_hold_catalog_enabled', PHP_INT_MAX);
add_filter('option_wc_facebook_for_woocommerce_rollout_switches', 'sless_consent_hold_catalog_rollout', PHP_INT_MAX);

// Complianz must block the actual Site Kit snippets too, not whitelist them.
add_action('wp_loaded', function () {
    remove_filter('cmplz_whitelisted_script_tags', 'cmplz_google_site_kit_whitelisted_script_tags');
}, PHP_INT_MAX);

add_filter('cmplz_whitelisted_script_tags', function ($tags) {
    $tags[] = 'sless-consent-defaults';
    $tags[] = 'sless-consent-bridge';
    return $tags;
}, PHP_INT_MAX);

add_filter('cmplz_known_script_tags', function ($tags) {
    $analytics = array(
        'name' => 'sless-google-analytics',
        'category' => 'statistics',
        'urls' => array('G-RZLZGN6CRQ', 'GT-5DDBFXJL', 'googlesitekit-events-provider-woocommerce', 'googlesitekit-gtag-events'),
    );
    $ads = array(
        'name' => 'sless-google-ads',
        'category' => 'marketing',
        'urls' => array('AW-971817202', 'glaGtagData', 'gla-gtag-events', 'google-listings-and-ads/js/build/gtag-events', 'send_to: "GLA"', 'send_to:"GLA"'),
    );
    // More specific IDs must precede the blocker's generic Google URL match.
    return array_merge(array($ads, $analytics), $tags);
}, PHP_INT_MAX);

add_filter('cmplz_cookie_blocker_output', function ($html) {
    // Native consent integrations can whitelist a shared Google framework.
    // Apply destination-specific categories last, including GLA's group events.
    $html = preg_replace_callback('/<script\b([^>]*)>([\s\S]*?)<\/script>/i', function ($match) {
        $script = $match[0];
        if (strpos($match[1], 'sless-consent-') !== false
            || stripos($match[1], 'application/ld+json') !== false) return $script;
        $ads = strpos($script, 'AW-') !== false
            || strpos($script, 'glaGtagData') !== false
            || strpos($script, 'gla-gtag-events') !== false
            || strpos($script, 'google-listings-and-ads/js/build/gtag-events') !== false
            || preg_match('/send_to[^,}]*GLA/', $script);
        $meta = preg_match('/connect\.facebook\.net|fbq\s*\(/i', $script);
        $body = $match[2];
        if ($meta) {
            // Keep explicit WooCommerce events, not Meta's automatic button
            // classification (which otherwise includes consent controls).
            $body = preg_replace('/(?=\bfbq\s*\(\s*([\'"])init\1\s*,)/', "fbq('set','autoConfig',false,'910105715704651');", $body);
        }
        $stats = strpos($script, 'G-RZLZGN6CRQ') !== false
            || strpos($script, 'GT-5DDBFXJL') !== false
            || strpos($script, 'googletagmanager.com/gtag/') !== false
            || strpos($script, 'googlesitekit-events-provider-woocommerce') !== false
            || strpos($script, 'googlesitekit-gtag-events') !== false;
        if (!$ads && !$meta && !$stats) return $script;
        $attrs = $match[1];
        $attrs = preg_replace('/\s+(type|data-category|data-service)\s*=\s*(["\']).*?\2/i', '', $attrs);
        $attrs = preg_replace('/\s+src\s*=\s*(["\'])(.*?)\1/i', ' data-cmplz-src="$2"', $attrs);
        $category = ($ads || $meta) ? 'marketing' : 'statistics';
        $service = $meta ? 'facebook' : ($ads ? 'sless-google-ads' : 'sless-google-analytics');
        return '<script type="text/plain" data-category="' . $category . '" data-service="' . $service . '"' . $attrs . '>' . $body . '</script>';
    }, $html);
    // Without JavaScript there is no way to opt into an advertising pixel.
    return preg_replace_callback('/<noscript\b[^>]*>[\s\S]*?<\/noscript>/i', function ($match) {
        return stripos($match[0], 'facebook.com/tr') !== false ? '' : $match[0];
    }, $html);
}, PHP_INT_MAX);

add_action('template_redirect', function () {
    if (!function_exists('is_order_received_page') || !is_order_received_page()) return;
    $consented = sless_has_marketing_consent();
    if ($consented) return;
    // Native Ads marks an order tracked while rendering, before a JS blocker can
    // stop its script. Defer advertising purchase callbacks until consent so
    // declining never writes a false "conversion already sent" marker.
    global $wp_filter;
    foreach (array('woocommerce_before_thankyou', 'woocommerce_thankyou') as $hook) {
        if (!isset($wp_filter[$hook])) continue;
        foreach ($wp_filter[$hook]->callbacks as $priority => $callbacks) {
            foreach ($callbacks as $entry) {
                $callback = $entry['function'];
                if ($callback instanceof Closure) {
                    $bound = (new ReflectionFunction($callback))->getClosureThis();
                    if ($bound instanceof \Automattic\WooCommerce\GoogleListingsAndAds\Google\GlobalSiteTag) {
                        remove_action($hook, $callback, $priority);
                    }
                } elseif (is_array($callback) && is_object($callback[0])
                    && stripos(get_class($callback[0]), 'facebook') !== false
                    && stripos($callback[1], 'purchase') !== false) {
                    remove_action($hook, $callback, $priority);
                }
            }
        }
    }
}, 2);

// One first-party bridge owns the default Consent Mode signals worldwide.
// It does not load Google or Meta. Their native tags are released by Complianz.
add_filter('woocommerce_gla_gtag_consent', '__return_empty_string', PHP_INT_MAX);
add_action('wp_head', function () {
    if (is_admin()) return;
    ?>
<script id="sless-consent-defaults">
window.dataLayer=window.dataLayer||[];
window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'granted',security_storage:'granted'});
gtag('set','ads_data_redaction',true);
</script>
    <?php
}, -9999);

// Site Kit's WooCommerce provider supplies add_to_cart and purchase. Fill only
// the two missing funnel events, with an explicit GA4-only destination.
add_action('wp_footer', function () {
    if (get_option('sless_marketing_tracking_hold', true) || !function_exists('WC')) return;
    $settings = (array) get_option('googlesitekit_analytics-4_settings', array());
    $measurement = $settings['measurementID'] ?? '';
    if (!$measurement) return;
    $event = null;
    $items = array();
    $value = 0;
    if (is_product()) {
        $product = wc_get_product(get_queried_object_id());
        if (!$product) return;
        $value = (float) wc_get_price_to_display($product);
        $items[] = array('item_id' => (string) $product->get_id(), 'item_name' => $product->get_name(), 'price' => $value, 'quantity' => 1);
        $event = 'view_item';
    } elseif (is_checkout() && !is_order_received_page() && !is_wc_endpoint_url('order-pay') && WC()->cart && !WC()->cart->is_empty()) {
        foreach (WC()->cart->get_cart() as $line) {
            $product = $line['data'];
            $quantity = (int) $line['quantity'];
            if (!$product || !$quantity) continue;
            $total = (float) $line['line_total'];
            $value += $total;
            $items[] = array('item_id' => (string) $product->get_id(), 'item_name' => $product->get_name(), 'price' => $total / $quantity, 'quantity' => $quantity);
        }
        $event = 'begin_checkout';
    }
    if (!$event || !$items) return;
    $data = array('send_to' => $measurement, 'currency' => get_woocommerce_currency(), 'value' => $value, 'items' => $items);
    echo '<script id="sless-ga4-store-events">gtag("event",' . wp_json_encode($event) . ',' . wp_json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ');</script>';
}, 20);

add_action('wp_footer', function () {
    if (is_admin()) return;
    ?>
<script id="sless-consent-bridge">
(function(){
  var previous=null,scheduled=false;
  var receipt=<?php echo wp_json_encode(function_exists('is_order_received_page') && is_order_received_page()); ?>;
  function allowed(category){
    // The Consent API can default to allow before its consent type is defined.
    // Read only an explicit, saved opt-in, including before scripts are released.
    return document.cookie.split(';').some(function(c){return c.trim()==='cmplz_'+category+'=allow';});
  }
  function clearIdentifiers(stats,ads){
    var names=document.cookie.split(';').map(function(c){return c.split('=')[0].trim();});
    var domains=['',location.hostname,'.'+location.hostname,'.'+location.hostname.replace(/^www\./,'')];
    names.forEach(function(name){
      var analytics=/^(_ga($|_)|_gid$|_gat)/.test(name);
      var marketing=/^(_gcl_|_fbp$|_fbc$)/.test(name);
      if(!((analytics&&!stats)||(marketing&&!ads))) return;
      domains.forEach(function(domain){
        document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');
      });
    });
  }
  function update(){
    var stats=allowed('statistics'), ads=allowed('marketing');
    if(navigator.doNotTrack==='1'||window.doNotTrack==='1'){stats=false;ads=false;}
    if(navigator.globalPrivacyControl===true){ads=false;}
    window.gtag('consent','update',{analytics_storage:stats?'granted':'denied',ad_storage:ads?'granted':'denied',ad_user_data:ads?'granted':'denied',ad_personalization:ads?'granted':'denied'});
    if(typeof window.fbq==='function') window.fbq('consent',ads?'grant':'revoke');
    if(!stats||!ads) clearIdentifiers(stats,ads);
    var next={stats:stats,ads:ads};
    if(previous && ((previous.stats&&!stats)||(previous.ads&&!ads))&&!scheduled){
      scheduled=true;
      // Remove already-loaded optional scripts and event listeners on withdrawal.
      setTimeout(function(){location.reload();},50);
    }
    if(receipt && previous && !previous.ads && ads && !scheduled){
      scheduled=true;
      setTimeout(function(){location.reload();},50);
    }
    previous=next;
  }
  // Complianz releases a category before updating the WP Consent API. This
  // before-hook must grant Consent Mode first, not after the first event.
  ['cmplz_before_category','wp_listen_for_consent_change','cmplz_status_change','cmplz_enable_category','cmplz_event_marketing'].forEach(function(name){document.addEventListener(name,update);});
  document.addEventListener('click',function(event){
    var target=event.target.closest?event.target.closest('.cmplz-deny,.cmplz-save-preferences'):null;
    if(!target) return;
    var checked=document.querySelector('.cmplz-cookiebanner input.cmplz-marketing:checked');
    if(target.classList.contains('cmplz-deny')||!checked){
      // Revoke before the SDK's bubbling click listener can classify this click.
      if(typeof window.fbq==='function') window.fbq('consent','revoke');
      window.gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    }
  },true);
  document.addEventListener('DOMContentLoaded',update);
  update();
})();
</script>
    <?php
}, 99999);
