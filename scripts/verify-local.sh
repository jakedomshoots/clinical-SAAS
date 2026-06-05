#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "Running API tests"
cd "$ROOT_DIR/apps/api"
uv run pytest

echo "Running web and desktop type checks"
cd "$ROOT_DIR"
pnpm exec tsc -b packages/shared apps/web apps/desktop --pretty false

echo "Running web lint"
pnpm --filter @concierge-os/web lint

echo "Running web frontend audit"
pnpm --filter @concierge-os/web audit:frontend

echo "Running web smoke tests"
pnpm --filter @concierge-os/web smoke

echo "Local verification complete"
