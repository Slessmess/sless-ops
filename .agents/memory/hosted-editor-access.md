---
name: Hosted store editor access
description: Shared-browser access and non-obvious native Printify editor and publication behavior.
---

Missing product-API theme endpoints do not make native store editing owner-only.
Use an approved cloud browser with the owner signing in directly, and verify
the authenticated session and destination before editing.

**Why:** The connected cloud browser successfully operated the native builder.
Its generic editor URL initially selected a different, disconnected default shop.

**How to apply:** Verify the builder iframe's store identity, not merely the
outer URL. Never ask for pasted passwords or browser session cookies. Keep
banking, unrelated orders and advertising out of an editor-only session.

The native editor has a separate rendered-preview frame. Drag wrappers can
carry disabled accessibility metadata even when an inline rich-text editor is
enabled; newly mounted text editors may initially be noneditable.

**Why:** These states caused ordinary browser actions to stall despite editable
text being available.

**How to apply:** Target the actual preview. Selection can mount a read-only
textbox; a further ordinary double-click on that textbox enables editing.
Waiting alone may never change it. Fill only after verifying contenteditable is
true; do not force genuinely disabled controls.

Inspect an actual system-level screenshot when inline editing inexplicably fails.

**Why:** A native upload chooser remained open after the logo upload. It was
absent from DOM snapshots but obscured the editor. Closing it and activating the
selected textbox enabled footer editing.

**How to apply:** Dismiss stale system dialogs rather than repeatedly retrying
the same DOM action. Native Delete block confirmation uses an alertdialog,
which can hide otherwise available editor controls until answered.

Do not infer customer publication from the product API's `visible` flag alone.

**Why:** A native copied product returned visible=true while the dashboard said
Unpublished and the public storefront had no products.

**How to apply:** Reconcile native channel status and the public storefront before
claiming a product is live. Saving Store Builder design is separate from publishing
merchandise; verify the public catalog after either operation.

A kept-open native catalog can retain stale product search results after an
asynchronous cross-store copy finishes.

**Why:** The backpack existed and matched the original in a fresh API read while
the previously open search still showed no results.

**How to apply:** Reconcile through fresh paginated reads and a refreshed native
listing before treating a transfer as failed or retrying creation.

The owner approved the desktop/mobile shop design and a 46-product partial
launch after checkout checks, retaining the hold on three US-only originals
and seven selected sale items.

**Why:** The owner explicitly chose the smaller launch rather than waiting for
all 56 products; this does not waive seller verification or remaining return checks.

**How to apply:** Do not ask for the same design/catalog-scope approval again.
Do not release held items or enable routing before the remaining gates pass.

Native publication and customer visibility are separate operations for copied
hidden drafts. Reconcile external mappings and actual storefront visibility,
not just API `visible`, locks or accepted publication requests.

**Why:** Native bulk Publish created channel products but kept API-created drafts
Hidden; Show on Printify Pop-Up was needed separately. Both operations complete
asynchronously, sometimes after a short UI wait expires.

**How to apply:** Never blindly republish or repeat an uncertain visibility
request. Bulk selection is limited to 24 across pages. Use Recently added rather
than Recently updated for stable pagination while changing visibility.

Do not promise arbitrary product-page controls from the native Store Builder.
Inspect current controls before committing to custom purchase-button colors
or an additional direct-checkout button.

**Why:** The inspected builder exposed preset palettes and button shapes, while
its page-management panel marked page editing “Coming soon.” These controls did
not establish a way to customize product-page purchase actions.

**How to apply:** Verify actual product-page behavior, not just homepage button
previews. Report unavailable controls honestly; do not replace the storefront
or change checkout providers without owner approval.

Merchandise purchase-button changes must be on the Printify storefront itself,
not the WooCommerce shop.

**Why:** The owner corrected the proposed WooCommerce alternative: “we aren't
using that for the merch so unless you can put it on the printify page, it
won't do anything.”

**How to apply:** Keep merchandise improvements scoped to Printify. A change on
the WordPress/WooCommerce site does not fulfill a Printify shop request.

The native Stripe component can continue asking for sign-in even after seller
verification has completed in the owner's regular browser.

**Why:** The shared Stripe popup stalled at Loading, but the destination My
Products page independently confirmed account readiness for transactions and
payouts after the owner completed verification locally.

**How to apply:** Check the selected destination's native readiness banner before
asking the owner to sign in again. Do not confuse embedded-component
authorization with merchant verification status.
