#!/bin/sh
set -eu

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
outdir="${OUT_DIR:-artifacts/acquisition-readiness/$timestamp}"
summary="$outdir/summary.md"
checks_log="$outdir/checks.log"

mkdir -p "$outdir"

branch="$(git rev-parse --abbrev-ref HEAD)"
commit="$(git rev-parse --short HEAD)"
status="$(git status --short)"

checks_status="not run"
if [ "${RUN_CHECKS:-0}" = "1" ]; then
  checks_status="passed"
  {
    echo "Running API lint"
    pnpm --filter @concierge-os/api lint
    echo
    echo "Running web lint"
    pnpm --filter @concierge-os/web lint
    echo
    echo "Running web frontend audit"
    pnpm --filter @concierge-os/web audit:frontend
    echo
    echo "Running web build"
    pnpm --filter @concierge-os/web build
    echo
    echo "Running web smoke"
    pnpm --filter @concierge-os/web smoke
  } >"$checks_log" 2>&1 || checks_status="failed"
else
  printf '%s\n' "Set RUN_CHECKS=1 to run API lint, web lint, frontend audit, web build, and smoke." >"$checks_log"
fi

cat >"$summary" <<EOF
# Concierge OS Acquisition Readiness Report

Generated: $timestamp

## Repo State

- Branch: $branch
- Commit: $commit
- Worktree status:

\`\`\`text
${status:-clean}
\`\`\`

## Check Status

- Fast checks: $checks_status
- Check log: checks.log
- Full verifier to run before final diligence handoff:

\`\`\`sh
pnpm verify:local
\`\`\`

## Buyer Room

- Acquisition readiness room: docs/operations/acquisition-readiness-room.md
- Hosted demo environment: docs/operations/hosted-demo-environment.md
- Buyer demo script: docs/operations/buyer-demo-script.md
- Product diligence hardening: docs/operations/product-diligence-hardening.md
- AI command differentiation: docs/operations/ai-command-differentiation.md
- Technical diligence inventory: docs/operations/technical-diligence-inventory.md
- Completion roadmap: docs/operations/completion-roadmap.md
- Production launch checklist: docs/operations/production-launch-checklist.md

## Demo Boundary

This report is for synthetic-data product and technical review. Concierge OS is
not cleared for live patient use until production infrastructure, BAAs, vendor
accounts, DrChrono exports, staff validation, policy approval, and go-live
signoff are complete.
EOF

printf 'Acquisition readiness report written to %s\n' "$summary"
if [ "$checks_status" = "failed" ]; then
  printf 'One or more checks failed. See %s\n' "$checks_log" >&2
  exit 1
fi
