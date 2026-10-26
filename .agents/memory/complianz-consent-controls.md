---
name: Complianz consent controls
description: Mobile consent reopening and silent banner-save permission checks.
---

Keep the native consent-management control visible on mobile as well as desktop.

**Why:** Complianz's default hover-only desktop setting hid the reopening control
after mobile visitors chose Deny. A complete shopper test found the problem.

**How to apply:** Preserve `show-everywhere` and verify that mobile visitors can
reopen preferences after denial. When saving via authorized WP-CLI, establish an
administrator execution context and reread the saved banner: the native save
method silently returns without the required management capability, even though
CSS generation can still run.
