<?php
// Standalone tests of the actual plugin callbacks, without a WordPress database.
define('ABSPATH', __DIR__);
$hooks = array();
$notices = array();
$products = array();
$checks = 0;

function add_filter($tag, $callback, $priority = 10, $arguments = 1) {
    $GLOBALS['hooks'][$tag] = array($callback, $priority, $arguments);
}
function add_action($tag, $callback, $priority = 10, $arguments = 1) {
    add_filter($tag, $callback, $priority, $arguments);
}
function __($message, $domain) { return $message; }
function wc_get_product($id) { return isset($GLOBALS['products'][$id]) ? $GLOBALS['products'][$id] : false; }
function WC() { return $GLOBALS['woocommerce']; }
function wc_has_notice($message, $type) { return in_array($message, $GLOBALS['notices'], true); }
function wc_add_notice($message, $type) { $GLOBALS['notices'][] = $message; }

class GuardTestProduct {
    private $sku;
    private $parent;
    private $name;
    public function __construct($sku, $parent = 0, $name = '') {
        $this->sku = $sku;
        $this->parent = $parent;
        $this->name = $name;
    }
    public function get_sku() { return $this->sku; }
    public function get_parent_id() { return $this->parent; }
    public function get_name() { return $this->name; }
}
class GuardTestCart {
    public $items = array();
    public function get_cart() { return $this->items; }
}
class GuardTestCustomer {
    public $country = 'US';
    public function get_shipping_country() { return $this->country; }
}
class GuardTestErrors {
    public $errors = array();
    public function add($code, $message) { $this->errors[$code] = $message; }
}
function check($condition, $message) {
    $GLOBALS['checks']++;
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function package_for($country, $items) {
    return array('destination' => array('country' => $country), 'contents' => $items);
}

require dirname(__DIR__) . '/sless-core-us-only-shipping/sless-core-us-only-shipping.php';
$woocommerce = (object) array('cart' => new GuardTestCart(), 'customer' => new GuardTestCustomer());
$rates = array('printify_standard' => (object) array('cost' => 4.49), 'alternate_rate' => (object) array('cost' => 9.99));
$other = array('data' => new GuardTestProduct('ADDITIONAL-MERCHANDISE'));
$skus = sless_core_us_only_shirt_skus();
check(count($skus) === 18 && count(array_unique($skus)) === 18, 'Expected exactly 18 unique core SKUs.');

foreach ($skus as $sku) {
    $core = array('data' => new GuardTestProduct($sku));
    check(sless_core_us_only_filter_shipping_rates($rates, package_for('US', array($core))) === $rates, 'US rates must stay unchanged.');
    check(sless_core_us_only_filter_shipping_rates($rates, package_for('', array($core))) === $rates, 'An unset address must not be guessed.');
    foreach (array('CA', 'GB', 'DE', 'AU', ' ca ') as $country) {
        check(sless_core_us_only_filter_shipping_rates($rates, package_for($country, array($core))) === array(), 'All rates must be removed abroad.');
        check(sless_core_us_only_filter_shipping_rates($rates, package_for($country, array($other, $core))) === array(), 'Mixed carts must not bypass the rule.');
    }
}
foreach (array('US', 'CA', 'GB', 'DE', 'AU', '') as $country) {
    check(sless_core_us_only_filter_shipping_rates($rates, package_for($country, array($other))) === $rates, 'Other merchandise rates must remain unchanged.');
}

foreach (sless_core_us_only_shirt_titles() as $index => $title) {
    $id = $index + 1;
    $products[$id] = new GuardTestProduct('', 0, $title);
    $replacement = array('data' => new GuardTestProduct('REGENERATED-SKU', $id));
    check(sless_core_us_only_filter_shipping_rates($rates, package_for('CA', array($replacement))) === array(), 'Parent title fallback must cover regenerated variation SKUs.');
}

$woocommerce->cart->items = array(array('data' => new GuardTestProduct($skus[0])));
$cases = array(
    array(array('ship_to_different_address' => 0, 'billing_country' => 'CA', 'shipping_country' => 'US'), true),
    array(array('ship_to_different_address' => 0, 'billing_country' => 'US', 'shipping_country' => 'CA'), false),
    array(array('ship_to_different_address' => 1, 'billing_country' => 'US', 'shipping_country' => 'CA'), true),
    array(array('ship_to_different_address' => 1, 'billing_country' => 'CA', 'shipping_country' => 'US'), false),
);
foreach ($cases as $case) {
    $errors = new GuardTestErrors();
    sless_core_us_only_validate_checkout($case[0], $errors);
    check(!empty($errors->errors) === $case[1], 'Validation must use the actual selected shipping address.');
}
$woocommerce->customer->country = 'CA';
sless_core_us_only_show_cart_notice();
sless_core_us_only_show_cart_notice();
check(count($notices) === 1, 'The restriction notice should not be duplicated.');
$notices = array();
$woocommerce->customer->country = 'US';
sless_core_us_only_show_cart_notice();
check(count($notices) === 0, 'US customers must not get a restriction notice.');
$woocommerce->cart->items = array($other);
$woocommerce->customer->country = 'CA';
sless_core_us_only_show_cart_notice();
$errors = new GuardTestErrors();
sless_core_us_only_validate_checkout(array('billing_country' => 'CA'), $errors);
check(count($notices) === 0 && count($errors->errors) === 0, 'Other merchandise must not get blocked.');
check($hooks['woocommerce_package_rates'][1] === 1000, 'Shipping filter must run after rate methods.');
check(isset($hooks['woocommerce_after_checkout_validation']), 'Classic checkout validation must be registered.');
echo "PASS: {$checks} assertions against the actual PHP callbacks.\n";
