#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Development schema only; production schema changes are owned by Publish.
pnpm --filter @workspace/db run push-force
