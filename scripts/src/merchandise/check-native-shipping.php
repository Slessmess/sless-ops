<?php
// Anonymous cart calculations only. No orders, payment submissions, or customers.
wc_load_cart();
$cart = WC()->cart;
WC()->customer = new WC_Customer(0);
$select = function ($id) {
    $product = wc_get_product($id);
    if (!$product) return null;
    if ($product->is_type('variable')) {
        foreach ($product->get_children() as $childId) {
            $child = wc_get_product($childId);
            if ($child && $child->is_purchasable() && $child->is_in_stock()) return $child;
        }
        return null;
    }
    return $product;
};
$sticker = $select(225);
$core = $select(485);
$add = function ($product) use ($cart) {
    if (!$product) return false;
    return $product->is_type('variation')
        ? $cart->add_to_cart($product->get_parent_id(), 1, $product->get_id(), $product->get_variation_attributes())
        : $cart->add_to_cart($product->get_id(), 1);
};
$calculate = function ($country, $state, $postcode, $includeCore) use ($cart, $sticker, $core, $add) {
    $cart->empty_cart(false);
    if (!$add($sticker) || ($includeCore && !$add($core))) return array('cartReady' => false);
    foreach (array('shipping', 'billing') as $type) {
        WC()->customer->{"set_{$type}_country"}($country);
        WC()->customer->{"set_{$type}_state"}($state);
        WC()->customer->{"set_{$type}_postcode"}($postcode);
        WC()->customer->{"set_{$type}_city"}($country === 'US' ? 'New York' : 'Toronto');
    }
    WC()->customer->set_calculated_shipping(true);
    WC()->session->set('shipping_for_package_0', null);
    WC()->shipping()->reset_shipping();
    $cart->calculate_totals();
    $rates = array();
    foreach (WC()->shipping()->get_packages() as $package) {
        foreach (($package['rates'] ?? array()) as $rate) {
            $rates[] = array('method' => $rate->get_method_id(), 'cost' => (float) $rate->get_cost());
        }
    }
    return array('cartReady' => true, 'rates' => $rates, 'total' => (float) $cart->get_total('edit'));
};
$us = $calculate('US', 'NY', '10001', false);
$mixedUs = $calculate('US', 'NY', '10001', true);
// These filters affect this one CLI request, not saved settings.
add_filter('option_woocommerce_allowed_countries', function () { return 'all'; });
add_filter('option_woocommerce_ship_to_countries', function () { return ''; });
$ca = $calculate('CA', 'ON', 'M5V2T6', false);
$mixedCa = $calculate('CA', 'ON', 'M5V2T6', true);
$cart->empty_cart(false);
echo 'SLESS_SAFE_JSON:' . wp_json_encode(array(
    'usSticker' => $us, 'usMixedCart' => $mixedUs,
    'canadaStickerWithInternationalEligibilitySimulated' => $ca,
    'canadaMixedCartWithInternationalEligibilitySimulated' => $mixedCa,
    'originalShirtRecognizedByGuard' => $core && sless_core_us_only_is_restricted_product($core),
    'settingsChanged' => false, 'ordersCreated' => false,
)) . PHP_EOL;
