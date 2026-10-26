<?php
/**
 * Plugin Name: Sless Merchandise Discovery
 * Description: Shared navigation, homepage merchandise feature and native WooCommerce catalog discovery.
 * Version: 1.0.0
 * Requires Plugins: woocommerce
 */
if (!defined('ABSPATH')) exit;

function sm_categories() {
    $definitions = array(
        't-shirts' => 'type', 'hoodies-sweatshirts' => 'type', 'bottoms' => 'type',
        'hats' => 'type', 'bags' => 'type', 'drinkware' => 'type',
        'canvas-wall-art' => 'type', 'home-living' => 'type',
        'accessories' => 'type', 'stickers-stationery' => 'type',
        'halloween' => 'collection', 'thanksgiving' => 'collection',
        'christmas' => 'collection', 'sless-originals' => 'collection',
    );
    $out = array();
    foreach ($definitions as $slug => $group) {
        $term = get_term_by('slug', $slug, 'product_cat');
        if (!$term || is_wp_error($term) || !$term->count) continue;
        $url = get_term_link($term);
        if (is_wp_error($url)) continue;
        $out[] = array('name' => $term->name, 'slug' => $slug, 'url' => $url,
            'count' => (int) $term->count, 'group' => $group);
    }
    return $out;
}

require_once __DIR__ . '/views.php';

add_action('wp_enqueue_scripts', function () {
    if (!function_exists('wc_get_product')) return;
    wp_enqueue_style('sless-merch-discovery', plugins_url('discovery.css', __FILE__), array(),
        (string) filemtime(__DIR__ . '/discovery.css'));
    if (is_cart() || (is_checkout() && !is_wc_endpoint_url()) || is_order_received_page()) {
        wp_enqueue_style('sless-cart-layout', plugins_url('cart-layout.css', __FILE__),
            array('sless-merch-discovery'), (string) filemtime(__DIR__ . '/cart-layout.css'));
    }
    wp_enqueue_script('sless-merch-discovery', plugins_url('discovery.js', __FILE__), array(),
        (string) filemtime(__DIR__ . '/discovery.js'), true);
    wp_add_inline_style('sless-merch-discovery',
        '.sm-discovery-active .elementor-location-header,.sm-discovery-active .sless .topline{display:none!important}' .
        '.sm-discovery-active .sless .hero{padding-top:44px}' .
        '.sm-discovery-active .sless .hero h1{font-size:clamp(66px,10vw,132px)}');
});
add_filter('body_class', function ($classes) {
    $classes[] = 'sm-discovery-active';
    return $classes;
});

function sm_output_site_header() {
    static $rendered = false;
    if ($rendered || !function_exists('wc_get_product') || is_feed()) return;
    $rendered = true;
    echo sm_nav_render(); // Escaped at each dynamic value in views.php.
}
add_action('wp_body_open', 'sm_output_site_header', 5);
add_action('elementor/page_templates/canvas/before_content', 'sm_output_site_header', 5);

function sm_transform_page_content($content) {
    if (is_admin() || is_feed() || !is_string($content)) return $content;
    // Existing original-shirt cards should open the matching item, not a generic store.
    if (strpos($content, '<article class="shirt">') !== false) {
        $originals = array('NO INTRODUCTION NEEDED' => 485, 'STAY UNDENIABLE' => 493,
            'BUILT DIFFERENT. PROVEN DAILY.' => 502);
        $content = preg_replace_callback('~<article class="shirt">.*?</article>~s', function ($match) use ($originals) {
            $card = $match[0];
            foreach ($originals as $name => $id) {
                if (strpos($card, '<h3>' . $name . '</h3>') === false) continue;
                $product = wc_get_product($id);
                if (!$product || $product->get_status() !== 'publish') return $card;
                $card = preg_replace('~<span class="price">.*?</span>~s',
                    '<span class="price">' . wp_kses_post($product->get_price_html()) . '</span>', $card, 1);
                $card = preg_replace('~<a class="btn secondary" href="[^"]*">View in store</a>~',
                    '<a class="btn secondary" href="' . esc_url($product->get_permalink()) .
                    '">Choose your size</a>', $card, 1);
                return $card;
            }
            return $card;
        }, $content);
    }
    // Use one real catalog destination instead of an incomplete duplicate store.
    $content = str_replace(
        array('href="https://slessismore.org/store/"', 'href="/store/"'),
        'href="' . esc_url(wc_get_page_permalink('shop')) . '"', $content);
    if (strpos($content, 'class="sless"') !== false) {
        $content = preg_replace('~<header class="topline">.*?</header>~s', '', $content, 1);
    }
    if (is_front_page() && strpos($content, 'id="sless-halloween-feature"') === false &&
        strpos($content, '<section class="hero">') !== false) {
        $content = str_replace('<section class="hero">', sm_halloween_render() . '<section class="hero">', $content);
    }
    return $content;
}
add_filter('the_content', 'sm_transform_page_content', 30);
add_filter('elementor/widget/render_content', 'sm_transform_page_content', 30);

function sm_output_catalog_controls() {
    static $rendered = false;
    if ($rendered || is_product()) return;
    $rendered = true;
    echo sm_catalog_render(); // Escaped at each dynamic value in views.php.
}
add_action('woocommerce_archive_description', 'sm_output_catalog_controls', 20);
add_action('woocommerce_before_shop_loop', 'sm_output_catalog_controls', 5);
add_action('woocommerce_no_products_found', 'sm_output_catalog_controls', 5);
add_filter('woocommerce_page_title', function ($title) {
    return is_shop() && !is_search() ? 'All Merchandise' : $title;
});
add_action('template_redirect', function () {
    if (is_page(150) && !is_preview() && !is_user_logged_in()) {
        wp_safe_redirect(wc_get_page_permalink('shop'), 301, 'Sless Merchandise Discovery');
        exit;
    }
});
