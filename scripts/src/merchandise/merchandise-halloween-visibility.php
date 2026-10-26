<?php
// Owner-authorized merchandising of the two new products only.
// No unrelated products, templates, settings, orders or payments are modified.
$getCategory = function ($name, $slug) {
    $term = get_term_by('slug', $slug, 'product_cat');
    if ($term) return (int) $term->term_id;
    $created = wp_insert_term($name, 'product_cat', array('slug' => $slug));
    if (is_wp_error($created)) throw new Exception('Product category creation failed');
    return (int) $created['term_id'];
};
$halloween = $getCategory('Halloween', 'halloween');
$shirts = $getCategory('T-Shirts', 't-shirts');
$canvases = $getCategory('Canvas Wall Art', 'canvas-wall-art');
$out = array();
foreach (array(
    array('id' => 660, 'name' => 'Sless After Dark — Halloween Tee', 'category' => $shirts, 'order' => -20),
    array('id' => 680, 'name' => 'Sless After Dark — Halloween Canvas, 6 × 6 in', 'category' => $canvases, 'order' => -19),
) as $spec) {
    $p = wc_get_product($spec['id']);
    if (!$p || $p->get_name() !== $spec['name'] || $p->get_status() !== 'publish') {
        throw new Exception('Expected live Halloween product changed');
    }
    $p->set_category_ids(array($halloween, $spec['category']));
    $p->set_featured(true);
    $p->set_menu_order($spec['order']);
    if ($spec['id'] === 660) {
        $purple = wc_get_product(661);
        if (!$purple || $purple->get_parent_id() !== 660 || !$purple->get_image_id()) {
            throw new Exception('Purple image mapping changed');
        }
        $p->set_image_id($purple->get_image_id());
    }
    $p->save();
    wc_delete_product_transients($p->get_id());
    clean_post_cache($p->get_id());
    $out[] = array('id' => $p->get_id(), 'featured' => $p->is_featured(),
        'categories' => wp_get_post_terms($p->get_id(), 'product_cat', array('fields' => 'names')),
        'order' => $p->get_menu_order(), 'url' => $p->get_permalink());
}
$coreChecks = array();
foreach (array(485, 493, 502) as $id) {
    $p = wc_get_product($id);
    foreach ($p->get_children() as $child) {
        $coreChecks[] = sless_core_us_only_is_restricted_product(wc_get_product($child));
    }
}
if (function_exists('sg_cachepress_purge_cache')) sg_cachepress_purge_cache();
echo 'SLESS_SAFE_JSON:' . wp_json_encode(array(
    'products' => $out, 'originalCoreGuardIntact' => count($coreChecks) === 18 && !in_array(false, $coreChecks, true),
    'catalogSort' => get_option('woocommerce_default_catalog_orderby'),
    'ordersCreated' => false, 'paymentsSubmitted' => false,
)) . PHP_EOL;
