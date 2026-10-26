<?php
/**
 * Plugin Name: Sless Tracking Connection Hold
 * Description: Allows account setup while visitor tracking and Meta catalog sync remain on hold.
 * Version: 1.4.0
 */

defined('ABSPATH') || exit;

add_filter('option_sless_marketing_tracking_hold', function ($held) {
    if ($held) return $held;
    $plugins = (array) get_option('active_plugins', array());
    $options = (array) get_option('cmplz_options', array());
    // Never release tags if their consent safeguards have been disabled.
    return !file_exists(WPMU_PLUGIN_DIR . '/sless-marketing-consent.php')
        || !in_array('complianz-gdpr/complianz-gpdr.php', $plugins, true)
        || !in_array('wp-consent-api/wp-consent-api.php', $plugins, true)
        || !get_option('cmplz_wizard_completed_once')
        || ($options['enable_cookie_banner'] ?? '') !== 'yes'
        || ($options['enable_cookie_blocker'] ?? '') !== 'yes'
        || get_post_status((int) get_option('wp_page_for_privacy_policy')) !== 'publish';
}, PHP_INT_MAX);

/**
 * Account authorization is separate from permission to start visitor tracking.
 * Release this hold only after consent controls and event configuration are ready.
 */
function sless_hold_google_tracking_snippets($settings) {
    if (!get_option('sless_marketing_tracking_hold', true) || !is_array($settings)) {
        return $settings;
    }
    $settings['useSnippet'] = false;
    return $settings;
}

foreach (array(
    'googlesitekit_analytics-4_settings',
    'googlesitekit_ads_settings',
    'googlesitekit_tagmanager_settings',
) as $option) {
    add_filter('option_' . $option, 'sless_hold_google_tracking_snippets', PHP_INT_MAX);
    add_filter('pre_update_option_' . $option, 'sless_hold_google_tracking_snippets', PHP_INT_MAX);
}

function sless_hold_meta_pixel($enabled) {
    return get_option('sless_marketing_tracking_hold', true) ? false : $enabled;
}

function sless_hold_google_commerce_tracking($disabled) {
    return get_option('sless_marketing_tracking_hold', true) ? true : $disabled;
}

add_filter('woocommerce_gla_disable_gtag_tracking', 'sless_hold_google_commerce_tracking', PHP_INT_MAX);

function sless_hold_meta_sync_option($enabled) {
    return get_option('sless_marketing_tracking_hold', true) ? 'no' : $enabled;
}

function sless_hold_meta_legacy_settings($settings) {
    if (get_option('sless_marketing_tracking_hold', true) && is_array($settings)) {
        $settings['wc_facebook_enable_product_sync'] = 'no';
        $settings['enable_advanced_matching'] = 'no';
        $settings['use_s2s'] = 'no';
    }
    return $settings;
}

function sless_hold_meta_rollout_switches($switches) {
    if (get_option('sless_marketing_tracking_hold', true) && is_array($switches) && $switches) {
        // The newer all-products rollout bypasses the normal global sync setting.
        $switches['woo_all_products_sync_enabled'] = 'no';
    }
    return $switches;
}

add_filter('facebook_for_woocommerce_integration_pixel_enabled', 'sless_hold_meta_pixel', PHP_INT_MAX);
add_filter('wc_facebook_is_product_sync_enabled', 'sless_hold_meta_pixel', PHP_INT_MAX);
add_filter('option_wc_facebook_for_woocommerce_rollout_switches', 'sless_hold_meta_rollout_switches', PHP_INT_MAX);
add_filter('option_wc_facebook_enable_product_sync', 'sless_hold_meta_sync_option', PHP_INT_MAX);
add_filter('pre_update_option_wc_facebook_enable_product_sync', 'sless_hold_meta_sync_option', PHP_INT_MAX);
add_filter('option_woocommerce_facebookcommerce_settings', 'sless_hold_meta_legacy_settings', PHP_INT_MAX);
add_filter('pre_update_option_woocommerce_facebookcommerce_settings', 'sless_hold_meta_legacy_settings', PHP_INT_MAX);
