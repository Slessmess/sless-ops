# Branded Printify shop preparation

## Owner-approved direction

Use a separate Printify-hosted merchandise storefront at the proposed address
`shop.slessismore.org`, retaining the existing main WordPress website.
The owner accepts this only if it looks like the main website and shoppers
have clear links back to browse its pages after shopping.

This is preparation, not permission to silently change live purchase routes,
DNS, existing orders, or production billing.

## Native setup required from the owner

The owner created the destination store, and the custom subdomain subsequently
resolved to Printify and returned HTTP 200. Its connected identity is recorded
in the companion JSON. Do not repeat store creation or reset verification.
The following setup directions remain reference only for a future replacement:

In Printify, open **My Stores → Add new store → Pop-Up Store**.
Use **Sless Is More** as the display name if available; confirm the actual
assigned store URL rather than guessing it. Leave products unpublished during
preparation and do not disconnect or rename the current WooCommerce store.
Complete seller identity/bank verification only inside Printify's secure flow.

Printify's documented API lists existing shops; its published shop endpoints
do not create a Pop-Up store or complete native seller verification.
After creation, recheck accessible shops and API capabilities before promising
automated catalog or Store Builder changes. Native dashboard steps may be needed.

The destination accepts API creation of `visible: false` products. The
`copy-popup-drafts.mjs` operator copies only approved mapped source products,
verifies their enabled variants, artwork and prices, and keeps them hidden.
Copy receipts persist separately in `printify-popup-drafts.json`. Source prices
are preserved; the seven website-only discounts remain explicit publication
review items. Copying drafts is not public publication or approval of checkout.

### Current copy boundary

All 56 destination copies were verified: 54 API-created drafts and
the journal and backpack recovered with native single-product copying. The
owner-approved 46-product partial catalog is now live; ten products remain held.
All passed
enabled-variant, artwork and supplier-price checks. The shorts additionally passed an exact-asset/layer check
using actual supplier variant template dimensions: the maximum translation
difference was below one twentieth of a template pixel. Source geometry was not
edited. The journal's source metadata still omits a separator color, but native
copying succeeded without guessing it and its source/destination checks match.
Before publication its API `visible` flag was true while its native channel
status was Unpublished and the public shop did not list it. Do not equate that
API flag alone with publication. It is now included in the approved live catalog.
The earlier API rejection of the backpack's provider remains historical evidence,
not a current blocker: the native transfer preserved provider 10, blueprint 413,
all original artwork and prices. It remained Unpublished until the owner-approved
partial release and is now live.

The remaining catalog has been attempted; there is no unattempted backlog.
The delayed backpack transfer was reconciled through a fresh paginated API read
and a refreshed native destination listing, without retrying the copy.
Never substitute a provider or guess manufacturing details. Native copying/review
resolved those two exceptions. No source product, existing order or public
customer purchase route was changed by this preparation.

The guarded `sless-popup-routing` WordPress plugin is enabled following explicit
owner acceptance of unpaid-only checks. It rewrites merchandise links in rendered page/Elementor content,
menus, native category/product permalinks and legacy store routes when enabled.
It preserves digital pages and order/account endpoints, blocks new legacy
physical checkout after cutover, and does not delete existing cart contents.
Old WooCommerce carts cannot transfer into the separately hosted shop.
The hosted cart is a drawer, not a `/cart` route; do not invent that URL.

The owner connected a cloud browser and signed into Printify directly.
Native Store Builder branding was saved: existing logo, visible Sless Is More
name, dark theme, Oswald display/Roboto body typography, gold hero text on
#0a0a0a, branded heading/copy, and all four external return-navigation links.
Initial public HTTP/HTML checks and a screenshot confirmed these design changes
while the public catalog was empty. The native mobile preview was checked at 375px.

Both responsive footers now say © 2026 Sless Is More. A stuck native upload
window was dismissed; activating the selected inline textbox again made it
editable. The generic platform-home social icon blocks were removed in both
layouts through native block controls and their confirmation prompts. Terms and
privacy links were preserved and verified publicly. Mobile navigation exposes
all four return links, the empty cart closes back to the store, and the 390px
layout has no horizontal overflow.

The owner approved the desktop/mobile design and a 46-product partial launch,
conditional on checkout checks. The other ten products remain held. The earlier
design previews showed an empty grid; the new live desktop review shows products.

### Approved partial publication

All 46 approved products have native channel mappings, public branded-domain
product URLs, visibility enabled and no pending publication locks. The ten held
products have neither visibility nor channel mappings. Enabled variants and
approved supplier-retail prices match all 122 variants; 191 supplier mockups are
present. Native publishing preserved individual product details. API-created
drafts required the separate native **Show on Printify Pop-Up** action after
publication; channel publication alone left them Hidden.

