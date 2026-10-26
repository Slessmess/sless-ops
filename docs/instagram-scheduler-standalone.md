# Sless Instagram scheduler — standalone project

Prepared import package, **not an active schedule**. No credentials are included.

## 1. Import into a separate project

Use https://replit.com/import and choose **ZIP**. Upload the scheduler ZIP.
Keep it as a standalone Node.js script project, not an Agent-generated website
or multi-artifact app. The archive root contains `.replit` and `package.json`.

The `.replit` file already specifies the Scheduled build and run commands.
The workspace Run button is deliberately read-only; only a published scheduled
run is allowed to publish.

## 2. Set up storage and authorization in the NEW project

Ask its Agent:

> Keep this as a standalone script project. Read README.md and replit.md.
> Set up App Storage here. Request INSTAGRAM_ACCESS_TOKEN securely through
> Secrets. Do not create a web app or change the approved campaign.

Replit's App Storage buckets cannot be shared between projects. Create a new
bucket through App Storage or the Agent; **do not copy the original project's
bucket ID**. Its setup must provide `DEFAULT_OBJECT_STORAGE_BUCKET_ID`.

Add the existing Instagram credential through the new project's **Secrets**
tool, or reconnect/replace it securely if necessary. Never paste its value into
chat, files, this README, or a shell command. No Facebook, WordPress, SSH,
Stripe, or other unrelated credentials are needed.

## 3. Initialize once, without posting

Ensure the original project's scheduler is **not published/running**, including
any external scheduler for these same posts. Facebook's existing native schedule
is separate and should remain unchanged.

In the new project's Shell:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run verify-import
pnpm run initialize
pnpm run check
```

`initialize` explicitly confirms the old scheduler is stopped. It uploads only
the 12 hash-verified approved media files and imports the inactive publication
journal. It preserves the already-published launch receipt, never replaces an
existing journal, and does not publish. Run this command only after actually
confirming the original scheduler is stopped.

`check` verifies private media, signed downloads, the account `slessismoree`,
and Instagram publication receipts without writing to Instagram.

The seed assets and journal stay out of Git and the published image; initialization
must finish before publishing. **Keep your original downloaded ZIP until setup is
verified.** Do not put this archive in a public repository.

## 4. Publish

Open Publishing in the NEW project:

| Setting | Value |
| --- | --- |
| Deployment type | Scheduled |
| Cron expression | `*/5 * * * *` |
| Job timeout | 5 minutes |

Review the hosting cost and click Publish. The commands are already in `.replit`:
build installs the locked dependencies and runs tests; run starts the worker.
There is no website, domain, or HTTP port.

Inspect publishing logs after the first scheduled run. File configuration and
local checks alone do not prove this new project's deployment is running.
If Publishing does not recognize the entry point, **stop rather than converting
it to a web app or starting a second publisher**.

## Safety and campaign scope

- Instagram only; does not duplicate Facebook's existing scheduled posts.
- Maximum two posts per Eastern day, at least six actual hours apart.
- An overdue post is skipped after its one-hour window.
- Unknown write outcomes block another write until reconciled.
- Only approved assets/captions and the current campaign manifest are accepted.
- No boosting, paid ads, or ad spend.
- October 25 last-day creative cannot run early.
- Campaign publication ends October 25, 2026, at 11:59:59 p.m. Eastern.
- **Pause/delete the deployment after the campaign** to stop recurring charges.

The deployment can be reused for future campaigns only after approved assets,
dates, validation boundaries, and a separate journal are prepared. It does not
automatically approve new posts. Story link stickers still need native Instagram.
