<?php
// Explicitly authorized seven-product sale. No orders, payments or print changes.
$in = json_decode(stream_get_contents(STDIN), true);
$ids = array(238, 260, 314, 323, 330, 660, 735);
if ($in['ids'] !== $ids || $in['discount'] !== 20 ||
    $in['endDate'] !== '2026-10-25') throw new Exception('Sale authorization mismatch');
$end = (new DateTimeImmutable('2026-10-25 23:59:59', new DateTimeZone('America/New_York')))->getTimestamp();
$args = array('sless-holiday-20-percent-2026-10-25');
$snapshot = function ($p) {
    return array('id' => $p->get_id(), 'name' => $p->get_name(), 'sku' => $p->get_sku(),
        'regular' => $p->get_regular_price(), 'sale' => $p->get_sale_price(),
        'from' => $p->get_date_on_sale_from() ? $p->get_date_on_sale_from()->getTimestamp() : null,
        'to' => $p->get_date_on_sale_to() ? $p->get_date_on_sale_to()->getTimestamp() : null,
        'image' => $p->get_image_id(), 'gallery' => $p->get_gallery_image_ids(),
        'description' => $p->get_description(), 'short' => $p->get_short_description(),
        'slug' => $p->get_slug(), 'status' => $p->get_status());
};
$products = array();
$unrelated = array();
foreach (wc_get_products(array('status' => 'publish', 'limit' => -1)) as $p) {
    if (!in_array($p->get_id(), $ids, true)) {
        $row = $snapshot($p);
        $row['variants'] = array();
        foreach ($p->get_children() as $vid) $row['variants'][] = $snapshot(wc_get_product($vid));
        $unrelated[(string)$p->get_id()] = $row;
    }
}
foreach ($in['products'] as $expected) {
    $p = wc_get_product($expected['id']);
    if (!$p || $p->get_status() !== 'publish' || $p->get_name() !== $expected['title']) {
        throw new Exception('Holiday product identity changed');
    }
    if (count($p->get_children()) !== count($expected['variants'])) throw new Exception('Variant count changed');
    foreach ($expected['variants'] as $previous) {
        $v = wc_get_product($previous['id']);
        if (!$v || $v->get_parent_id() !== $p->get_id() || $v->get_sku() !== $previous['sku'] ||
            $v->get_regular_price() !== $previous['regular']) throw new Exception('Regular price or SKU changed');
        if ($in['mode'] === 'apply' &&
            ($v->get_sale_price() !== '' || $v->get_date_on_sale_from() || $v->get_date_on_sale_to())) {
            throw new Exception('Another sale exists; reconcile before overwriting');
        }
    }
    $products[] = $p;
}
if ($in['mode'] === 'apply') {
    if ($end <= time() || !has_action('woocommerce_scheduled_sales') ||
        (defined('DISABLE_WP_CRON') && DISABLE_WP_CRON)) throw new Exception('Automatic expiry is not available');
    // Schedule the standard WooCommerce expiry handler, with a distinct event key.
    if (!wp_next_scheduled('woocommerce_scheduled_sales', $args)) {
        $scheduled = wp_schedule_single_event($end + 1, 'woocommerce_scheduled_sales', $args, true);
        if (is_wp_error($scheduled) || !$scheduled) throw new Exception('Sale expiry scheduling failed');
    }
    if (wp_next_scheduled('woocommerce_scheduled_sales', $args) !== $end + 1) throw new Exception('Wrong expiry timestamp');
    $start = time() - 1;
    foreach ($products as $p) {
        foreach ($p->get_children() as $vid) {
            $v = wc_get_product($vid);
            $sale = wc_format_decimal(round((float)$v->get_regular_price() * 0.8, 2), 2);
            $v->set_sale_price($sale);
            $v->set_date_on_sale_from($start);
            $v->set_date_on_sale_to($end);
            $v->save();
        }
        WC_Product_Variable::sync($p->get_id());
        wc_delete_product_transients($p->get_id());
        clean_post_cache($p->get_id());
    }
    delete_transient('wc_products_onsale');
    if (function_exists('sg_cachepress_purge_cache')) sg_cachepress_purge_cache();
}
$result = array();
$verified = 0;
foreach ($products as $oldParent) {
    $p = wc_get_product($oldParent->get_id());
    if (!$p->is_on_sale()) throw new Exception('Parent sale display not active');
    $rows = array();
    foreach ($p->get_children() as $vid) {
        $v = wc_get_product($vid);
        $expected = round((float)$v->get_regular_price() * .8, 2);
        if (!$v->is_on_sale() || abs((float)$v->get_price() - $expected) > .001 ||
            $v->get_date_on_sale_to()->getTimestamp() !== $end) throw new Exception('Sale price or end time not verified');
        $rows[] = array('id' => $vid, 'regular' => $v->get_regular_price(),
            'sale' => $v->get_sale_price(), 'endTimestamp' => $end);
        $verified++;
    }
    $a = $snapshot($oldParent); $b = $snapshot($p);
    // Variable parent price caches are updated, but art, regular prices and copy must not be.
    foreach (array('sale', 'from', 'to') as $field) { unset($a[$field]); unset($b[$field]); }
    if ($a !== $b) throw new Exception('Unrelated holiday parent content changed');
    $result[] = array('id' => $p->get_id(), 'title' => $p->get_name(), 'url' => $p->get_permalink(),
        'regularMin' => min(array_map(function ($r) { return (float)$r['regular']; }, $rows)),
        'saleMin' => min(array_map(function ($r) { return (float)$r['sale']; }, $rows)),
        'saleMax' => max(array_map(function ($r) { return (float)$r['sale']; }, $rows)),
        'variants' => $rows);
}
foreach ($unrelated as $id => $before) {
    $p = wc_get_product((int)$id); $after = $snapshot($p); $after['variants'] = array();
    foreach ($p->get_children() as $vid) $after['variants'][] = $snapshot(wc_get_product($vid));
    if ($after !== $before) throw new Exception('Nonholiday merchandise changed');
}
echo 'SLESS_SAFE_JSON:' . wp_json_encode(array(
    'products' => $result, 'discountPercent' => 20, 'verifiedVariants' => $verified,
    'endsAtEastern' => '2026-10-25T23:59:59-04:00', 'endTimestamp' => $end,
    'expiryEvent' => wp_next_scheduled('woocommerce_scheduled_sales', $args),
    'regularPricesPreserved' => true, 'nonholidayMerchandiseUnchanged' => true,
    'ordersCreated' => false, 'productionApproved' => false,
));
