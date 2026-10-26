# Merchandise launch gates

The owner authorized getting the remaining merchandise onto the store so sales can
start. Catalog sync and opening checkout are separate operations.

## Catalog

- The 50 additional products are represented in `merchandise-production-plan.json`
  and `merchandise-draft-receipts.json`.
- `scripts/src/merchandise/prepare-launch.mjs` audits current variant availability,
  prices, mockups, and print-file linkage. It never publishes or places an order.
- `scripts/src/merchandise/sync-catalog.mjs --apply --include-core` uses Printify's
  native publication operation for the 50 additional products plus the three
  original-shirt copies in the connected WooCommerce shop. It checks the core
  artwork, white sizes, and approved prices against the preserved originals.
- Actual native website IDs and product URLs belong in
  `merchandise-publish-receipts.json`. A request acknowledgment alone is not proof
  of successful synchronization. Never manually mark a publication succeeded.
- Native product synchronization does not change payment settings, open the
  storefront, or create/approve a production order.

## Store access and opening checkout

The owner explicitly authorized live merchandise sales with “turn it on” after
being told test mode and Coming Soon were still enabled. The launch operator
confirmed both settings now read `no`; the public shop displays all 53 products.
The chosen existing WooCommerce merchant keys were preserved. No order or charge
was created. The safe launch receipt is `merchandise-store-launch.json`.

The public `/shop/` page was observed showing WooCommerce's coming-soon message.
Authenticated WordPress REST requests from the workspace returned HTTP 202 HTML
with `sg-captcha: challenge`. Do not solve or bypass that hosting protection.
Direct SiteGround SSH and WP-CLI access is working using the owner's existing
saved credentials. Use `scripts/src/siteground-wordpress.mjs` for legitimate
server-side administration without disabling or bypassing the hosting CAPTCHA.
A blocked web REST request is not evidence that hosting administration is
unavailable. Do not send the owner back to hosting support instead of checking
the existing SSH connection.

Before opening sales:

1. Reconcile the native catalog mappings; do not create duplicate WooCommerce
   listings or repeat ambiguous publication requests.
2. Confirm current Stripe mode and the owner's live merchant connection. The
   server-side check on 2026-10-18 confirmed test mode is on and the configured
   WooCommerce live Stripe account cannot charge or pay out. The separately saved
    live Stripe key authenticates to a different account. The owner subsequently
    explicitly chose the account matching their supplied publishable key and the
    existing WooCommerce live secret. This supersedes their earlier selection of
    the separate saved-secret account. A fresh check confirmed this chosen account
    now has live charges and payouts enabled, no outstanding verification fields,
    and an enabled live WooCommerce webhook. Do not replace its live secret with
    the separate saved secret. Verify webhook signing and checkout before opening.
   `scripts/src/merchandise/check-native-live.php` performs read-only native checks.
3. Review the intended sale prices and estimated-fee assumptions; verify Printify
   billing/approval readiness, product-specific shipping charges, tax settings, and
   the original three shirts' US-only guard, including mixed carts.
4. Isolate real Printify production before payment tests. Do not test a public
   test-mode checkout that could trigger a real production bill.
5. Run the owner-requested checkout/notification/fulfillment test when ready,
   distinguishing test payments from actual capture and bank payouts.
6. Open the native merchandise store only after the real-payment and fulfillment
   checks pass. Preserve unrelated pages, homepage footage, expired promotions,
   SlessBox's closed paid tiers, and the original source artwork.
