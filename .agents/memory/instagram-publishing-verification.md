---
name: Instagram publishing verification
description: Separate valid direct Instagram API access from proven content-publishing permission.
---

A successful Instagram profile read or publishing-quota read does not establish
that the token has content-publishing permission.

**Why:** Direct Instagram Login token access worked while the connector's OAuth
popup failed with “Invalid platform app.” Profile and quota requests succeeded,
but Instagram did not support the attempted permissions edge; token debugging
also required access the supplied token did not have.

**How to apply:** Describe profile access as verified, not publishing as verified.
Confirm publishing when creating the first authorized, finished campaign media
container. Reconcile uncertain writes before retries and distinguish an unpublished
container from a successfully published post. Keep tokens exclusively in Secrets.

Instagram's content-publishing API does not support publishing Story stickers,
including link stickers, per the official IG User Media reference checked on
October 19, 2026.

**Why:** The owner requires a clickable website link in campaign Stories.

**How to apply:** Use an actually supported native publishing workflow for a Story
with a link sticker; disclose when the owner must add the sticker in Instagram.
Do not promise the automated API can add it or treat text on the image as a link.

A container's `FINISHED` status is not proof of publication, and an immediate
publish request can still receive a transient not-ready rejection.

**Why:** An approved image returned error 9007/subcode 2207027 despite reporting
`FINISHED`; reconciliation and a later publish of the same container succeeded.

**How to apply:** After a known rejection, check published media and container
state before retrying the same container. Do not create replacement containers
or blindly repeat publication after an uncertain response.

The owner confirmed on October 19, 2026 that Instagram is connected to Business
Suite, then authorized preparing a Replit-hosted scheduler so posting can be
handled without their signed-in Business Suite interface.

**Why:** The owner wants the agent to handle future scheduling, not guide manual
entry of each post. This supersedes the earlier native-only scheduling choice.

**How to apply:** Preserve existing Facebook schedules. Preparation is not
activation: the owner still reviews hosting cost and publishes the scheduler.
Keep creative approval separate from scheduler access; connection alone does not
schedule posts or authorize new creative.
