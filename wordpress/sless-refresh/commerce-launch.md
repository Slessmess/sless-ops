# Sless merchandise launch status

## Verified setup

- WooCommerce is installed and active on `https://slessismore.org`.
- Printify for WooCommerce is installed and active. Its shipping method is registered and calculates live rates by product SKU and destination. The three core shirt copies have non-US rates in Printify, so the plugin alone will not enforce the owner's US-only rule for those shirts.
- WooCommerce Stripe Payment Gateway is installed and active. The owner confirmed a Stripe test-mode checkout on 2026-10-07; no checkout was submitted from this workspace and no real payment was made.
- Currency is USD. WooCommerce tax calculation is enabled and based on the customer's shipping address; the shipping destination setting is `shipping`. The WooCommerce Tax plugin is active. The owner confirms its WordPress.com connection, Stripe test-mode checkout and Printify production billing are ready.
- Read-only WooCommerce checks show no published products and one default shipping zone with no zone-specific methods. The Printify plugin dynamically registers its live-rate method for Printify packages, so the empty zone method list alone does not prove that plugin rates are unavailable; live cart rates remain untested.
- The existing front-page setting was preserved during setup, and the public homepage was visually checked afterward.
- Native WooCommerce pages exist at `/shop/`, `/cart/`, `/checkout-2/`, and `/my-account/`.
- The preexisting static Checkout page was not overwritten. Use WooCommerce's configured checkout URL rather than assuming `/checkout/`.
- `merchandise-assortment.json` contains exactly 50 additional products, with unique SKUs and blueprint IDs checked against the current Printify catalog.
- The three existing Printify products match the approved shirt names and must not be duplicated.
- Native Printify connection is confirmed. The connected shop now contains 53 unpublished drafts: three preserved core-shirt copies plus 50 additional merchandise products. The original disconnected shop still contains its three shirts.
- WordPress and WooCommerce now report HTTPS for both home and site addresses.
- The additional assortment contains 35 year-round products and five each for Halloween, Thanksgiving and Christmas, with original Sless artwork. All 50 drafts have verified variants, uploaded-artwork links, actual production-cost data and catalog shipping quotes.
- Of the 50 additional drafts, 14 have dated, current single-item consumer retail benchmarks. Those price proposals target $2 below the comparator, or its delivered price when shipping is known, unless the Printify production-cost and estimated-fee floor is higher. The other 36 retain their earlier cost-plus proposals because a sufficiently similar current offer was not verified; that does not establish that no cheaper offer exists. Comparator limits and shipping evidence are recorded in `reports/sless-merchandise/verified-retail-benchmarks.json`. The 3.5% + $0.50 payment-fee allowance is an estimate, not a verified Stripe fee. No additional prices are approved for public sale.
- The public `/shop/` still displays WooCommerce's coming-soon screen, and WordPress has zero merchandise products. No products were published and no orders or charges were placed.
- The refreshed artwork proof report and draft-assortment CSV are in `reports/sless-merchandise/`, alongside the dated benchmark record. Operational provider/artwork data and draft receipts are under this directory.
- The owner approved a server-side US-only checkout rule for the three core shirts. The WordPress plugin is prepared under `woocommerce-plugins/sless-core-us-only-shipping/`; PHP syntax validation and 235 assertions against the actual callbacks pass. Its 18 SKUs match the current core variants and do not overlap the 50 additional products. On 2026-10-07, authenticated WordPress REST confirmed the installed plugin, version 1.0.0, is active. Live cart behavior remains unverified because there are no published merchandise products.
- WooCommerce core shipping zones select methods by customer location, and shipping classes adjust method rates; neither provides per-product country restrictions. WooCommerce's separate Conditional Shipping and Payments extension supports product-level destination rules, but it is not installed.
- During the WordPress deployment investigation, Code Snippets 3.10.2 was installed and activated, then deactivated after its API exposed four saved snippet records. Their contents were not inspected or changed. The plugin remains installed but inactive to preserve those records; no Sless shipping guard snippet was created.

## Not completed

This is not yet a purchase-ready store. All 53 Printify drafts are prepared, but WooCommerce has no published merchandise, live shipping rates have not been tested in a cart, the active core-shirt US-only guard has not been validated against a live cart, and no end-to-end order/fulfillment path has been verified.

1. **Catalog transfer:** Complete. The three core copies have verified original artwork/placement, six white-shirt sizes and the approved $25/$28/$30 prices. Do not delete originals or create another store connection.
2. **Merchant settings:** The owner confirmed the WooCommerce Tax connection. WooCommerce tax calculation is enabled and based on the shipping destination. Confirm the business address, shipping destinations and store policies; do not invent these details or enable unsupported payment methods.
3. **Payments:** The owner confirmed Stripe test-mode checkout and Printify production billing readiness. The plugins are active, but this workspace has not submitted an order. Verify webhook/payment status, refund behavior, and order synchronization before public sales. Do not submit any test or paid order that could enter Printify production without specific authorization.
4. **Artwork and variants:** Original core artwork is unchanged. New artwork/variants are prepared and linked to all 50 drafts. Review actual product mockups, provider placement/digitization and physical-print expectations. One oversized tee currently has only a medium/Vintage White option exposed by its selected provider's catalog; do not imply a full size range.
5. **Prices:** Keep the three approved shirt prices and size upcharges. Review the proposed additional prices and dated benchmarks; recheck sale offers before launch, and find comparables for the 36 unbenchmarked products. Confirm actual payment fees, production taxes, shipping/country eligibility and margins. The report is not a live offer.
6. **Shipping and synchronization:** The owner wants additional merchandise available wherever Printify ships, while limiting the three core shirts to the US. WooCommerce core zones and shipping classes cannot enforce that product-specific split, and Printify currently returns non-US rates for the core SKUs. The custom guard is now installed and active; test the live rate/checkout behavior when merchandise is published through the normal launch flow. Do not publish a product or place an order solely to test shipping. Then verify product-specific shipping totals, external IDs, paid-order import, fulfillment status and tracking. A Printify `visible` flag is not proof of public website publication.
7. **Publication:** Build/link the public storefront and seasonal collections using the prepared drafts, then disable store-only coming-soon mode only after buyer-flow checks. Preserve unrelated homepage footage and content. Leave expired Fall Brawl 2025 offers and inconsistent bundle savings offline until the owner supplies corrected facts.

## Official connection references

- https://help.printify.com/hc/en-us/articles/4483637152401-How-can-I-connect-my-WooCommerce-store-to-Printify
- https://help.printify.com/hc/en-us/articles/4483635992081-How-do-I-set-up-shipping-with-WooCommerce-
- https://woocommerce.com/document/setting-up-shipping-zones/
- https://woocommerce.com/document/product-shipping-classes/
- https://woocommerce.com/document/woocommerce-conditional-shipping-and-payments/
