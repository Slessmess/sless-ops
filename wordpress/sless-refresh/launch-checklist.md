# Sless Is More draft launch checklist

- [x] Resolve all `__PAGE_URL_*__` internal page URL tokens in the uploaded drafts after page IDs and slugs are verified.
- [x] Replace shirt image tokens using the supplied numbering without swapping assets: 1 = NO INTRODUCTION NEEDED, 2 = STAY UNDENIABLE, 3 = BUILT DIFFERENT. PROVEN DAILY. (same numbering for lifestyle images).
- [x] Confirm logo media URL and image availability in the WordPress media library.
- [ ] Replace owner-only draft-preview navigation URLs with final public permalinks when launch is authorized.
- [ ] Keep all payment, signup, download, and form placeholders disabled until real provider destinations and forms are configured.
- [ ] Resolve the fixed Checkout product mapping (`lite`, `pro`, `studio`, `shirt`, `bundle`) only to approved Stripe Payment Links. Verify configured links use HTTPS, exact origin `https://buy.stripe.com`, a nonempty payment path, and no username/password; never redirect based on an arbitrary query-string URL.
- [ ] Configure the password-protection plugin on Download SlessBox and separately secure the installer before publishing. HTML alone does not protect the file.
- [ ] Confirm campaign status before publishing Fall Brawl 2025: the supplied October 1–14, 2025 dates are historical. Do not imply entries are currently open.
- [ ] Keep Fall Brawl Winners out of main navigation and draft-only until the winner has been chosen.
- [ ] Review Fall Brawl Bundle pricing: requested copy says $69 (Save $45) for any one $25 shirt plus $39 SlessBox Pro; this arithmetic is inconsistent (a $64 combined list price before any other adjustment). Confirm the intended basis while preserving the requested draft copy until authorized.
- [ ] Review SEO recommendations in `seo-plan.json`; REST API access did not expose SEO plugin meta fields, so no head metadata has been installed.
- [x] Save semantic page content and descriptive core WordPress page excerpts.
- [ ] Restore hosting access for the original Home MP4 before publishing. The preserved source URL returned HTTP 403, including with the normal site referrer; do not bypass hosting protection or replace the footage.
- [ ] Remove the existing site's visible PHP authentication-snippet text through its proper configuration, without breaking REST access. This is outside page content; the draft redesign does not alter global snippets or the theme.