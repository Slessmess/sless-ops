<?php
/**
 * Plugin Name: Sless Core Shirts — US-Only Shipping
 * Description: Blocks non-US checkout when one of the three original Sless shirts is in the cart.
 * Version: 1.0.0
 * Requires Plugins: woocommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Printify variant SKUs for the three original shirts.
 *
 * Keep the title check below as a fallback if a future Printify sync changes SKUs.
 */
function sless_core_us_only_shirt_skus() {
    return array(
        '16716862689921996657',
        '10944612758668298984',
        '12290160615202657793',
        '14912566418418260865',
        '30731496938985144248',
        '14188743641060046310',
        '25679255767681588387',
        '28449833285173856833',
        '32405252358938574960',
        '43006935802535782549',
        '12698058292659244940',
        '21942828049535213993',
        '15598442049397984126',
        '33910407245507145918',
        '16474063266772401984',
        '51736570057339669464',
        '92995273054212143236',
        '22810495442910952985',
    );
}

function sless_core_us_only_shirt_titles() {
    return array(
        'NO INTRODUCTION NEEDED',
        'STAY UNDENIABLE',
        'BUILT DIFFERENT. PROVEN DAILY.',
    );
}

function sless_core_us_only_is_restricted_product($product) {
    if (!is_object($product) || !method_exists($product, 'get_sku')) {
        return false;
    }

    if (in_array((string) $product->get_sku(), sless_core_us_only_shirt_skus(), true)) {
        return true;
    }

    if (!method_exists($product, 'get_parent_id') || !function_exists('wc_get_product')) {
        return false;
    }

    $parent_id = (int) $product->get_parent_id();
    if ($parent_id < 1) {
        return false;
    }

    $parent = wc_get_product($parent_id);
    return $parent && in_array((string) $parent->get_name(), sless_core_us_only_shirt_titles(), true);
}

function sless_core_us_only_cart_has_restricted_product($items) {
    if (!is_array($items)) {
        return false;
    }

    foreach ($items as $item) {
        if (isset($item['data']) && sless_core_us_only_is_restricted_product($item['data'])) {
            return true;
        }
    }

    return false;
}

function sless_core_us_only_is_international($country) {
    $country = strtoupper(trim((string) $country));
    return '' !== $country && 'US' !== $country;
}

/**
 * Remove all shipping rates from a package that contains a core shirt abroad.
 *
 * This runs after Printify's rate method and also catches mixed packages.
 */
function sless_core_us_only_filter_shipping_rates($rates, $package) {
    if (!is_array($rates) || !is_array($package) || empty($package['destination']['country'])) {
        return $rates;
    }

    if (
        sless_core_us_only_is_international($package['destination']['country']) &&
        sless_core_us_only_cart_has_restricted_product(isset($package['contents']) ? $package['contents'] : array())
    ) {
        return array();
    }

    return $rates;
}
add_filter('woocommerce_package_rates', 'sless_core_us_only_filter_shipping_rates', 1000, 2);

function sless_core_us_only_checkout_message() {
    return __(
        'The three original Sless shirts can only be shipped within the United States. Remove them to continue with this shipping address.',
        'sless-core-us-only-shipping'
    );
}

function sless_core_us_only_show_cart_notice() {
    if (!function_exists('WC') || !WC()->cart || !WC()->customer) {
        return;
    }

    $country = WC()->customer->get_shipping_country();
    if (
        !sless_core_us_only_is_international($country) ||
        !sless_core_us_only_cart_has_restricted_product(WC()->cart->get_cart())
    ) {
        return;
    }

    $message = sless_core_us_only_checkout_message();
    if (!function_exists('wc_has_notice') || !wc_has_notice($message, 'error')) {
        wc_add_notice($message, 'error');
    }
}
add_action('woocommerce_check_cart_items', 'sless_core_us_only_show_cart_notice');

function sless_core_us_only_validate_checkout($data, $errors) {
    if (!is_array($data) || !is_object($errors) || !method_exists($errors, 'add')) {
        return;
    }

    $uses_different_shipping = !empty($data['ship_to_different_address']);
    $country = $uses_different_shipping
        ? (isset($data['shipping_country']) ? $data['shipping_country'] : '')
        : (isset($data['billing_country']) ? $data['billing_country'] : '');

    if (
        !sless_core_us_only_is_international($country) ||
        !function_exists('WC') ||
        !WC()->cart ||
        !sless_core_us_only_cart_has_restricted_product(WC()->cart->get_cart())
    ) {
        return;
    }

    $errors->add('sless_core_us_only_shipping', sless_core_us_only_checkout_message());
}
add_action('woocommerce_after_checkout_validation', 'sless_core_us_only_validate_checkout', 10, 2);
