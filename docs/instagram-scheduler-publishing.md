# Instagram scheduler publishing

## Status and scope

Prepared, not activated. Publishing must be completed by the owner.
This job publishes only the approved Instagram holiday campaign to `slessismoree`.
It does not alter Facebook's existing native schedule, boost posts, spend an ad
budget, publish Stories, or approve future campaigns.

## Publishing settings

In Replit Publishing, choose **Scheduled**, not Autoscale, Static, or a web
server. Review the hosting cost before publishing.

| Setting | Value |
| --- | --- |
| Build command | `pnpm run instagram:scheduler:build` |
| Run command | `pnpm run instagram:scheduler:run` |
| Schedule (cron) | `*/5 * * * *` |
| Job timeout | 5 minutes |
| Working directory | Repository root |

This checks for due posts every five minutes. The schedule is timezone-independent;
each campaign timestamp already includes its Eastern offset. Publication can occur
several minutes after the planned time, particularly while a Reel processes or
while waiting for the full six-hour spacing from the previous actual publication.

This is a non-HTTP job: it needs no domain, public URL, or open port.
Do not replace a website/API artifact's production run command with this worker.
If Publishing only offers the existing web artifacts and no Scheduled option,
stop and resolve the deployment setup rather than publishing a web app and
assuming its background job will run.

### Production access

Ensure the existing `INSTAGRAM_ACCESS_TOKEN` and
`DEFAULT_OBJECT_STORAGE_BUCKET_ID` are available in the publishing environment.
Use Replit Secrets; never paste credential values into chat, code, or commands.
The published job also needs access to the existing App Storage bucket through
Replit's managed storage credentials. No Facebook password or additional
Business Suite login is required.

### Before clicking Publish

Run `pnpm run instagram:scheduler:check` in the workspace. This is read-only:
it verifies the Instagram account, reconciles published receipts in memory,
checks all 12 privately stored assets against approval hashes, and checks a
signed media download. It never creates a media container or publishes a post.

Then review the Scheduled settings and cost, and click **Publish**.

### After publishing

Inspect the first job's publishing logs. A successful run reports
`no_due_post`, `processing`, or a `published` receipt. Build success alone is
not evidence that the schedule is active or that a post was published.

If the logs report expired access, a rejected write, or an uncertain outcome,
repair or reconcile the existing journal/media IDs before retrying.
Do not rerun the campaign-preparation script or delete the journal to clear an
error; that can lose duplicate-protection state.

The worker refuses automatic execution in the workspace. Do not spoof the
deployment flag to test a live write.

## Campaign limits and stopping

- Existing launch receipt is retained; it must not be posted again.
- Maximum two posts per Eastern day, at least six hours apart.
- A missed slot is not automatically caught up after its one-hour window.
- The last-day creative cannot publish before October 25, 2026.
- No campaign post publishes after October 25, 2026, 11:59:59 p.m. Eastern.
- **Pause/delete the scheduled deployment after the campaign** to stop recurring
  compute charges. Campaign expiry stops publication, not the cron job itself.

## Future campaigns

The deployment can be reused, but it does not invent or approve new posts.
Prepare and approve the next campaign's assets, captions, dates, and separate
durable journal before updating the deployment. The current validator intentionally
accepts only this holiday campaign. Reconnect Meta through Secrets if access
expires or is revoked. Story link stickers still require the native Instagram UI.
