---
name: Native merchandise publication
description: Partial supplier publication can update live copy while leaving blank or stale product images.
---

Native Printify publication can update WooCommerce titles and descriptions, clear
the featured image/gallery, and leave old variation thumbnails while the provider
still reports the publication as locked. Do not treat accepted publication,
updated text, or an existing external product ID as evidence that the storefront
is ready.

**Why:** A catalog refresh exposed this partial state across multiple listings.
Downloading the actual supplier mockups locally and importing their bytes over
the authenticated hosting connection repaired the images without relying on the
pending native image imports. The real native confirmations eventually arrived
without another publication request or forced unlock, so a 20-minute local
timeout was not evidence that the supplier operation had permanently failed.

**How to apply:** Check the visible featured image and every offered variation.
For an authorized repair, match existing variants by their real supplier SKUs,
preserve prices and options, and use supplier front-view metadata—including the
camera label when the generic position says `other`. Never synthesize publication
success or forcibly unlock the supplier products. A natively created product can
be identified by all its matching variation SKUs even before its publication
acknowledgement returns; keep that website observation distinct from provider
confirmation.

Native completion can replace a manually curated front-only gallery with the
supplier's full mockup set, including blank backs.

**Why:** The delayed native completion restored extra mockups after the website
photos had already been repaired.

**How to apply:** Recheck and, when authorized, reapply front-view gallery
curation after the provider confirms completion. Do not assume an earlier
website verification remains sufficient while native publication is pending.
