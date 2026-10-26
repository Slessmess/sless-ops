<?php
// Fresh anonymous in-memory cart only. No checkout, order, payment or email.
$customerCookies = array_filter(array_keys($_COOKIE), function ($name) {
    return strpos($name, 'wp_woocommerce_session_') === 0;
});
if (get_current_user_id() || $customerCookies) throw new Exception('Anonymous check required');
wc_load_cart();
WC()->customer = new WC_Customer(0);
$cart = WC()->cart;
$cart->empty_cart(false);
// Shipping is deliberately outside this price-only check.
add_filter('woocommerce_cart_needs_shipping', '__return_false');
foreach (array(238, 260, 314, 323, 330, 660, 735) as $id) {
    $p = wc_get_product($id);
    $selected = null;
    foreach ($p->get_children() as $vid) {
        $v = wc_get_product($vid);
        if ($v->is_purchasable() && $v->is_in_stock()) { $selected = $v; break; }
    }
    if (!$selected || !$cart->add_to_cart($id, 1, $selected->get_id(), $selected->get_variation_attributes())) {
        throw new Exception('Holiday sale item could not be added');
    }
}
$cart->calculate_totals();
$rows = array();
foreach ($cart->get_cart() as $item) {
    $v = $item['data'];
    $regular = (float)$v->get_regular_price();
    $paid = (float)$v->get_price();
    if (abs($paid - round($regular * .8, 2)) > .001) throw new Exception('Cart discount incorrect');
    $rows[] = array('parentId' => $v->get_parent_id(), 'regular' => $regular, 'sale' => $paid);
}
if (count($rows) !== 7) throw new Exception('Cart incomplete');
$result = array('items' => $rows, 'cartPricesVerified' => true,
    'couponRequired' => false, 'ordersCreated' => false, 'paymentSubmitted' => false);
$cart->empty_cart(false);
WC()->session->destroy_session();
echo 'SLESS_SAFE_JSON:' . wp_json_encode($result);
