---
name: Environment guards
description: Avoid treating the workspace environment label as proof that an application is deployed.
---

Do not use `REPLIT_ENVIRONMENT === "production"` alone to reject development-only operator commands.

**Why:** This workspace reported that value while operating on the confirmed development PostgreSQL database; the check incorrectly blocked all database tests and legacy imports.

**How to apply:** Require an explicit development/operator opt-in, reject the deployment flag, and confirm the intended database target. Never infer the database environment from the infrastructure label alone.

Do not equate a passing standalone worker check with a publishable scheduled job
in this multi-artifact workspace.

**Why:** On October 19, 2026 the owner selected Scheduled in Publishing, but its
settings exposed no Run command field. The existing artifact services still
defined website/API entry points. Repeated directions to find a command field
did not resolve that mismatch; general platform documentation did not establish
how to attach the standalone worker to this project's artifact publishing.

**How to apply:** Verify the actual publishing entry point before declaring a
worker ready. Do not replace website/API production commands without informed
consent, assume root deployment.run overrides artifact services, or repeatedly
ask the owner to find a field they have confirmed is absent. A dedicated worker
project is an isolation option, not an already-created or activated deployment.

Check every tracked dependency lockfile when resolving deployment security
blocks, including standalone packages outside the pnpm workspace.

**Why:** The workspace dependency audit reported no critical findings after a
patch, while the publishing audit still found the vulnerable version in the
standalone MCP package's npm lockfile. Both graphs required remediation.

**How to apply:** Compare the platform dependency audit against the workspace
audit. A clean pnpm graph alone does not establish that publishing's security
gate is clear; preserve compatible security pins in each independently managed
package.