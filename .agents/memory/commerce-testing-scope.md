---
name: Commerce testing scope
description: Owner's requirements for checkout, notifications, immediate digital delivery, and physical fulfillment testing.
---

The owner asked: “run your own test once its all setup” to verify customers pay,
the owner receives money and notification, digital products reach buyers immediately,
and physical products are fulfilled by Printify or the owner as appropriate.

**Why:** The owner explicitly requested the complete buyer-to-fulfillment journey,
not just configuration checks, on 2026-10-08. This supersedes the earlier blanket
prohibition on test orders once setup and safety gates are resolved.

**How to apply:** Perform a coherent end-to-end testing pass when checkout is ready.
Do not claim a Stripe test transaction proves a real payout. Before a transaction,
isolate production fulfillment and obtain explicit authorization for real payment,
production/shipping costs, or product publication where needed. Verify digital
delivery, owner and buyer notifications, and product-specific physical routing;
do not assume every product has the same fulfillment source.

WooCommerce can render a generic “Your order has been received” message without
a valid order. That screen alone is not evidence of a purchase or payment.

**Why:** The anonymous order-received endpoint with an invalid order identifier
rendered the generic native message while no order or payment had been created.

**How to apply:** Use that route only for checking the public confirmation layout.
Verify a genuine order's protected details and payment/fulfillment records in the
separately authorized end-to-end test; do not expose order keys in screenshots,
logs or user-facing links.

Verify Printify's merchant-side production payment separately from the customer's
WooCommerce/Stripe payment.

**Why:** A real paid canvas purchase successfully imported into Printify but was
held as `payment-not-received`. Customer payment success did not establish that
Printify could charge the merchant for fulfillment. Printify's official payment
documentation confirms it cannot deduct production costs from WooCommerce
customer payments.

**How to apply:** Match the native Printify order's shop-order reference before
diagnosing an import failure or attempting a replacement. Report merchant billing
holds separately from storefront payment status; never submit or retry a
production charge without authorization.

The owner does not want Printify to debit their account when a customer orders
before the sale proceeds have reached their bank or become available in Stripe.

**Why:** The owner explicitly requested a cash-flow fix rather than funding
production from personal money while customer proceeds are unsettled.

**How to apply:** Prefer manual Printify order approval and release only after
the owner confirms usable sale proceeds. Explain the added fulfillment delay.
Do not enable immediate production, top-ups, or payment retries as a workaround.
Printify's documented approval changes apply to newly created orders; inspect
existing held/failed orders separately rather than promising retroactive safety.

For the proposed direct-payment flow, the owner said: “Someone buys on my site,
they don't go to printify site, they stay on my site, but printify gets the money
and starts the order.”

**Why:** The owner wants a simple on-site buying experience without advancing
fulfillment costs.

**How to apply:** Do not silently replace WooCommerce checkout with off-site
Printify links. Explain that a custom-domain Pop-Up Store is still a separately
hosted storefront, not embedded WooCommerce checkout, and obtain agreement to
that distinction before changing customer purchase routes or DNS.

The owner accepted the proposed branded Printify-hosted subdomain, conditional
on it looking like the main website and offering a way back to browse the
website's pages when shopping is finished.

**Why:** The owner answered: “yes, as long as it looks like my website and they
have a way to come back to my website and browse pages when they are done
shopping”.

**How to apply:** Preparation may proceed with that approach; retain the main
website. Match available brand controls, add prominent main-site navigation,
and verify the post-shopping return path. Do not promise exact custom theme or
checkout-completion customization that Printify's native builder has not proven.

Do not equate missing theme controls in the product API with an owner-only
manual editing requirement.

**Why:** An approved cloud-browser integration may allow the agent to operate
the native editor after the owner signs in, avoiding repeated screenshot steps.

**How to apply:** When editor takeover is requested, check available browser
integrations before declaring access impossible. Confirm the actual authenticated
session works before promising completion. Have the owner sign in directly;
never request passwords, session cookies or copied browser credentials in chat.

The customer-facing merchandise address must use the owner's domain, with
`shop.slessismore.org` as the approved destination, not a `printify.me` address.

**Why:** The owner reiterated: “It has printify in the url. I just want my web
domain. just like the shop.slessismore.org you said”.

**How to apply:** Explain that Printify assigns a default store address during
creation before the custom subdomain is connected. Treat that default address
as a setup identifier, not the proposed public purchase destination. Do not
switch website links to it while awaiting custom-domain verification.

The owner requested that all shop links on the main website go to the new shop,
that missing merchandise be included, and that the new shop match the main site
and link back to it.

**Why:** The owner explicitly requested the complete shop migration rather than
only preparing a separate store.

**How to apply:** Use the branded domain for physical merchandise navigation and
appropriate product links once readiness checks pass. Preserve unrelated pages,
digital delivery and existing order access. Do not treat staged routing code or
an empty hosted storefront as a completed cutover.

The owner accepted unpaid-only testing for the approved 46-product merchandise
cutover: “Switch shop links now; accept unpaid-only checks.”

**Why:** The owner explicitly accepted this boundary after being told actual payment,
final shipping/tax and completed-order return had not been verified.

**How to apply:** Do not treat those unverified paths as a blocker to this approved
partial routing launch, or claim they passed. The ten held products remain outside
this approval. Any real purchase or fulfillment charge still needs separate permission.
