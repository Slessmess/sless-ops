<?php
// Anonymous cart calculations only: no orders, payments, customers or emails.
$ids = array('shirt' => 660, 'canvas' => 680);
$products = array();
$selected = array();
foreach ($ids as $key => $id) {
    $product = wc_get_product($id);
    if (!$product || $product->get_status() !== 'publish') throw new Exception('Missing live product');
    $variants = array();
    foreach ($product->get_children() as $childId) {
        $child = wc_get_product($childId);
        if (!$child) throw new Exception('Missing variation');
        $attrs = $child->get_variation_attributes();
        $variants[] = array(
            'id' => $childId, 'attributes' => $attrs, 'price' => $child->get_price(),
            'purchasable' => $child->is_purchasable(), 'inStock' => $child->is_in_stock(),
            'image' => wp_get_attachment_url($child->get_image_id()),
        );
        if ($key === 'canvas') $selected['canvas'] = $child;
        else {
            $values = array_map('strtolower', array_values($attrs));
            if (in_array('m', $values, true)) {
                foreach (array('purple', 'orange', 'black') as $color) {
                    if (in_array($color, $values, true)) $selected[$color] = $child;
                }
            }
        }
    }
    $products[$key] = array(
        'id' => $id, 'name' => $product->get_name(), 'status' => $product->get_status(),
        'url' => $product->get_permalink(), 'visibility' => $product->get_catalog_visibility(),
        'variations' => $variants, 'featuredImage' => wp_get_attachment_url($product->get_image_id()),
        'galleryCount' => count($product->get_gallery_image_ids()),
    );
}
wc_load_cart();
WC()->customer = new WC_Customer(0);
$calculate = function ($keys, $country, $state, $postcode) use ($selected) {
    $cart = WC()->cart;
    $cart->empty_cart(false);
    foreach ($keys as $key) {
        if (empty($selected[$key])) throw new Exception('Expected purchasable variation missing: ' . $key);
        $p = $selected[$key];
        if (!$cart->add_to_cart($p->get_parent_id(), 1, $p->get_id(), $p->get_variation_attributes())) {
            throw new Exception('Anonymous add to cart failed: ' . $key);
        }
    }
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
    return array('items' => count($cart->get_cart()), 'subtotal' => (float) $cart->get_subtotal(),
        'rates' => $rates, 'country' => $country);
};
$carts = array();
foreach (array('purple', 'orange', 'black', 'canvas') as $key) {
    $carts[$key . 'US'] = $calculate(array($key), 'US', 'NY', '10001');
    if (!$carts[$key . 'US']['rates']) throw new Exception('US shipping unavailable: ' . $key);
}
$carts['mixedUS'] = $calculate(array('purple', 'canvas'), 'US', 'NY', '10001');
$carts['shirtCanada'] = $calculate(array('purple'), 'CA', 'ON', 'M5V2T6');
$carts['canvasCanada'] = $calculate(array('canvas'), 'CA', 'ON', 'M5V2T6');
WC()->cart->empty_cart(false);
$core = wc_get_product(485);
if ($core && $core->is_type('variable')) {
    $coreChildren = $core->get_children();
    $core = $coreChildren ? wc_get_product($coreChildren[0]) : null;
}
$settings = get_option('woocommerce_stripe_settings', array());
echo 'SLESS_SAFE_JSON:' . wp_json_encode(array(
    'products' => $products, 'cartChecks' => $carts,
    'paymentsLive' => ($settings['testmode'] ?? '') === 'no',
    'storeOpen' => get_option('woocommerce_coming_soon') === 'no',
    'originalCoreGuardIntact' => function_exists('sless_core_us_only_is_restricted_product')
        && $core && sless_core_us_only_is_restricted_product($core),
    'ordersCreated' => false, 'paymentsSubmitted' => false,
)) . PHP_EOL;
