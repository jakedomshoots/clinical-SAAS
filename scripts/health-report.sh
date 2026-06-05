#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:8000}"

echo "Concierge OS health report"
echo "base_url=$BASE_URL"
echo

curl -fsS "$BASE_URL/api/health"
echo
curl -fsS "$BASE_URL/api/ready"
echo
