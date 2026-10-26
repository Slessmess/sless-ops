---
name: WordPress rendered-content verification
description: Why confirming saved draft metadata is insufficient when the page builder caches rendered HTML.
---

Verify the actual rendered content after a page-builder draft revision, not just
the saved raw content, status, or builder metadata.

**Why:** Saved WordPress content and Elementor metadata correctly reflected revised
shirt image assignments and a video poster, while rendered HTML still served the
previous image assignments and omitted the poster. A supported generated-cache
refresh made the visible content match the saved draft.

**How to apply:** Compare critical rendered details against the approved content.
If saved and rendered versions diverge, inspect the current builder's REST route
inventory for its supported cache operation, refresh generated cache, and check
the rendered result. Cache regeneration is not publication; nevertheless verify
the live homepage and front-page settings remain unchanged.

Check the current remote plugin controls before concluding a service or installer
is absent from old local drafts.

**Why:** Local download sources still said the installer was unavailable while the
current WordPress page already rendered a protected native Download Manager package.
Requesting another upload from the local placeholder alone was unnecessary.

**How to apply:** Reuse existing native protected controls and preserve owner-only
release gates. Do not equate a protected password control with paid-order entitlement,
and do not infer paid-tier activation from an installer being present.