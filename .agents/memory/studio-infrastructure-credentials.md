---
name: Studio infrastructure credentials
description: Least-privilege boundaries for Cloudflare and Vercel runtime configuration.
---

Keep the Cloudflare operator connection separate from Sless Studio's runtime
R2 credentials. The application should have Object Read & Write permission
only for its own bucket, not bucket administration, DNS access, or access to
unrelated buckets.

**Why:** The connected operator can administer Cloudflare; exposing that
credential to the application would grant unnecessary account access.

**How to apply:** Use an independently scoped R2 token. Transfer derived S3
credentials directly into Vercel's protected environment configuration
without displaying or recording them in chat, source, or memory. The
Cloudflare connection uses account-level token-management endpoints; a
user-level token endpoint can reject a valid account-owned credential.

The owner approved `mail.studio.slessismore.org` as Studio's dedicated Resend
sending domain. Keep its application key sending-only and restricted to that
domain; retain the existing support mailbox rather than enabling Resend receiving.

**Why:** The owner explicitly selected the dedicated sending subdomain, to
separate Studio sign-in email from the existing website and mailbox.

**How to apply:** Use the approved subdomain for sign-in senders. Verify its
authoritative DNS before declaring email ready; registration in Resend and
saving a key in Vercel do not establish delivery.
