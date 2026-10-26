---
name: WordPress MU bootstrap
description: Early MU-plugin execution cannot assume pluggable authentication and redirect functions have loaded.
---

Defer private test-session activation and redirects until `init`. A signing check
needed earlier in MU/plugin loading cannot assume `wp_salt()` is available.

**Why:** A private QA entry returned HTTP 500 when its MU plugin invoked
pluggable helpers before WordPress had loaded them. Deferring activation to
`init` and using configured authentication constants for early signature checks
restored the expected private redirect without changing public checkout.

**How to apply:** For future WordPress operator-session helpers, verify both the
private entry and a subsequent signed-cookie request over HTTP before browser
testing. Syntax checks and WP-CLI execution alone do not exercise early web
bootstrap. Keep temporary operator access disabled outside an active test.
