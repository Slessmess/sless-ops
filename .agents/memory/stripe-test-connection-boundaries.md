---
name: Stripe test connection boundaries
description: Keep the owner's approved live merchant account separate from provisioned test connections.
---

Before asking the owner for Stripe test keys, check the existing connected
integration. It may already provide a usable test environment even when
WooCommerce has only live credentials configured.

**Why:** WooCommerce's test-mode toggle was enabled but its test keys were empty.
The connected Stripe integration was already a test environment and could be
connected without another owner credential request.

**How to apply:** Verify actual Stripe mode with the balance object's `livemode`
flag; empty product lists and the account object do not establish mode. Relay
verified test credentials only within the runtime to WooCommerce's supported
test-key configuration. Never print credential values, replace live keys, or
assume that a separate integration test environment proves live merchant payouts.

Use the Stripe account matching the owner's supplied live publishable key and
the existing WooCommerce live secret key for merchandise sales.

**Why:** After the key was verified as belonging to the previously configured
WooCommerce account, the owner explicitly said “That's the one I eant to use.
Try it now.” This supersedes the earlier choice of the separate saved-secret
account.

**How to apply:** Preserve that merchant-account choice. Verify the actual account,
matching live publishable credentials, and webhook before enabling live checkout.
The installed integration's test keys do not substitute for this live connection.
Do not replace the WooCommerce live secret with the separate saved live secret
merely because that other account was previously reported active. Recheck current
readiness rather than treating an earlier disabled status as permanent.

Read both pending and available Stripe balances when tracing a paid order, and
accept the merchant API's legacy top-level `payout_schedule` response.

**Why:** This merchant's API returned the payout schedule at the top level, not
under `settings.payouts.schedule`. A negative available balance can also coexist
with positive unsettled sale proceeds; the available balance alone did not
establish that a paid order's funds were missing.

**How to apply:** Trace the order's captured charge to its balance transaction,
fees, availability timestamp, refunds/disputes and payouts. Do not equate the
availability timestamp with guaranteed bank-deposit time, or interpret a missing
nested schedule field as disabled payouts.