The reconciliation operator `scripts/src/merchandise/reconcile-popup-publication.mjs`
uses external reads only and updates local receipts after exact scope, mapping,
variant-price and mockup checks. Native bulk selection is limited to 24;
Recently added sorting prevents visibility updates from changing pagination.

### Remaining publication gates

- The three original shirts remain unpublished: no equivalent buyer-country
  restriction was exposed by the reviewed native store, order or publishing
  settings. Do not claim that proves a universal platform limitation, and do not
  drop the existing US-only rule.
- The seven selected sale products remain unpublished. Official documentation
  and the native promotion form offer a storewide eligible-variant percentage,
  rather than selecting just these seven. The native calendar says midnight
  GMT; that does not reproduce the approved October 25, 2026 Eastern deadline.
  No promotion was activated and no supplier prices were changed.
- The owner approved the 46 other verified products for a partial launch after
  checkout checks. This does not authorize releasing the ten held products.
  The held sale items may be reconsidered after their approved sale actually
  expires.
- Seller verification is confirmed. After the owner signed in using their regular
  browser and reported completion, native destination My Products independently
  displayed **All set! Your account is verified and ready to go** and explicitly
  said the store is ready for transactions and payouts. The shared-browser Stripe
  popup's earlier loading failure was not an account verification failure.
  No banking configuration was changed and no transaction was submitted.
- The live product page loads its primary artwork and exposes all four mobile
  main-site links. An initially empty isolated cart accepted one backpack at
  $78.00 with a displayed total of $87.19. Checkout reached its Contact step and
  showed Shipping, Payment and Review navigation. No customer or payment details
  were entered. The checkout store-logo link returned to the shop with the cart
  intact; the test item was removed and the actual main-site link opened the
  correct domain. The 390px layout has no horizontal overflow.
- Actual payment, final shipping/tax and the protected completed-order return remain
  unverified. The owner explicitly chose **Switch shop links now; accept unpaid-only
  checks**. This authorizes routing, not a transaction. Do not infer payment,
  payout, fulfillment or completed-order behavior from the unpaid Contact screen.

Main-site cutover is enabled with 46 verified product mappings. Native configuration
checks passed for 56 routing/preservation assertions. Before/after fingerprints
confirmed no changes to orders, sessions, page content, prices or artwork. Live
HTTP checks confirmed homepage links, legacy shop redirects, mapped product
redirects and unchanged AI/account routes. No advertising, purchases or fulfillment
were triggered. The ten held items remain unpublished.

## Visual direction and return navigation

Match the existing approved logo, black/dark surfaces, gold accent, cream text,
and bold display typography using the Store Builder's available controls.
Prefer Anton if available; do not promise custom CSS or exact theme reproduction.
Use desktop and mobile previews for owner approval before customer cutover.

The companion JSON contains actual website logo and navigation URLs plus live
catalog mappings. Place **Back to main website** prominently in the header,
with the existing Wrestling, SlessBox AI and Giveaway links when available.
The native builder supports URL items linking to external pages.

Verify the return journey from product pages, the cart, and the completed-order
screen. Do not promise that hosted checkout allows a custom completion button
or an automatic redirect until the native interface proves that capability.

## Catalog and checkout safeguards

- Copy only mapped, published physical merchandise; exclude unpublished proofs.
- Preserve the original three shirt designs and all approved artwork/geometry.
- Verify every enabled variant, mockup and actual checkout price after copying.
- WooCommerce-only sale prices/expiry are not copied by supplier product cloning.
- The three original shirts' US-only restriction lives in WooCommerce; reproduce
  an equivalent restriction in the new store or withhold those items.
- Never change supplier prices to implement an unapproved promotion.
- Use the real DNS record supplied by Printify for **shop** only. Do not point
  the root domain away from WordPress or modify unrelated mail records.
- Recheck checkout privacy, consent/tracking, taxes, support and refund wording.
- Pop-Up earnings generally pay monthly; this removes production prefunding,
  not payout delay. Stripe still operates behind Printify's payment flow.
- A paid WooCommerce order does not transfer automatically to the Pop-Up store.
  Do not duplicate or refund existing orders without separate authorization.
- Do not submit a test purchase, retry payment, or incur production charges.

## Official references

- Create store: https://help.printify.com/hc/en-us/articles/12051515136529
- Copy products: https://help.printify.com/hc/en-us/articles/4483625856017
- Store Builder: https://help.printify.com/hc/en-us/articles/42021298071825
- Navigation URL items: https://help.printify.com/hc/en-us/articles/45500951036561
- Custom domain/subdomain: https://help.printify.com/hc/en-us/articles/37642370602897
