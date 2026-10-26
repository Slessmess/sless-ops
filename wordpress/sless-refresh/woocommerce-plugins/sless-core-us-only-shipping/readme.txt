=== Sless Core Shirts — US-Only Shipping ===
Version: 1.0.0
Requires Plugins: woocommerce

Restricts the three original Sless shirts to United States shipping addresses.
The 18 current Printify variant SKUs are targeted, with matching parent shirt
titles as a fallback for regenerated variation SKUs.

== Installation ==
1. In WordPress, open Plugins > Add New Plugin > Upload Plugin.
2. Upload sless-core-us-only-shipping.zip and choose Install Now.
3. Activate Sless Core Shirts — US-Only Shipping.

No SSH access, new SSH key, or credentials in this package are needed.

== Behavior ==
* US shipping rates are left unchanged.
* All shipping rates are removed for non-US packages containing a core shirt,
  including mixed packages containing other products.
* Other merchandise rates are left unchanged.
* Classic cart/checkout shows a restriction error. The shipping-package filter
  also applies to WooCommerce's shipping calculations used by block checkout.
* The plugin does not calculate Printify rates, enable international destinations,
  change prices, publish products, accept payment, or create production orders.

== Verification ==
PHP syntax validation and 235 assertions of the actual plugin callbacks passed
in the workspace. These are isolated callback tests, not a live checkout test.

Before public sales, verify the installed plugin in the actual cart:
* A core shirt to the US retains available Printify rates.
* A core shirt or mixed cart to Canada has no available shipping method.
* A cart containing only additional merchandise retains rates wherever Printify
  supports that product and destination.
* The native checkout shows a clear restriction error for non-US core shirts.

Do not submit an order that could trigger Printify production without explicit
merchant authorization. To disable this rule, deactivate the plugin; doing so
removes the US-only safeguard, so keep core products unavailable internationally.
