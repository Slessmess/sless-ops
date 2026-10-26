<?php
// Read-only merchant readiness. Never creates an order or changes settings.
$s = get_option('woocommerce_stripe_settings', array());
$stripe = function ($path) use ($s) {
    $response = wp_remote_get('https://api.stripe.com/v1/' . $path, array(
        'headers' => array('Authorization' => 'Bearer ' . ($s['secret_key'] ?? '')),
        'timeout' => 20,
    ));
    if (is_wp_error($response)) return array('readFailed' => true);
    if (wp_remote_retrieve_response_code($response) !== 200) {
        return array('readFailed' => true, 'httpStatus' => wp_remote_retrieve_response_code($response));
    }
    return json_decode(wp_remote_retrieve_body($response), true);
};
$account = $stripe('account');
$hooks = $stripe('webhook_endpoints?limit=100');
$liveHooks = array();
foreach (($hooks['data'] ?? array()) as $hook) {
    if (in_array(parse_url($hook['url'], PHP_URL_HOST), array('slessismore.org', 'www.slessismore.org'), true)) {
        $liveHooks[] = array(
            'enabled' => $hook['status'] === 'enabled',
            'live' => !empty($hook['livemode']),
            'woocommerceStripeEndpoint' => strpos($hook['url'], 'wc_stripe') !== false,
            'paymentSuccessEvent' => in_array('*', $hook['enabled_events'], true) ||
                in_array('payment_intent.succeeded', $hook['enabled_events'], true),
        );
    }
}
$zones = array();
$zoneObjects = array(new WC_Shipping_Zone(0));
foreach (WC_Shipping_Zones::get_zones() as $zone) $zoneObjects[] = new WC_Shipping_Zone($zone['zone_id']);
foreach ($zoneObjects as $zone) {
    $methods = array();
    foreach ($zone->get_shipping_methods() as $method) {
        $methods[] = array('id' => $method->id, 'enabled' => $method->enabled,
            'cost' => $method->get_option('cost', null));
    }
    $zones[] = array('id' => $zone->get_id(), 'locations' => array_map(function ($location) {
        return array('type' => $location->type, 'code' => $location->code);
    }, $zone->get_zone_locations()), 'methods' => $methods);
}
$nativeMethods = array();
foreach (WC()->shipping()->get_shipping_methods() as $id => $method) {
    $nativeMethods[] = array('id' => $id, 'enabled' => $method->enabled);
}
$wcConnect = get_option('wc_connect_options', array());
global $wpdb;
$out = array(
    'comingSoon' => get_option('woocommerce_coming_soon'),
    'stripeTestMode' => $s['testmode'] ?? null,
    'livePublishableKeyFormat' => strpos($s['publishable_key'] ?? '', 'pk_live_') === 0,
    'liveSecretKeyFormat' => strpos($s['secret_key'] ?? '', 'sk_live_') === 0,
    'liveAccountAuthenticated' => !empty($account['id']) && empty($account['readFailed']),
    'chargesEnabled' => $account['charges_enabled'] ?? false,
    'payoutsEnabled' => $account['payouts_enabled'] ?? false,
    'detailsSubmitted' => $account['details_submitted'] ?? false,
    'currentlyDueCount' => count($account['requirements']['currently_due'] ?? array()),
    'liveStripeHooks' => $liveHooks,
    'liveHookReadFailed' => !empty($hooks['readFailed']),
    'stripeCapture' => $s['capture'] ?? null,
    'allowedCountriesMode' => get_option('woocommerce_allowed_countries'),
    'specificAllowedCountries' => get_option('woocommerce_specific_allowed_countries', array()),
    'shippingCountriesMode' => get_option('woocommerce_ship_to_countries'),
    'specificShippingCountries' => get_option('woocommerce_specific_ship_to_countries', array()),
    'shippingZones' => $zones,
    'registeredShippingMethods' => $nativeMethods,
    'taxesEnabled' => get_option('woocommerce_calc_taxes'),
    'manualTaxRateCount' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}woocommerce_tax_rates"),
    'automatedTaxesEnabled' => $wcConnect['taxes_enabled'] ?? $wcConnect['automated_taxes'] ?? null,
    'coreGuardLoaded' => function_exists('sless_core_us_only_is_restricted_product'),
    'publishedProductCount' => (int) wp_count_posts('product')->publish,
    'ordersCreated' => false,
);
echo 'SLESS_SAFE_JSON:' . wp_json_encode($out) . PHP_EOL;
