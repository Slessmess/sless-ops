<?php
/**
 * Plugin Name: Sless Isolated Commerce QA
 * Description: Expiring, operator-only Stripe sandbox sessions and permanent test-order fulfillment exclusion.
 * Version: 1.0.0
 */
defined('ABSPATH') || exit;

function sless_e2e_signature($payload) {
    if (!defined('AUTH_KEY') || !defined('AUTH_SALT')) return '';
    return hash_hmac('sha256', $payload, AUTH_KEY . AUTH_SALT);
}

function sless_e2e_context() {
    $cookie = $_COOKIE['sless_commerce_qa'] ?? '';
    $parts = explode('.', $cookie);
    if (count($parts) !== 2 || !sless_e2e_signature($parts[0]) || !hash_equals(sless_e2e_signature($parts[0]), $parts[1])) return false;
    $data = json_decode(base64_decode($parts[0], true), true);
    $config = get_option('sless_commerce_qa', array());
    if (!is_array($data) || empty($config['expires']) || time() > $config['expires']
        || ($data['expires'] ?? 0) !== $config['expires'] || ($data['batch'] ?? '') !== ($config['batch'] ?? '')
        || !in_array($data['flow'] ?? 0, array(1, 2), true)) return false;
    return $data;
}

add_action('init', function () {
    if (!isset($_GET['sless_qa_enter'])) return;
    $config = get_option('sless_commerce_qa', array());
    $token = is_string($_GET['sless_qa_enter']) ? $_GET['sless_qa_enter'] : '';
    $flow = (int) ($_GET['flow'] ?? 0);
    if (!empty($config['token_hash']) && time() < ($config['expires'] ?? 0)
        && hash_equals($config['token_hash'], hash('sha256', $token)) && in_array($flow, array(1, 2), true)) {
        $data = base64_encode(wp_json_encode(array('batch' => $config['batch'], 'expires' => $config['expires'], 'flow' => $flow)));
        $signed = $data . '.' . sless_e2e_signature($data);
        setcookie('sless_commerce_qa', $signed, array('expires' => $config['expires'], 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax'));
        nocache_headers();
        header('Referrer-Policy: no-referrer');
        wp_safe_redirect(home_url('/'));
        exit;
    }
    status_header(403);
    exit('QA session unavailable.');
}, -10000);

// Native Stripe verifies the signature after selecting the appropriate test
// webhook secret. A livemode=false hint never replaces signature verification.
function sless_e2e_test_webhook() {
    $endpoint = strtolower((string) ($_GET['wc-api'] ?? ''));
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    if (!in_array($endpoint, array('wc_stripe', 'wc_gateway_stripe'), true)
        && !preg_match('~/wc-api/(wc_stripe|wc_gateway_stripe)/?~i', $uri)) return false;
    if (empty($_SERVER['HTTP_STRIPE_SIGNATURE'])) return false;
    $event = json_decode(file_get_contents('php://input'), true);
    return is_array($event) && isset($event['livemode']) && $event['livemode'] === false;
}
add_filter('option_woocommerce_stripe_settings', function ($settings) {
    if (sless_e2e_context() || sless_e2e_test_webhook()) {
        if (empty($settings['test_secret_key']) || empty($settings['test_publishable_key'])
            || empty($settings['test_webhook_secret'])) {
            $settings['enabled'] = 'no';
            return $settings;
        }
        $settings['testmode'] = 'yes';
    }
    return $settings;
}, PHP_INT_MAX);

add_action('init', function () {
    if (!sless_e2e_context()) return;
    if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
    nocache_headers();
    header('X-Sless-QA-Mode: stripe-sandbox');
}, -9999);

function sless_e2e_mark_order($order) {
    $context = sless_e2e_context();
    if (!$context || !is_object($order) || !is_a($order, 'WC_Order')) return;
    $order->update_meta_data('_sless_e2e_batch', $context['batch']);
    $order->update_meta_data('_sless_e2e_flow', $context['flow']);
    $order->update_meta_data('_sless_e2e_do_not_fulfill', 'yes');
}
add_action('woocommerce_checkout_create_order', 'sless_e2e_mark_order', -9999);
add_action('woocommerce_store_api_checkout_update_order_meta', 'sless_e2e_mark_order', -9999);
add_action('woocommerce_new_order', function ($id, $order = null) {
    if (!sless_e2e_context()) return;
    $order = $order ?: wc_get_order($id);
    sless_e2e_mark_order($order);
    if ($order) $order->save_meta_data();
}, -9999, 2);

// This exclusion survives the temporary sessions and applies to background jobs.
add_filter('woocommerce_webhook_should_deliver', function ($deliver, $webhook, $arg) {
    $order = is_a($arg, 'WC_Order') ? $arg : (is_numeric($arg) ? wc_get_order($arg) : false);
    if ($order && $order->get_meta('_sless_e2e_do_not_fulfill') === 'yes') {
        $order->update_meta_data('_sless_e2e_fulfillment_blocked', true);
        $order->save_meta_data();
        return false;
    }
    return $deliver;
}, PHP_INT_MAX, 3);
add_filter('woocommerce_rest_shop_order_object_query', function ($args) {
    $existing = $args['meta_query'] ?? array();
    $args['meta_query'] = array('relation' => 'AND', $existing, array('key' => '_sless_e2e_do_not_fulfill', 'compare' => 'NOT EXISTS'));
    return $args;
});

foreach (array('new_order', 'customer_processing_order', 'customer_completed_order', 'customer_on_hold_order', 'failed_order') as $email_type) {
    add_filter('woocommerce_email_subject_' . $email_type, function ($subject, $order) use ($email_type) {
        if (is_a($order, 'WC_Order') && $order->get_meta('_sless_e2e_do_not_fulfill') === 'yes')
            return '[QA-E2E-' . $order->get_id() . ':' . $email_type . '] ' . $subject;
        return $subject;
    }, 10, 2);
}
function sless_e2e_record_mail($data, $status) {
    if (!is_array($data) || !preg_match('/\[QA-E2E-(\d+):([a-z_]+)\]/', $data['subject'] ?? '', $match)) return;
    $order = wc_get_order((int) $match[1]);
    if (!$order || $order->get_meta('_sless_e2e_do_not_fulfill') !== 'yes') return;
    $log = (array) $order->get_meta('_sless_e2e_mail_status');
    $log[$match[2]] = $status;
    $order->update_meta_data('_sless_e2e_mail_status', $log);
    $order->save_meta_data();
}
add_action('wp_mail_succeeded', function ($data) {
    $transport = $GLOBALS['phpmailer']->Mailer ?? '';
    sless_e2e_record_mail($data, $transport === 'smtp' ? 'smtp_accepted' : 'mail_transport_accepted');
});
add_action('wp_mail_failed', function ($error) { sless_e2e_record_mail($error->get_error_data(), 'failed'); });

add_action('wp_footer', function () {
    $context = sless_e2e_context();
    if (!$context) return;
    echo '<p id="sless-qa-notice" role="status"><strong>PRIVATE STRIPE SANDBOX TEST ' . (int) $context['flow'] . ' — no real charges; do not fulfill.</strong></p>';
});
