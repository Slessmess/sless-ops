# Remaining project work

## Marketing launch preparation

The owner chose to defer hosted-shop tracking fixes and proceed with marketing
preparation. Tracking remains unresolved; this is not a retargeting-readiness
claim or permission for paid advertising.

The October 21 public audit found all 46 live product URLs returning HTTP 200
with cart controls. Eight older campaign destinations were checked: seven
shirt-specific links now resolve to the general shop, and the combined-campaign
link reaches the main website. Do not reuse the old sale creative for these
withheld products. No prices, discounts, artwork or shipping holds were changed.

A replacement review-only organic launch pack contains three verified live
products (Halloween canvas, Thanksgiving coaster, Christmas pillow), six
feed/Story images, platform captions, direct tagged links, alt text and staggered
posting instructions. It is in `generated-artifacts/live-shop-launch/`.
The owner explicitly approved all three new posts for staggered organic posting.
Exact asset and caption hashes are recorded in `live-launch-approval.json`;
material changes require fresh approval. Posting remains held until access is
verified and existing schedules are reviewed.
Stories require adding a real native link sticker; image text is not a link.

 The replacement saved credential successfully resolves the Sless Taylor Page
 with content-creation access and granted Page publishing permissions. Read-only
 review confirmed seven old sale posts still scheduled for October 22–25 and five
 old campaign posts reported published. Cancellation of the seven schedules
 requires owner authorization; published posts remain untouched. The owner chose
 to keep all seven schedules unchanged and hold the replacement campaign on both
 platforms. Creative approval does not override this publication hold. See
 `facebook-launch-access-review.json`. Anonymous public visibility is unverified.
 Instagram's saved credential successfully resolved the expected account during
 the earlier read-only access check.
No posts were published, scheduled, deleted or edited by this preparation.
See `marketing-launch-audit.json` for the public and provider checks.

## Operations task intake

Implemented `/operations`, native admin-only `POST /api/tasks`, all five operation
types, pending-only creation, idempotent retries, validation, list refresh,
explicit execution confirmation and request-changes handling. All 23 backend
tests and the full workspace typecheck pass. The browser verified signed-out
redirects, ordinary-user denial, API 403 protection, desktop and 390px layouts.

The owner's supplied email is configured in the shared operations-admin email
allowlist. Access requires a matching verified primary email, resolved server-side
in the running Clerk environment; unrelated signups remain denied. The existing
ID allowlist remains supported. All 26 backend tests and API typecheck pass.
The supplied email did not match an existing development Clerk account during
lookup; the owner must sign up/sign in and verify it normally. Privileged browser
creation has not been tested. This change is not yet published.

## Protected SlessBox delivery

The owner-approved 0.1.4 attachment is byte-verified and staged privately as a
ZIP containing the unchanged EXE. Existing draft Pro and Studio products now
use native WooCommerce downloads, force delivery, five-download limits and
30-day link expiry. Prices, descriptions and draft statuses were preserved.
Unauthorized download and draft public-product requests returned 404, not bytes.

**Paused by owner:** Source was supplied and inspected, but actual Pro/Studio
features and licensing remain unimplemented/unverified. Digital checkout belongs
on the main site with Stripe, not Printify. Lite's older private configuration
still points at a different installer and remains test-only. Do not enable that
delivery path or claim customer signup/delivery is finished. Existing SiteGround
SMTP installation and protected Download Manager package are preserved.

## Google/Meta shopping measurement

Existing WooCommerce sandbox event verification is recorded in
`commerce-e2e-verification.json`. It is not evidence of hosted-shop events.
Printify's supported Marketing settings accept GA4 and Meta Pixel IDs:
https://help.printify.com/hc/en-us/articles/14813624741393-How-can-I-set-up-marketing-tools-for-my-Pop-Up-Store

The owner saved the existing IDs in native Marketing settings. Both now appear
in public homepage and product HTML. An independent browser check without KERNEL
confirmed owner GA4 and Meta page views on homepage, product and checkout.

**Not complete:** Merchant GA4 product/cart/checkout events and Meta
ViewContent/AddToCart/InitiateCheckout were not observed. Printify's internal
cart/checkout logs are not equivalent evidence. Tracking requests and cookies
appeared before any consent choice; no banner, reject or preferences controls
were observed. Recommended removing the IDs until consent and event support
are resolved; no settings were changed by the agent. Purchase tracking remains
intentionally unverified. No customer details or payment were entered, and the
test cart item was removed. See `hosted-shop-tracking-verification.json`.

Authenticated native editor access still requires restoring KERNEL or another
authorized session. Public-browser verification does not require KERNEL.

## Halloween products

Source WooCommerce shirt and original canvas are published with primary images,
galleries and enabled variants. The canvas is live in the branded shop and its
legacy product URL redirects to its exact destination product.

**Release boundary:** The shirt is among seven selected-sale products withheld
from the new hosted shop because its existing discount and October 25, 2026
23:59:59 Eastern expiry cannot be reproduced by the reviewed storewide promotion.
Three other original shirts remain withheld for US-only destination restrictions.
Do not bypass these holds, alter supplier pricing or infer that an existing
published WooCommerce record is currently purchasable through migrated routing.
