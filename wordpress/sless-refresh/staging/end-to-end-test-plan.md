# Checkout, delivery, and fulfillment verification

The owner requested a single end-to-end testing pass once setup is ready. This
replaces the earlier prohibition on all testing; it does not approve unspecified
real charges, production shipping, or public product publication.

## Gate the transaction test

Run `node scripts/src/check-sless-commerce.mjs` first. Resolve its blockers:

- WooCommerce Stripe test credentials and a test webhook must be configured.
- Reuse the existing Download Manager package; do not request another installer
  upload. Connect it to order-specific delivery and confirm unauthenticated requests
  cannot retrieve the installer. Force-download settings alone do not establish
  file protection, and password protection alone does not establish paid entitlement.
- Resolve paid-tier activation before claiming Pro/Studio feature delivery works.
- Check the active processing-order webhook. Prevent the test from reaching
  Printify production or triggering shipping/production billing.
- Obtain authorization for a purchasable test surface; current products are drafts.
- Use an approved customer email for actual email-delivery verification. Never
  invent a recipient or send test mail to unrelated people.

## One test pass after the gates are resolved

### Digital purchase

Use Stripe's documented test payment details in confirmed test mode. Observe:

1. Checkout succeeds and Stripe records the test payment.
2. The real webhook updates the corresponding WooCommerce order; do not mark an
   order paid through the REST API as a substitute for verifying payment.
3. The owner's new-order notification arrives.
4. The buyer receives the order email and download link without manual intervention.
5. The authorized link delivers the confirmed installer with the expected hash.
6. Requests without download permission cannot retrieve it.
7. No physical shipment or Printify production order is created for the virtual item.

### Physical fulfillment

For the applicable product routes, verify:

- Printify-managed items map to the correct product, SKU, artwork, variant, shipping
  address, and shipping charge. Inspect integration receipt/import with production
  approval held off. An imported order is not proof of successful shipment.
- Owner-shipped items produce the owner's notification and remain clearly assigned
  to manual fulfillment; they must not be sent to Printify accidentally.
- The three core shirts cannot ship outside the US, including mixed carts.
- Tracking and customer notification use the correct fulfillment source when an
  actual shipment is authorized. Never fabricate tracking to make a test pass.

## Real-money boundary

Stripe test payments do not credit real funds or verify a bank payout. A separate
approved live purchase is required to check actual payment capture and payout
eligibility/status. A real physical order can incur production and shipping costs.
Do not charge, approve Printify production, or ship until those costs and actions
are explicitly authorized. Never ask the owner to paste card details into chat.

Report each flow as passed, failed, or blocked with evidence. Do not describe
configuration checks, a screenshot, or a synthetic REST order as an end-to-end pass.
