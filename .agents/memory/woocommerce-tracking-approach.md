---
name: WooCommerce tracking approach
description: Reuse account assets through native WordPress integrations and avoid duplicate event senders.
---

Verify the hosted Printify shop separately from WordPress. Native Marketing
IDs and platform-internal cart logs do not establish merchant ecommerce event
delivery, and WordPress consent controls do not protect the hosted shop.

**Why:** Independent browser verification found merchant page views and cookies
before any consent choice, while internal cart/checkout logs did not correspond
to observed merchant GA4 or Meta ecommerce events.

**How to apply:** Capture requests for the owner's actual IDs in a fresh public
browser context before consent and through product/cart/checkout. Keep purchase
verification separate; never fabricate it. Public browser checks can proceed
without the authenticated store-editor browser provider.

Use the official WordPress Google and Meta connection flows to reuse the owner's
existing account assets before creating new ones. Prefer native WooCommerce event
integrations rather than adding parallel manual purchase-tracking snippets.

**Why:** The owner asked to find existing assets first. Native account selection
lets the owner authorize their accounts without sharing login credentials, while
duplicate event senders would distort purchase counts and retargeting.

**How to apply:** Keep one intentional sender per destination/event, with proper
browser/server deduplication if both are used. Do not combine Site Kit's tag
insertion, a manual equivalent, and a tag-manager equivalent unintentionally.
Prepared plugin files are not a connected account or activated tracking. Configure
consent and verify real event behavior before treating retargeting as ready.

Keep account authorization separate from turning on visitor tracking or Meta
catalog synchronization.

**Why:** Native setup flows can enable tags or product syncing as soon as OAuth
finishes. The owner authorizing an account does not by itself complete consent
setup or approve publishing unreviewed marketing content.

**How to apply:** Preserve the setup holds and inspect the effective native-plugin
settings after connection. A “setup successful” dashboard is not evidence that
purchase events, remarketing, consent or publication approvals are ready.

Meta's newer all-products rollout can bypass the ordinary “product sync disabled”
setting after account authorization.

**Why:** The native integration checks the account's all-products rollout before
the global sync option or its normal sync filter. OAuth can fetch enabled rollout
flags even when the pre-connection global setting was successfully held off.

**How to apply:** Include this rollout path in any catalog hold and verify the
effective integration behavior after OAuth or plugin upgrades, not just the saved
global option. Do not claim that no earlier sync happened based on its current
disabled state.

Use Google for WooCommerce for Google Ads purchase tracking and product integration,
while retaining Site Kit for GA4. Do not also enable Site Kit's Ads tag.

**Why:** The owner followed the WooCommerce connection path for this merchandise
store. Two Ads implementations could double-count sales; a saved WooCommerce Ads
connection also does not prove that GA4 and Ads are linked to each other.

**How to apply:** Check GA4-to-Ads linking separately from WooCommerce account setup.
Google for WooCommerce starts its own tag after saving a conversion action, so
the consent/setup hold must cover that sender independently of Site Kit.

Use category-specific opt-in worldwide. Keep Meta browser-only and advanced
matching off until server-side consent handling has been independently verified.

**Why:** Meta's attribution helpers can set `_fbp` in PHP or browser JavaScript even
when CAPI is off and the pixel script is blocked. An apparently clean network log
alone missed this. Google integrations can also whitelist shared scripts or assign
an Ads loader to the statistics category.

**How to apply:** Inspect response cookies as well as browser cookies and network
requests, including the statistics-only state. Check the final script categories,
not just plugin settings. Preserve the attribution-helper safeguards when updating
Meta or the consent plugin.

Do not mark a purchase as tracked merely because a blocked script was rendered.

**Why:** Google for WooCommerce writes its “already tracked” order marker before
the browser can accept or reject the script. Declining on the receipt page could
otherwise suppress a later consented conversion.

**How to apply:** Defer advertising purchase callbacks until marketing consent;
keep necessary checkout and payment callbacks untouched. Do not fabricate purchase
events or make real charges just to demonstrate that tracking is configured.
