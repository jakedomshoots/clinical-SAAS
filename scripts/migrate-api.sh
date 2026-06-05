#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

cd "$ROOT_DIR/apps/api"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required to run API migrations" >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- upgrade head
fi

uv run alembic "$@"
