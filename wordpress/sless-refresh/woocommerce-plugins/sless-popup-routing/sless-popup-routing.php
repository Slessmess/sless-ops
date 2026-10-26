<?php
/**
 * Plugin Name: Sless Branded Merchandise Routing
 * Description: Controlled merchandise cutover; preserves digital pages and existing order/account access.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) exit;

function sless_popup_config() {
    $config = get_option('sless_popup_routing', array());
    return is_array($config) ? $config : array();
}
function sless_popup_ready() {
    $c = sless_popup_config();
    return !empty($c['enabled']) && !empty($c['brand_verified']) &&
        !empty($c['return_links_verified']) && !empty($c['catalog_verified']) &&
        ($c['origin'] ?? '') === 'https://shop.slessismore.org';
}
function sless_popup_root() { return 'https://shop.slessismore.org/'; }
function sless_popup_safe_target($url) {
    $p = wp_parse_url($url);
    return is_array($p) && ($p['scheme'] ?? '') === 'https' &&
        strtolower($p['host'] ?? '') === 'shop.slessismore.org' &&
        empty($p['user']) && empty($p['pass']) && empty($p['port']);
}
function sless_popup_physical($id) {
    $p = wc_get_product($id);
    return $p && !$p->is_virtual() && !$p->is_downloadable();
}
function sless_popup_product_target($id) {
    $c = sless_popup_config();
    $url = $c['products'][(string) $id] ?? sless_popup_root();
    return sless_popup_safe_target($url) ? $url : sless_popup_root();
}
function sless_popup_rewrite_url($url) {
    if (!sless_popup_ready() || !is_string($url) || $url === '') return $url;
    $p = wp_parse_url(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if (!is_array($p) || (isset($p['scheme']) && !in_array(strtolower($p['scheme']), array('http','https'), true))) return $url;
    if (!empty($p['host']) && !in_array(strtolower($p['host']), array('slessismore.org','www.slessismore.org'), true)) return $url;
    if (empty($p['host']) && substr($url, 0, 1) !== '/') return $url;
    $path = '/' . ltrim($p['path'] ?? '/', '/');
    $id = 0;
    if (preg_match('~^/(?:shop|store|merch)(?:/|$)~i', $path) ||
        preg_match('~^/(?:product-category|product-tag)(?:/|$)~i', $path)) {
        $target = sless_popup_root();
    } elseif (preg_match('~^/product/~i', $path)) {
        $id = url_to_postid(home_url($path));
        if (!$id || !sless_popup_physical($id)) return $url;
        $target = sless_popup_product_target($id);
    } else {
        parse_str($p['query'] ?? '', $q);
        $id = absint($q['add-to-cart'] ?? 0);
        if (!$id || !sless_popup_physical($id)) return $url;
        $target = sless_popup_product_target($id);
    }
    // Retain paid-campaign attribution, never order keys or arbitrary parameters.
    parse_str($p['query'] ?? '', $q);
    $tracking = array();
    foreach (array('utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid') as $key) {
        if (isset($q[$key]) && is_scalar($q[$key])) $tracking[$key] = sanitize_text_field((string)$q[$key]);
    }
    return $tracking ? add_query_arg($tracking, $target) : $target;
}
function sless_popup_rewrite_markup($html) {
    if (!sless_popup_ready() || is_admin() || !is_string($html) || !class_exists('WP_HTML_Tag_Processor')) return $html;
    $tags = new WP_HTML_Tag_Processor($html);
    while ($tags->next_tag(array('tag_name'=>'A'))) {
        $url = $tags->get_attribute('href');
        if (is_string($url)) {
            $target = sless_popup_rewrite_url($url);
            if ($target !== $url) $tags->set_attribute('href', $target);
        }
    }
    return $tags->get_updated_html();
}
add_filter('the_content', 'sless_popup_rewrite_markup', 99);
add_filter('elementor/widget/render_content', 'sless_popup_rewrite_markup', 99);
add_filter('widget_text_content', 'sless_popup_rewrite_markup', 99);
add_filter('wp_nav_menu_objects', function($items) {
    if (sless_popup_ready()) foreach ($items as $item) $item->url = sless_popup_rewrite_url($item->url);
    return $items;
}, 99);
add_filter('woocommerce_get_shop_page_permalink', function($url) {
    return sless_popup_ready() ? sless_popup_root() : $url;
}, 99);
add_filter('term_link', function($url, $term, $taxonomy) {
    return sless_popup_ready() && in_array($taxonomy, array('product_cat','product_tag'), true) ? sless_popup_root() : $url;
}, 99, 3);
add_filter('post_type_link', function($url, $post) {
    return sless_popup_ready() && $post->post_type === 'product' && sless_popup_physical($post->ID)
        ? sless_popup_product_target($post->ID) : $url;
}, 99, 2);
add_filter('allowed_redirect_hosts', function($hosts) { $hosts[] = 'shop.slessismore.org'; return array_unique($hosts); });
add_action('wp_enqueue_scripts', function() {
    if (!sless_popup_ready()) return;
    wp_register_style('sless-popup-navigation', false);
    wp_enqueue_style('sless-popup-navigation');
    // The hosted shop has a cart drawer, not a /cart URL. Do not link shoppers
    // to a nonexistent hosted cart or show the unrelated Woo basket count.
    wp_add_inline_style('sless-popup-navigation',
        '#sless-site-header .sm-mobile-cart,#sless-site-header .sm-utility .sm-cart{display:none!important}');
});
add_filter('woocommerce_add_to_cart_validation', function($valid, $id) {
    if (sless_popup_ready() && sless_popup_physical($id)) {
        wc_add_notice('Merchandise checkout has moved. Shop at shop.slessismore.org; existing carts do not transfer.', 'error');
        return false;
    }
    return $valid;
}, 99, 2);
add_action('woocommerce_after_checkout_validation', function($data, $errors) {
    if (!sless_popup_ready() || !WC()->cart) return;
    foreach (WC()->cart->get_cart() as $item) {
        if (sless_popup_physical($item['product_id'])) {
            $errors->add('sless_merch_checkout_moved', 'Merchandise checkout has moved to shop.slessismore.org. Your old cart has not been deleted, but its items must be selected in the new shop.');
            break;
        }
    }
}, 99, 2);
add_action('woocommerce_store_api_checkout_update_order_from_request', function($order) {
    if (!sless_popup_ready() || $order->is_paid()) return;
    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        if ($product && !$product->is_virtual() && !$product->is_downloadable()) {
            throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
                'sless_merch_checkout_moved',
                'Merchandise checkout has moved to shop.slessismore.org. Select your items in the new shop.',
                409
            );
        }
    }
}, 99);
add_action('template_redirect', function() {
    if (!sless_popup_ready() || is_admin() || is_feed() || is_preview() ||
        ($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') return;
    if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url()) return;
    $request = home_url(wp_unslash($_SERVER['REQUEST_URI'] ?? '/'));
    $target = sless_popup_rewrite_url($request);
    if ($target !== $request && sless_popup_safe_target($target)) {
        wp_safe_redirect($target, 302, 'Sless Branded Merchandise Routing');
        exit;
    }
}, 1);
