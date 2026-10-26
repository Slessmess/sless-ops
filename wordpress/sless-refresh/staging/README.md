# SlessBox staging — not launched

Stripe's WooCommerce gateway is in verified test mode. Pro ($39 one-time) and
Studio ($79 one-time) are virtual product drafts. Separate AI, checkout, download,
and confirmation page drafts have been created without editing the existing
published pages. The expired giveaway remains unchanged and inactive.

The AI staging page links to the existing Sless Brand hosted Mailchimp signup form.
The audience's existing double opt-in is preserved. No members were added, no form
submission was tested, and no email campaign was sent. This is newsletter signup,
not an implemented confirmed-email-to-Lite-download entitlement.

The owner approved a draft feature split for Lite, Pro, and Studio. The draft cards and
WooCommerce draft descriptions now show those proposed benefits with an explicit
not-implemented warning. See `slessbox-tier-feature-proposal.md`. The available
installer has no source code in this workspace, so no app-level feature or license
unlock has been implemented.

## Existing protected installer

The current WordPress download page already contains native WordPress Download
Manager package 203, displaying SlessBox_Setup.exe at 3.31 MB. It is an owner-only
verification flow, and customer delivery is explicitly closed. The staging download
page reuses that native control; **do not request or perform a duplicate upload**.

The existing password-protected package is not yet mapped to WooCommerce paid-order
download permissions. Its actual file hash and unauthorized direct-file denial
have not been independently verified. Do not expose a public Media Library URL as
a workaround, open the existing owner-only flow, or remove its protection.

WooCommerce currently uses Force Downloads, disallows insecure redirect fallback,
and grants download permission after payment. These settings alone are not proof
that an uploaded file cannot be accessed directly.

## Still not verified or implemented

- Actual protected file storage and direct-access denial.
- Native package-to-paid-order delivery mapping.
- Confirmed-email-to-Lite-download delivery.
- Paid-tier activation, which the current published download page explicitly says
  is not implemented. The installer source is not in this workspace; do not claim
  Pro/Studio feature unlocking from a payment configuration check.
- Payment webhook/receipt and purchase-to-download behavior. The owner requested
  an end-to-end test once setup is ready; resolve the test-payment and fulfillment
  safety gates first. Real costs and public product publication are not approved.
- Public launch and final public checkout navigation.

Operational IDs and verification results are in `../slessbox-staging.json`.
The reusable `scripts/src/stage-slessbox.mjs` creates only drafts with `--stage`;
without that flag it checks the prepared configuration without provider writes.
Provider write failures must be reconciled before retrying.
