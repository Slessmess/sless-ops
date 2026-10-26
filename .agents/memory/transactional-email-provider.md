---
name: Transactional email provider
description: Owner-confirmed mailbox hosting and sender setup boundaries.
---

Use the owner's existing SiteGround-hosted business mailbox for WooCommerce
order emails rather than introducing another email provider by default.

**Why:** The owner confirmed that their business mailbox is hosted through
SiteGround and selected it for order confirmations.

**How to apply:** Obtain mailbox credentials only through secure secrets tooling.
Use SiteGround's mailbox-specific outgoing server settings; SSH access is not
mailbox authentication. Do not treat a successful mail handoff as proof of inbox
delivery, and do not create another order or charge when resending a confirmation.
