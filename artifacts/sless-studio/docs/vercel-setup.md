# Vercel setup

The owner selected Vercel hosting. The separate Replit preview is not the
production hosting target.

## Project

- Team: `tylers-projects-0bac4b20`
- Project: `sless-studio`
- Framework: Next.js
- Source root: `artifacts/sless-studio` in this workspace
- Install: `pnpm install --frozen-lockfile && pnpm run vercel:install`
- Build: `pnpm run build`
- Vercel handles the Next.js runtime; do **not** use `scripts/replit-start.mjs`.
- Leave `BASE_PATH`, `NEXT_PUBLIC_BASE_PATH`, `STUDIO_PREVIEW`,
  `NEXT_PUBLIC_STUDIO_PREVIEW`, and `STUDIO_BACKGROUND_WORKER` unset on Vercel.
  The app runs at `/`; production jobs use the existing authenticated Vercel
  cron routes and request `after()` hooks, not an always-on process.
- Keep `BILLING_ENABLED` unset or `false` until the owner approves activation.
- Do not connect a live domain or deploy production without approval.

No repository is linked and no source deployment has been created yet.

## Account prerequisite

The owner upgraded the connected team to Pro, and the API confirms that
plan is active. The existing minute-by-minute cron jobs and 800-second tools
function need Pro: Hobby allows daily cron jobs and 300-second functions.
Do not change billing automatically.

References:

- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/functions/configuring-functions/duration

## Production services

Configure the real services using `.env.example`: MongoDB replica set,
Resend with a verified sender, Higgsfield credentials and webhook settings,
and Cloudflare R2. The app intentionally refuses to boot production with
missing required services; do not populate placeholder credentials.

R2 setup: the private `sless-studio-media` bucket exists in the connected
Cloudflare account. Vercel has its account ID, bucket name, and a separate
bucket-scoped Object Read & Write credential. No public access or DNS
changes were enabled. `R2_PUBLIC_BASE_URL` is deliberately not set; the media
delivery/access policy must be confirmed before production can boot.

Resend setup: the owner approved `mail.studio.slessismore.org`. It is registered
in Resend with sending enabled, receiving disabled, and click/open tracking off.
Vercel preview and production have a sensitive domain-restricted sending key,
`EMAIL_FROM=Sless Studio <signin@mail.studio.slessismore.org>`, and the existing
support address. Sending is not ready: DNS verification is pending. Google and
Cloudflare public DNS both returned NXDOMAIN for `slessismore.org` during setup,
and the connected Cloudflare account listed no matching zone. Registry RDAP
confirms registration through 2027-10-22 and SiteGround nameservers; the registrar
of record is Tucows Domains Inc. A subsequent registry check confirmed the
`client hold` was removed. The DNS monitor subsequently confirmed resolution
to SiteGround nameservers. Resend is still pending: all four required sending
record lookups returned NXDOMAIN after root DNS recovered. A Resend
verification request was accepted; that is not confirmation of verification.
Use the authoritative provider's DNS editor for the
Resend-provided records; do not change nameservers or root/mailbox records.
No DNS records were changed and no emails were sent.

Set `APP_URL`, `AUTH_URL`, and `HF_WEBHOOK_BASE_URL` to the actual verified
deployment/domain at deployment time, not the Replit preview address.
Generate strong `AUTH_SECRET`, `HF_WEBHOOK_SECRET`, and `CRON_SECRET` directly
in a secure configuration flow. Never put credentials in this document.

## Binary prerequisite

The Vercel install command explicitly runs `scripts/vercel-install.mjs` after
pnpm. It installs `ffmpeg-static`'s binary if absent and verifies execution.
Next's output tracing must include the binary in both the submit and tools
routes.

## Verification boundaries

Local compatibility tests are not a Vercel function benchmark. A continuous
tone de-clipping stress probe was stopped after more than seven minutes.
Hosting on Vercel does not by itself resolve CPU-heavy audio workloads.
Run the real upload → processing → download journey on an authorized preview
deployment after production services are configured.
