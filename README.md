# sless-ops

An operations-task backend ported from the supplied Flask code to the existing
Express/TypeScript API server, with a signed-in `/operations` workbench in the
Sless Media Group app.

## Preparing operations without database edits

Open `/operations` while signed in with an account explicitly authorized by
`SLESS_OPS_ADMIN_USER_IDS` or `SLESS_OPS_ADMIN_EMAILS`. Empty allowlists deny
everyone; normal signup never grants administrative privileges.

The workbench supports WordPress pages, posts and updates, Stripe products,
and Stripe payment links. Saving always queues a **pending** task. Only a
separate, confirmed approval executes a provider operation.

`POST /api/tasks` requires an `Idempotency-Key` UUID header and a type-specific
JSON body. For example: `{"type":"wp_page","title":"Review me","content":"Draft content"}`.
The server assigns the queue identity and status; supplied identities, results,
statuses and unsupported fields are rejected. Identical retries reuse the
same task, and reuse of a key with different content returns 409. Keep the
same key and body after an uncertain save instead of submitting a new task.

## SlessBox download staging

`node scripts/src/connect-slessbox-order-downloads.mjs --stage` connects the
owner-approved Windows installer to the existing **draft** Pro/Studio products,
without publishing, changing prices, creating orders, sending email or charging.
The installer is packaged as a ZIP rather than weakening executable MIME policy,
stored outside the public webroot, and registered with WooCommerce's native
approved directories and force-download handler. The receipt is
`wordpress/sless-refresh/slessbox-order-downloads.json`.

This does not implement paid app features or licensing. Paid tiers must stay
closed until their actual app functionality and delivery are verified. The
older Download Manager/Lite delivery package remains untouched and is not
assumed byte-identical to the approved attachment.

## Backend routes

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/healthz` | Public health check |
| GET | `/api/` or `/api/tasks` | List operations tasks as JSON |
| GET | `/api/tasks/processing-report` | Read-only processing-claim report and provider-inspection warning |
| POST | `/api/approve/:taskId` | Execute a pending task and persist its result |
| POST | `/api/change/:taskId` | Save `feedback` and mark a task `change_requested` |

The Flask template/redirect responses are now JSON responses for a future
frontend. Change requests accept JSON or URL-encoded forms.

## Access protection

Task routes require a valid Clerk session **and** an explicitly allowed admin.
Set `SLESS_OPS_ADMIN_USER_IDS` to permitted Clerk IDs, or
`SLESS_OPS_ADMIN_EMAILS` to permitted primary email addresses (comma-separated
non-secret environment variables). Email authorization is verified server-side
against the running environment's Clerk instance on each request; unverified
or secondary addresses do not qualify. Provider failures deny access with 503.
Empty allowlists deny all access. Normal signup does not grant admin access.

The workbench includes Clerk sign-in UI. A configured email can sign up normally;
no shared password or manually copied development user ID is required.
Browser writes must come from the same origin. Trusted API clients can use a
valid Clerk bearer session token. Never send WordPress credentials to a browser.

## Provider configuration

- `WP_USER`, `WP_APP_PASSWORD`: WordPress credentials stored in Replit Secrets.
- `WP_URL`: optional, defaults to `https://slessismore.org/wp-json/wp/v2`.
- Stripe: uses the connected Replit Stripe integration through its SDK proxy;
  no manually supplied Stripe key is required.
- `DATABASE_URL`: project's PostgreSQL connection, supplied by Replit.
- `TASKS_FILE`: optional **legacy import source only**, not runtime storage.
  The importer defaults to `tasks.json` in the API server's working directory
  (`artifacts/api-server/tasks.json`).

The attempted WordPress OAuth connector failed, so WordPress uses the REST API
and application-password approach from the original Flask code.

## Tasks and legacy import

Task history now lives in PostgreSQL's `ops_tasks` table. Each row retains the
full JSON task document (including custom payload fields, feedback and results),
the original task ID, queue order, and internal execution claim token/start time.
No Stripe product or price catalog is stored in application tables.
No sample or live tasks are created. There is still no task-intake endpoint.
Legacy imports accept the original JSON array format:

```json
[
  {
    "id": "draft-page-example",
    "type": "wp_page",
    "status": "pending",
    "title": "Example draft",
    "content": "<p>Draft content.</p>",
    "wp_status": "draft",
    "slug": "example-draft"
  }
]
```

Supported payloads:

- `wp_page`, `wp_post`: `title`, `content`; optional `wp_status` (defaults to
  `draft`) and `slug`.
- `wp_update`: `updates` object, optional `is_page` (defaults to false),
  and `wp_id` for the WordPress content ID. A numeric task `id` is accepted
  as the legacy content ID if `wp_id` is omitted.
- `stripe_product`: `name`, optional `description`.
- `stripe_link`: `name`, integer `amount` in USD cents; optional HTTPS
  `redirect` (defaults to the original thank-you URL), `shipping` (false
  by default). Shipping countries remain US, CA and GB.

Approval changes `pending` → `processing` → `completed` or `failed`.
Processing, completed, failed and change-requested tasks cannot be approved
again. Change requests cannot alter processing or completed tasks.

### Safe development import

1. Stop every old JSON-backed server/producer before taking the snapshot; do
   not edit the file during import. Retain a private copy outside the deployment.
2. Apply the schema to **development only**:
   `pnpm --filter @workspace/db run push`.
3. Run `pnpm --filter @workspace/api-server run tasks:import /absolute/path/to/tasks.json`.
   Omitting the path uses `TASKS_FILE`, or the default above.
