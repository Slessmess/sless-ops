<?php
// Curate existing front mockups only. No uploads, print changes, orders or charges.
$product = wc_get_product(660);
if (!$product || $product->get_name() !== 'Sless After Dark — Halloween Tee' ||
    $product->get_status() !== 'publish') throw new Exception('Expected live shirt missing');
$before = array('featured' => $product->get_image_id(), 'gallery' => $product->get_gallery_image_ids());
$colors = array('Purple' => 689, 'Black' => 679, 'Orange' => 685);
$variationChecks = array();
foreach ($product->get_children() as $id) {
    $variation = wc_get_product($id);
    $attributes = $variation->get_variation_attributes();
    $color = $attributes['attribute_gildan-colors'] ?? '';
    if (!isset($colors[$color]) || $variation->get_image_id() !== $colors[$color]) {
        throw new Exception('Unexpected color image mapping; inspect before applying');
    }
    $variationChecks[] = array('id' => $id, 'color' => $color, 'imageId' => $variation->get_image_id());
}
if (count($variationChecks) !== 18) throw new Exception('Variant count changed');
foreach ($colors as $color => $imageId) {
    if (!wp_attachment_is_image($imageId)) throw new Exception('Expected front mockup missing');
    update_post_meta($imageId, '_wp_attachment_image_alt',
        'Sless After Dark Halloween tee in ' . strtolower($color) . ', front with printed design');
    $result = wp_update_post(array('ID' => $imageId,
        'post_title' => 'Sless After Dark — ' . $color . ' tee — front design',
        'post_excerpt' => $color . ' — printed front'), true);
    if (is_wp_error($result)) throw new Exception('Image label update failed');
}
$product->set_image_id($colors['Purple']);
$product->set_gallery_image_ids(array($colors['Black'], $colors['Orange']));
$product->save();
wc_delete_product_transients(660);
clean_post_cache(660);
if (function_exists('sg_cachepress_purge_cache')) sg_cachepress_purge_cache();
$product = wc_get_product(660);
echo 'SLESS_SAFE_JSON:' . wp_json_encode(array(
    'before' => $before,
    'after' => array('featured' => $product->get_image_id(), 'gallery' => $product->get_gallery_image_ids()),
    'frontViews' => $colors, 'variationImages' => $variationChecks,
    'printSizeChanged' => false, 'artworkChanged' => false, 'canvasChanged' => false,
    'ordersCreated' => false,
)) . PHP_EOL;
