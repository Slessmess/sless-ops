# Sless Is More — WordPress draft redesign

## Scope and safety

Create nine NEW WordPress draft pages: Home, Wrestling, AI (SlessBox), Sless Store,
Fall Brawl 2025, Thank You, Download SlessBox, Checkout, Fall Brawl Winners.
Do not modify the live Home (page 51), Matches (page 79), menus, front-page
settings, theme, plugins, or existing posts.

Home's new draft slug is `home-redesign` to avoid replacing the published `/home/`.
Other slugs: `wrestling`, `ai`, `store`, `giveaway`, `thank-you`, `download`,
`checkout`, `winners`.

The user wants a bold, professional, modern dark site (#0a0a0a), white text
(#ffffff), gold accents (#FFD700), Anton or Oswald headlines, Inter or Roboto
body text. Preserve the actual wrestling footage and the site's energetic feel.
Make it easy for a new visitor to understand Wrestling, local AI, and apparel.
No emojis. No invented testimonials, follower counts, product claims, prices,
shipping destinations, booking contacts, or functioning checkout/download forms.

Every checkout, download, or form token must stay EXACTLY as requested and be
visibly inactive in these drafts. Use disabled buttons with `data-sless-placeholder`
attributes and a concise draft note, NOT bogus token hrefs. Internal navigation
uses `__PAGE_URL_home__`, `__PAGE_URL_wrestling__`, `__PAGE_URL_ai__`,
`__PAGE_URL_store__`, `__PAGE_URL_giveaway__`, `__PAGE_URL_thank-you__`,
`__PAGE_URL_download__`, `__PAGE_URL_checkout__`, `__PAGE_URL_winners__`.
The main agent will resolve these after WordPress page IDs are known.

## Existing assets / footage

The existing logo is media 15: https://slessismore.org/wp-content/uploads/2024/10/trainwithsless-01-1.png
Use the downloaded local reference in assets/logo.png.

Preserve the existing Home video:
https://slessismore.org/wp-content/uploads/2024/10/White-Dynamic-Bold-Video-Gallery-Adventure-Video.mp4
Video must have controls, playsinline, and a descriptive label. No forced sound,
no flashing, no autoplay that ignores reduced-motion preferences.

Existing match footage (these are real; do not invent replacements):
- https://www.youtube.com/watch?v=FFLYkAL6LEY — Sless vs Brandon Fields
- https://www.youtube.com/watch?v=S5tKcD3TunI — existing featured match
- https://www.youtube.com/watch?v=aPtE5BV5Vt4 — existing featured match
- https://www.youtube.com/watch?v=-F_9b0h3Fbw — existing featured match
- https://www.youtube.com/watch?v=JE1TDSQ7Erc — Sless & AVZ vs Fury & Soultaker - NWCW CyberWars
- https://www.youtube.com/watch?v=yZOkeWIibHw — Daniel Wolf VS Sless Taylor
- https://www.youtube.com/watch?v=fhWcEklvYUk — Sless Talk with guest Money Mike - SCW Easter Mayhem
- https://www.youtube.com/watch?v=DKCw2oQmVaQ — James Fury vs. Sless Taylor - Internet Championship - NWCW Fright Night Fights
- https://www.youtube.com/watch?v=wegI-iQwBtw — Alex Van Zant & Sless vs. NWCW Tag Team Champions Studio 86 - Tag Team Title Match - NWCW SHOWDOWN
- https://www.youtube.com/watch?v=-gkOM5xVJso — Sless vs. Father Marquis (C) - SCW Internet Championship Match - Heatwave

Use actual known links or iframe embeds, with descriptive titles and lazy loading.
The original raw pages are saved in source-pages.json for checking exact titles/IDs.

The user supplied a collage of the THREE actual shirt designs. Cropped real
product shots and lifestyle images are in assets. Image source tokens:
`__SHIRT_1_IMAGE__`, `__SHIRT_2_IMAGE__`, `__SHIRT_3_IMAGE__`,
`__SHIRT_1_LIFESTYLE__`, `__SHIRT_2_LIFESTYLE__`, `__SHIRT_3_LIFESTYLE__`.
Each cropped image shows the matching product, not a generic stock shirt.

## Home

User-required hero headline: SLESS IS MORE.
User-required two-column Wrestling / AI section and featured shirts.
Retain the original footage. Clear paths into Wrestling, AI, Store; approachable
brand introduction based only on verified identity: Sless Taylor, professional
wrestler; SlessBox local Windows AI; three Fall Collection shirts.

## Wrestling

Rework existing Matches content into an accessible, clear wrestling landing
page with actual video links/embeds and Sless Taylor identity. Keep a route to
the existing complete Matches archive at https://slessismore.org/matches/.
Do not invent championship wins, biography facts, booking dates, or contacts.

## AI — slug ai

Tagline: Your AI. Your Machine. One Click.

### SlessBox Lite — FREE

- Basic local AI model included (Mistral 7B or similar lightweight model)
- Runs 100% offline on Windows 10/11
- Unlimited chats, no subscription
- Community support only
- Free forever; free download to build the email list
- AI tier button token: STRIPE_LITE_URL

### SlessBox Pro — $39 one-time

- All top open-source models included (Llama 3, Mistral, Phi-3, etc.)
- One-click installer for Windows
- Commercial use license included
- Email support
- 1 year of free updates
- Main seller / flagship product
- Button token: STRIPE_PRO_URL

### SlessBox Studio — $79 one-time

- Everything in Pro
- RAG (upload your own documents, PDFs, notes, and chat with them)
- Priority email support
- Lifetime updates
- Button token: STRIPE_STUDIO_URL

All prices are one-time payments. No subscriptions. Ever.
14-day money-back guarantee on Pro and Studio.
Fall Brawl Bundle (shirt + SlessBox Pro): $69 and saves $45.

Include a comparison table with all three tiers side by side.
FAQ: Windows 10/11; 8GB RAM minimum, 16GB recommended; 10GB disk space.
Refund policy: 14 days on Pro and Studio. Commercial use: yes on Pro and Studio.
Do not change names/prices or invent additional included services.

## Giveaway — title Fall Brawl 2025, slug giveaway

Headline: End of Summer Sless Slam
Subhead: Win SlessBox Studio + all 3 shirts + $50 store credit.

Grand prize:
- 1x SlessBox Studio License ($79 value)
- All 3 Fall Collection shirts: NO INTRODUCTION NEEDED, STAY UNDENIABLE,
  BUILT DIFFERENT. PROVEN DAILY. ($75 value)
- $50 Sless Store Credit
- Total Value: $204

Runner-Up Prizes (3 winners):
- 1x SlessBox Pro License ($39 value)
- 1x Fall Collection Shirt of choice ($25 value)

Entry mechanics, clearly list exactly:
1. Join email list = 1 entry (free)
2. Follow on Instagram, TikTok, or X = 2 entries per platform
3. Buy any shirt = 10 entries
4. Get SlessBox (Pro or Studio) = 15 entries
5. Get the Fall Brawl Bundle (Shirt + SlessBox Pro = $69) = 25 entries

Mailchimp embed placeholder: MAILCHIMP_FORM_EMBED
Bundle button: STRIPE_BUNDLE_URL

Official rules section at bottom:
No purchase necessary. Void where prohibited.
Open to US residents 18+.
Runs October 1–14, 2025.
Winner selected randomly and notified via email.
Free entry method: Mail a 3x5 card with your name and email to:
Sless Brand, 117 Glenview Dr, Mansfield, OH 44907.
One entry per person per method.

User requested a glowing gold border or radial gradient around the prize hero,
and numbered cards/grid for entry methods.

Keep all 2025 dates EXACTLY as supplied. Add a subtle draft-review notice that
the supplied campaign dates are historical; don't imply entries are currently
open, and don't run timers.

## Store — title Sless Store, slug store

Headline: THE FALL COLLECTION
Subhead: Three shirts. One movement. Built different. Proven daily.

3-column product grid:
- NO INTRODUCTION NEEDED — $25
- STAY UNDENIABLE — $25
- BUILT DIFFERENT. PROVEN DAILY. — $25

Each: Unisex tee, black print on white.
Sizes: S, M, L, XL, 2XL (+$3), 3XL (+$5).
Each buy button token: STRIPE_SHIRT_URL

Gold-highlighted bundle:
FALL BRAWL BUNDLE — $69 (Save $45)
Any one shirt + SlessBox Pro.
Bonus: 25 giveaway entries.
Buy token: STRIPE_BUNDLE_URL

Digital products:
SlessBox Lite — FREE (email required) → MAILCHIMP_LITE_URL
SlessBox Pro — $39 → STRIPE_PRO_URL
SlessBox Studio — $79 → STRIPE_STUDIO_URL

Preserve the exact Save $45 claim; flag its inconsistency in the separate
launch checklist, not by silently changing the requested price/copy.

## Checkout — title Checkout, slug checkout

Exact primary copy: You are being redirected to secure Stripe checkout.
Most buyers click Payment Links directly from Store.
Prepare a product-to-token mapping for a future validated Stripe redirect,
but NEVER redirect to unresolved placeholders or arbitrary querystring URLs.
Clearly state in this draft that checkout isn't connected yet.

## Thank You — title Thank You, slug thank-you

Headline: YOU'RE IN.
Subhead: Check your Stripe receipt email. Your download password and next steps are inside.

Shirt: Your shirt ships within 3–5 business days. Tracking info will hit your inbox.
SlessBox: Click below to download. Your password is in your Stripe receipt email.
Bundle: Your shirt ships in 3–5 days. Your SlessBox download password is in your Stripe receipt.
Giveaway: You're entered in the Fall Brawl. Winner announced Oct 15.
Download SlessBox → Download page; Back to Store → Store page.
Treat this as confirmation-page draft copy, NOT evidence of a successful order.

## Download — title Download SlessBox, slug download

Headline: SLESSBOX DOWNLOAD
Subhead: Enter the password from your Stripe receipt email.
Requested copy: This page is password-protected. If you don't have your password,
check your Stripe receipt.
Requested copy: For security, this page is protected. Use the password from your
receipt to unlock.
Download button: SLESSBOX_EXE_URL. Filename: SlessBox_Setup.exe.

Do NOT build a custom login/password form. A WordPress password-protection plugin
(such as PPWP) will be configured later by the owner.
Include a very clear draft setup note: protection is NOT configured by these
draft pages. Do not imply the HTML content itself enforces access control.

## Winners — title Fall Brawl Winners, slug winners

Exact placeholder: Winner will be announced October 15, 2025.
Hidden from main navigation; leave as draft, publish only after winner is chosen.
No fabricated names or identities.

## SEO and implementation

Semantic HTML with one H1 per page, logical headings, useful specific body
copy, descriptive image alt text, responsive accessible navigation, keyboard
focus styles, adequate contrast, reduced-motion handling, no fake links.

Provide `seo-plan.json` with recommended SEO title, meta description, target
keywords, slug and index/noindex recommendation per page. Core page excerpts
will be populated, but no SEO plugin meta fields are exposed by this site's
REST API, so don't claim those recommendations were installed into <head>.

Produce `home.html`, `wrestling.html`, `ai.html`, `store.html`, `giveaway.html`,
`thank-you.html`, `download.html`, `checkout.html`, `winners.html` as embeddable
HTML fragments with self-contained scoped CSS. Include common navigation/footer
inside each page. WordPress template will be Elementor Canvas so the live
theme's old header/footer don't compete with the redesigned content.

No React build, no package installation, no service/workflow changes, no canvas
operations, no WordPress API calls. Main agent handles upload, insertion and
provider verification. Do not edit any application/backend files.