4. The importer creates an exclusive, private (`0600`) `.backup` file containing
   the exact original bytes and flushes it to disk **before** any database write.
   It leaves the source unchanged. Securely retain that backup outside this
   workspace/deployment; backups and the default source are git-ignored.
5. All records are validated, duplicate IDs rejected, then imported in one
   transaction. Missing/corrupt sources fail explicitly. An identical rerun
   skips existing rows; an ID with different stored content aborts the entire
   import without overwriting current history. Failed imports retain the backup.
6. Verify IDs, count, states, payloads, feedback and results using the database
   pane and the authenticated `/api/tasks` route before retiring JSON storage.
   Imported `processing`/`failed` tasks stay in that state; they are not resumed.

The importer is a development-only, data-only operator command. It must never
be placed in startup, deployment build commands or publish hooks. No legacy
`tasks.json` file was present in this workspace when this migration was made;
if the original queue is elsewhere, supply its path to the command above.

### Publishing

Development and production databases have separate data. Replit Publish diffs
the development schema and applies it to the managed production database.
Do **not** run production DDL, custom production migrations, or startup-time
table creation. The post-merge script only pushes the development schema.
Production data is not automatically populated by a development import.
For the initial launch, if production history must include the imported queue,
use Publish's explicit **overwrite data** option only after reviewing the data
and backing up any existing production data: it replaces production data
wholesale, not just tasks. Do not select it for normal releases of a live app.
Re-publish to apply later schema changes; retain the existing production data.

## Concurrency and manual recovery

PostgreSQL row locks make validation and pending-to-processing claims atomic
across server instances. Claims commit before provider calls, so no database
lock is held during network requests. Competing approvals return 409, and a
change request cannot interrupt an already-claimed task. Claim tokens prevent
a stale worker from overwriting a newer manual recovery. Database failures fail
explicitly; there is no local-file fallback.

Stripe writes use stable, task-specific idempotency keys. WordPress does not
provide equivalent idempotency here. A timeout or crash may leave an uncertain
provider outcome or a `processing` task: inspect WordPress/Stripe before any
manual reset. Stripe idempotency keys also have a limited provider retention
period; they are not a guarantee for delayed manual retries.

Never automatically reset processing/failed tasks or automatically retry writes.
If a worker crashes after provider success or result persistence fails, the task
can remain `processing` even though the external operation succeeded. Before an
operator edits the stored document, stop relevant workers and inspect the
provider. If the operation succeeded, record its confirmed result and completed
status. If it did not, only reset to pending after confirming that retry is safe.
Clear `claim_token` and `claim_started_at` on any manual recovery, preserve the
task ID and payload, and document the operator's decision. Imported processing tasks also require
this inspection. Do not reimport an old queue to reset states.

## Processing monitoring

`GET /api/tasks/processing-report` requires the same Clerk session and explicit
admin allowlist as all other task routes, and returns `Cache-Control: no-store`.
It is a separate operational report, not a dashboard or a recovery endpoint.
The existing list/approve/change task JSON is unchanged; claim timing stays in
the nullable internal `claim_started_at` column, recorded atomically when a task
is claimed and cleared on completion, failure, or a permitted change request.

Administrators can set the non-secret environment variable
`SLESS_OPS_STALLED_TASK_SECONDS` to an integer from `1` to `31536000`.
The default is `900` seconds (15 minutes). Restart the API after configuration
changes; invalid values fail startup explicitly rather than falling back.
Choose a threshold above the normal provider execution duration. Age at or
above the threshold is classified as `stalled`; younger claims are `active`.
A stalled claim is a warning, **not proof of a crash or provider failure**.

The report exposes `checkedAt`, the effective `thresholdSeconds`, `activeCount`,
`stalledCount`, `unknownStartCount`, `inspectionRequired`, `warning`, and a
`tasks` array containing only processing task IDs/types, provider, start time,
age, classification, and inspection flag. It does not expose claim tokens,
payloads, credentials, or provider results. Legacy/imported processing tasks
with no internal timestamp are `unknown_start`, with null start/age, and require
inspection immediately; no start time is inferred from imported JSON.

Poll this route from an authorized operator client/monitor (for example once a
minute), alert when `inspectionRequired` is true, and also alert on non-200
responses: an unavailable report is not an all-clear. Each poll that finds
stalled or unknown-start tasks emits a structured warning with event
`ops_provider_inspection_required` and counts in the server logs. No autonomous
scheduler or external email/notification delivery is configured; without
polling there are no report-generated alerts. The endpoint performs SELECTs
only and does not call WordPress/Stripe, reset statuses, clear claims, or retry
writes. Repeated polling cannot trigger recovery.

Before any manual recovery, follow the provider-inspection procedure above.
Inspect WordPress content or Stripe products/prices/payment links, including
partial results, stop relevant workers, and record the confirmed outcome.
Do not approve an uncertain claim again based on its age alone.

Apply the new nullable timestamp column to development with
`pnpm --filter @workspace/db run push` (or the existing post-merge setup).
Existing claims deliberately remain null; do not backfill guessed start times.
Production receives the schema through Replit Publish only, retaining current
data. No production migration script, deployment-build DDL, or startup DDL is
needed or supported.

## Development checks

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run test
```

Tests require the development database and its current schema. They use
temporary, isolated PostgreSQL schemas and two independent connections, plus
temporary legacy files and mocked providers. They cover persistence, backups,
transactional rollback, competing approvals, claim fencing and retained provider
behavior. They do not publish WordPress content or create Stripe products/links.