# Instagram campaign activation

The approved media are staged in private App Storage. The worker supports image
feed posts and reels, checks the approved caption and file hashes, and keeps a
conditional-write journal in App Storage. Tokens and temporary signed media
URLs are never written into that journal.

**Prepared does not mean active.** A development workflow or workspace shell is
not a reliable automatic scheduler. No new Instagram posts were published during
preparation.

## Publish as a Scheduled job

In Replit Publishing, choose **Scheduled**, not Autoscale or Static. This job
does not run a website and must not replace the API server's production command.
If the multi-artifact publishing screen does not offer a separate Scheduled job
and its command fields, stop and resolve that limitation before publishing.
Do not change the existing website or API artifacts into scheduled jobs.

- Run command, from the project root:
  `node scripts/src/merchandise/run-instagram-schedule.mjs --execute`
- No compilation is needed for this command. Install the project dependencies
  through the normal pnpm workspace installation.
- Cron: `*/5 12,18 20-25 10 *`
- Timezone: `America/New_York`
- Maximum job runtime: five minutes.
- Confirm the saved `INSTAGRAM_ACCESS_TOKEN` and existing App Storage settings
  are available to the published job through Secrets. Never paste them into
  the run command or copy them to WordPress.
- Use **Run now**, if available, to verify the job starts and its logs show the
  expected account and no due post. Never activate posting in a workspace shell
  by spoofing the deployment environment flag.

This may incur Replit scheduled hosting charges. The owner must click Publish.
The worker is not considered active until the publishing schedule is configured
and a real deployment run is observed.

## Posting behavior

The dates and captions are fixed in `instagram-scheduler-manifest.json`.
One image has already been published; the remaining eleven use the approved
October 20–25, 2026 schedule. A job posts at most one due creative.
The job allows up to one hour of processing/retry delay, rather than
automatically posting several missed slots. Slots missed by more than an hour
are recorded as missed and require owner review.

Actual publication times must be at least six hours apart and no more than two
campaign posts may publish on a single Eastern day. Thus an evening post can
move to the next five-minute check if the noon publication took several seconds.
The October 25-only creative is blocked before that day, and the campaign
cannot publish after October 25, 2026 at 11:59:59 p.m. Eastern.

Interrupted or uncertain writes block further automatic writes until reconciled.
Processing videos reuse their saved containers. A known Instagram 9007
not-ready rejection can retry the same container only after a fresh media-list
and container-status reconciliation. No automatic duplicate container creation
is allowed after an uncertain request.

Pause/remove this Scheduled job after October 25. Cron has no year field;
the worker's campaign expiry prevents posts in later years, but leaving the
deployment enabled could still cause unnecessary runs and charges.

## Checks

- Read-only account/journal preflight:
  `node scripts/src/merchandise/run-instagram-schedule.mjs`
- Local timing/safety tests:
  `node --test scripts/src/merchandise/instagram-schedule.test.mjs`

Do not run the legacy single-image publishing operator concurrently with an
active scheduled worker. It uses a separate local receipt and does not share
the worker's distributed lease.

This worker does not post to Facebook, publish Stories, add Story link stickers,
or create or boost paid ads.
