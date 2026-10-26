# Sless Media Group launch preview

The restaurant business is a separate web app from Sless Is More's WordPress
site. No WordPress pages, payment links, newsletter forms or installer access
were activated by this build.

## Included

- Public restaurant-focused home and branded Clerk authentication.
- One restaurant workspace per signed-in account, with menu text and profile.
- Private JPEG/PNG/WebP photos and PDF menu uploads, up to 10 MB per file.
  File bytes live in App Storage; PostgreSQL holds metadata and ownership.
- Manual drafts, AI-assisted copy, photo-based PNG graphics and silent
  15-second vertical H.264 MP4s, with downloadable files and editable captions.
  Videos use a separate WebM browser preview with an MP4 fallback; social
  downloads remain MP4. Captions can be copied, and unrendered drafts also
  download as text.
- Approval and revision feedback, and calendar dates for manual publishing.
- HTTPS referral links with measured click counts. Clicks are not attributed
  purchases, unique visitors, verified leads, or revenue.
- Managed-service brief intake and an administrator-only client workspace.
  The owner can create content with each client's uploaded photos, then the
  client reviews the same saved content in their own library.

## Approved packages — not yet purchasable

| Package | Monthly price (USD) | Videos | Posts |
| --- | ---: | ---: | ---: |
| Self-service | $99 | 4 | 12 |
| Managed | $499 | 8 | 20 |

Billing is deliberately inactive in the server. Package selection cannot
grant a paid entitlement. The checkout endpoint fails explicitly with HTTP
503 and never calls Stripe. A managed brief is a request, not a subscription.
Stripe subscription creation, webhooks, recurring quota enforcement, and
cancellation/reconciliation must be verified in a separate launch-readiness
step before the owner approves accepting payments.

## Preview limits and production costs

- One AI post and one AI video per account, lifetime.
- At most six AI generations globally per UTC day.
- Up to ten manual/generated renders per account per UTC day and forty globally.
- Up to 60 uploaded files and 1,000 saved content items per workspace.
- Deleting content does not refund AI allowance. A failed/uncertain provider
  call remains reserved to avoid charging twice through automatic retries.
- Interrupted generation becomes a failed, preserved draft after five minutes.

Copy uses Replit AI Integrations for OpenAI (`gpt-5.4-mini`), with a bounded
1,400 completion-token request and no automatic retry. Actual dollar/credit
costs have not been established. Images are rendered with Sharp and videos
with FFmpeg from the customer's real photo; this version does not invoke paid
Creatify generation, fabricate restaurant footage, or add licensed music.
Account limits, model token charges, rendering CPU, hosting, storage and
download traffic all need to be included in the package margin check.

Menus uploaded as PDFs are available as reference downloads. Menu text must
be entered in the restaurant profile for the copy generator; PDF text is not
automatically extracted.

## Owner access

The owner portal reuses the existing operations administrator allowlist:
`SLESS_OPS_ADMIN_USER_IDS`. It must contain the real owner's Clerk user ID.
An empty allowlist denies everyone. Ordinary sign-up never grants owner
permissions, and there is no “first user becomes admin” shortcut.

## Commands and launch boundaries

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/api-spec run codegen`
- `pnpm --filter @workspace/db run push` — development only.

The managed workflows serve the web app at `/` and the API at `/api`.
Production schema changes belong to Replit Publish, not app startup.
FFmpeg, fontconfig and DejaVu fonts are registered as system dependencies.

Publishing a preview does not enable billing, automatic social posting,
WordPress draft publication, protected SlessBox delivery, or merchandise
fulfillment. Those launches need their own checks and owner approval.
