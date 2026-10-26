<?php
// Owner-authorized category assignment only. No artwork, price, stock or order changes.
$types = array(
    't-shirts' => array('T-Shirts & Tanks', array(660, 502, 493, 485, 305, 298, 293, 283, 276, 269, 260, 251, 244, 238, 230)),
    'hoodies-sweatshirts' => array('Hoodies & Sweatshirts', array(348, 339, 330, 323, 314)),
    'bottoms' => array('Shorts & Joggers', array(364, 356)),
    'hats' => array('Hats & Beanies', array(386, 382, 378, 376, 373)),
    'bags' => array('Bags & Totes', array(401, 397, 394, 392, 388)),
    'drinkware' => array('Mugs & Drinkware', array(425, 422, 418, 415, 412, 408, 405, 403)),
    'canvas-wall-art' => array('Canvas & Wall Art', array(680, 479, 475)),
    'home-living' => array('Home & Living', array(483, 473, 470, 466, 463)),
    'accessories' => array('Tech Accessories', array(454, 446, 441)),
    'stickers-stationery' => array('Stickers & Stationery', array(439, 434, 427, 225)),
);
$collections = array(
    'halloween' => 'Halloween', 'thanksgiving' => 'Thanksgiving',
    'christmas' => 'Christmas', 'sless-originals' => 'Sless Originals',
);
$assigned = array();
foreach ($types as $slug => $type) {
    foreach ($type[1] as $id) {
        if (isset($assigned[$id])) throw new Exception('Duplicate category mapping');
        $assigned[$id] = $slug;
    }
}
$published = wc_get_products(array('status' => 'publish', 'limit' => -1));
if (count($published) !== count($assigned)) throw new Exception('Catalog changed: review classification before applying');
foreach ($published as $product) {
    if (!isset($assigned[$product->get_id()])) throw new Exception('Unmapped live product');
    if (($expectedNames[$product->get_id()] ?? '') !== $product->get_name()) {
        throw new Exception('Product identity changed');
    }
}
$terms = array();
$ensure = function ($slug, $name) {
    $term = get_term_by('slug', $slug, 'product_cat');
    if ($term) {
        if ($term->name !== $name) {
            $result = wp_update_term($term->term_id, 'product_cat', array('name' => $name));
            if (is_wp_error($result)) throw new Exception('Category rename failed');
        }
        return (int) $term->term_id;
    }
    $result = wp_insert_term($name, 'product_cat', array('slug' => $slug));
    if (is_wp_error($result)) throw new Exception('Category creation failed');
    return (int) $result['term_id'];
};
foreach ($types as $slug => $type) $terms[$slug] = $ensure($slug, $type[0]);
foreach ($collections as $slug => $name) $terms[$slug] = $ensure($slug, $name);
wp_update_term($terms['sless-originals'], 'product_cat', array(
    'description' => 'The three original Sless shirts. Available for shipping within the United States only.',
));
$changes = array();
$uncategorized = get_term_by('slug', 'uncategorized', 'product_cat');
foreach ($published as $product) {
    $id = $product->get_id();
    $categoryIds = $product->get_category_ids();
    if ($uncategorized) $categoryIds = array_diff($categoryIds, array((int) $uncategorized->term_id));
    $categoryIds[] = $terms[$assigned[$id]];
    foreach (array('halloween', 'thanksgiving', 'christmas') as $season) {
        if (stripos($product->get_name(), $season) !== false) $categoryIds[] = $terms[$season];
    }
    if (in_array($id, array(485, 493, 502), true)) $categoryIds[] = $terms['sless-originals'];
    $categoryIds = array_values(array_unique(array_map('intval', $categoryIds)));
    $result = wp_set_object_terms($id, $categoryIds, 'product_cat', false);
    if (is_wp_error($result)) throw new Exception('Category assignment failed');
    wc_delete_product_transients($id);
    $changes[] = array('id' => $id, 'name' => $product->get_name(), 'type' => $assigned[$id],
        'categories' => wp_get_post_terms($id, 'product_cat', array('fields' => 'names')));
}
wp_update_term_count_now(array_values($terms), 'product_cat');
echo 'SLESS_SAFE_JSON:' . wp_json_encode(array('products' => $changes, 'count' => count($changes),
    'categoryIds' => $terms, 'artworkChanged' => false, 'pricesChanged' => false, 'ordersCreated' => false)) . PHP_EOL;
