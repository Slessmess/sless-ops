---
name: Storefront promotions
description: Keep temporary customer discounts separate from supplier prices, artwork publication, and timezone assumptions.
---

Run temporary customer promotions through WooCommerce sale prices and preserve
the regular prices. Do not republish Printify artwork or change supplier product
pricing merely to apply a storefront discount.

**Why:** The storefront determines what customers pay; supplier publication is
asynchronous and can overwrite carefully curated product images. Promotion work
must not disturb approved artwork, physical print size, or manufacturing.

**How to apply:** Check all enabled size/color variants against current supplier
production costs, retain regular prices, schedule expiry, and verify actual cart
prices without submitting an order or payment. Any fee allowance is an estimate,
not a verified processor charge or guaranteed profit.

Use the explicitly approved customer-facing timezone for promotion deadlines,
not the WordPress site's timezone.

**Why:** WordPress was configured at UTC while the owner approved an Eastern-time
deadline. Interpreting that deadline as UTC would end the sale four hours early
during daylight-saving time.

**How to apply:** Build the deadline using the named timezone and store its epoch
timestamp. Leave the global site timezone unchanged. Verify that the native
expiry callback is registered and that an expiry event is scheduled.
