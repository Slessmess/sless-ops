# sless-ops

An administrator-only operations backend for preparing and reviewing tasks that publish WordPress content or create Stripe products and payment links. The signed-in `/operations` page provides task entry and explicit approvals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-server run test` — isolated development-PostgreSQL and mocked-provider tests
- `pnpm --filter @workspace/api-server run tasks:import /absolute/path/to/tasks.json` — backup and transactional legacy import (dev only)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/ops.ts` — task list, approve, and change routes
- `artifacts/api-server/src/lib/ops-*` — task execution, validation, service, and tests
- `artifacts/api-server/src/lib/task-store.ts` — PostgreSQL task history and atomic execution claims
- `lib/api-spec/openapi.yaml` — API contract
- `README.md` — endpoint, configuration, task payload, and recovery guide

## Architecture decisions

- Task intake saves pending work only; provider operations require a separate explicit approval. Create requests require an idempotency key and reject caller-supplied identities, statuses and results.
- Storage migration was explicitly approved: preserve the supplied JSON documents in PostgreSQL, with a development-only backup/import command.
- Production schema changes belong to Replit Publish, never startup/build-time DDL or custom production migration scripts.
- WordPress OAuth failed with an unknown client ID; retain the supplied REST/application-password approach.
- Stripe uses the supplied connected-account SDK proxy, not an API-key lookup or a local product catalog.
- Clerk authentication does not grant operations access by itself; an explicit admin allowlist is required.

## Product

Approve pending WordPress page/post/update and Stripe product/payment-link tasks, or request changes with feedback. Task documents and results persist in PostgreSQL across server instances.

Sless Media Group is a separate restaurant-focused web app in
`artifacts/sless-media-group`, served at `/` with backend routes under
`/api/media`. See `docs/sless-media-group.md` for its preview features, approved
packages, cost limits, owner permissions and billing/launch boundaries.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Operations admins require an explicit `SLESS_OPS_ADMIN_USER_IDS` or `SLESS_OPS_ADMIN_EMAILS` allowlist. Email grants require a server-verified primary email in the current Clerk environment; empty lists deny all.
- Sless Media Group hosts the `/operations` workbench; its API uses the explicit operations-admin allowlist, independently of restaurant roles.
- Never auto-retry an uncertain WordPress write. Check the provider before resetting failed or processing tasks.
- Legacy JSON is import-only. No original queue file was present at migration time; use the documented importer if the original is provided later.
- Imported development history does not automatically become production data; see README's initial-launch guidance before selecting Publish's overwrite-data option.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
