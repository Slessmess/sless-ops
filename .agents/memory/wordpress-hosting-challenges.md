---
name: WordPress hosting challenges
description: Recognize hosting-layer CAPTCHA responses and avoid duplicate WordPress writes after an unconfirmed operation.
---

WordPress REST requests from this workspace can be intercepted by the hosting anti-bot layer: HTTP 202, `Content-Type: text/html`, and `sg-captcha: challenge` are not WordPress API success responses.

**Why:** Both a draft-creation attempt and an authenticated read-only lookup encountered this hosting response. The executor correctly retained a failed outcome because it could not confirm WordPress's result.

**How to apply:** Do not bypass the CAPTCHA or automatically retry writes. Ask the site owner to permit authenticated WordPress REST/application-password requests in the hosting security settings. Inspect WordPress for an existing draft before resetting any failed or processing task; the WordPress adapter has no idempotency guarantee.

The site owner manages REST access with a WordPress snippet and has added Authorization forwarding both in a snippet and in `.htaccess`. During setup, read-only checks reached WordPress JSON but authenticated `users/me` returned HTTP 401 `rest_not_logged_in`, even though the public REST index advertised `application-passwords`. Access was subsequently restored: authenticated user lookup, draft inspection and draft creation all succeeded. Multiple site settings and credentials were changed, so the exact corrective change was not isolated.

**Why:** Public REST access and advertised application-password support do not prove that the request is authenticated. A missing/stripped Authorization header, rejected credentials, or security configuration can still prevent authenticated operations.

**How to apply:** Recheck the current response instead of assuming the hosting challenge remains. Confirm `users/me` succeeds with the stored credentials and draft inspection is permitted before resetting failed tasks or retrying writes. Do not infer the precise authentication cause from `rest_not_logged_in` alone.

An attachment's presence in the REST media library does not prove visitors can
retrieve its binary file.

**Why:** The original homepage MP4 was still listed in WordPress while its public
file URL returned HTTP 403, including a request with the site's own referrer.

**How to apply:** Check the actual media URL as well as the REST metadata when
retaining important footage. Report access failures and keep an honest fallback;
do not bypass hosting protection or assume a successful metadata read proves playback.

Public HTTPS access does not prove that WordPress's canonical home and site addresses use HTTPS. A storefront integration can require its submitted URL to match WordPress's configured address exactly.

**Why:** The public HTTPS homepage and WooCommerce authorization route were reachable while WordPress and WooCommerce advertised HTTP home/site URLs. Printify's official troubleshooting guide requires matching WordPress's configured domain. This mismatch is a candidate cause, not proof of a resolved connection failure.

**How to apply:** Inspect both canonical addresses before weakening security settings or recommending a different storefront path. Update both addresses together to the verified HTTPS origin. Core WordPress REST exposes the site URL setting but not the home address, so do not apply a partial migration through that endpoint.

A workspace hosting challenge does not prove the native Printify → WooCommerce
connection is broken.

**Why:** Native Printify product publication successfully returned real WooCommerce
product mappings while authenticated workspace requests still received the hosting
CAPTCHA. The two request sources can have different access.

**How to apply:** Use an existing, authorized native channel for catalog sync when
appropriate, and verify its real external mappings. Do not solve or bypass the
workspace CAPTCHA, fabricate publishing success, or equate a synced catalog with
an open storefront and verified live checkout.