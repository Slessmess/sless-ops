---
name: SiteGround SSH host verification
description: Avoid confusing SSH login credentials or client keys with the server host-key fingerprint.
---

SiteGround's SSH Credentials panel does not show the server host-key fingerprint. Do not send the owner there to find it or ask them to generate another login key.

**Why:** The owner checked this panel and confirmed it only provides connection details. Official SiteGround guides describe the first-connection host-key prompt, not a fingerprint displayed in the control panel.

**How to apply:** For independent host verification, obtain the server's SHA-256 host-key fingerprint from a trusted existing connection or SiteGround support. A fresh SSH prompt or `ssh-keyscan` reports the observed key, not an independently authenticated expected key. Never request the private key or passphrase in chat.

Use the already-provided SiteGround SSH access as an alternative to the web REST
API. Do not tell the owner that hosting access is unavailable merely because an
HTTP request receives a hosting CAPTCHA.

**Why:** The owner repeated, “You have access to site ground we've been thru this.”
Direct SSH and WP-CLI worked after normalizing the existing OpenSSH key's text
formatting; neither new credentials nor disabling hosting security was necessary.

**How to apply:** Check the saved access and direct transport before asking the
owner to contact hosting support. Distinguish local key-loading errors from server
rejection. Retain host-key pins and reject changed keys; first-use acceptance is
trust-on-first-use, not independent fingerprint verification.

Treat website SSH access and authoritative DNS access as separate permissions.

**Why:** The saved SSH connection permitted WordPress administration but did not
establish authenticated DNS-management access. A DNS utility being installed
does not itself authorize updates to SiteGround's nameservers.

**How to apply:** Check existing access before declaring a limitation, but do
not promise DNS changes through WordPress or SSH alone. Use SiteGround's
authenticated DNS Zone Editor or the provider authorization offered by Printify's
Entri setup. Preserve root-domain and mail records when connecting only `shop`.
