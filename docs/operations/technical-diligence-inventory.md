# Technical Diligence Inventory

Canonical path: `docs/operations/technical-diligence-inventory.md`

This document gives a buyer or technical reviewer a compact map of the current
Concierge OS codebase. It should be updated whenever the architecture,
verification ladder, deployment assumptions, or production blockers materially
change.

## Repository

- Local checkout: `/Users/jakedom/concierge-os`
- Package manager: `pnpm`
- Backend package: `apps/api`
- Web package: `apps/web`
- Shared TypeScript package: `packages/shared`
- Desktop shell: `apps/desktop`
- iPad app prototype: `apps/ipad`

## Runtime Architecture

- Web: React, Vite, TanStack Router, TanStack Query, TypeScript.
- API: FastAPI, SQLAlchemy async, Alembic, Pydantic.
- Data stores: Postgres, Redis, MinIO/S3-compatible object storage.
- Desktop: lightweight Tauri shell/server-supervisor responsibilities.
- Demo mode: browser-local synthetic API in `apps/web/src/lib/demo-api.ts`.
- Shared contracts: `packages/shared/src`.

## Core Backend Surfaces

- Auth and session policy: `apps/api/app/routers/auth.py`
- Assistant commands/proposals: `apps/api/app/routers/assistant.py`
- Patients/chart: `apps/api/app/routers/patients.py`
- Scheduling: `apps/api/app/routers/scheduling.py`
- Tasks: `apps/api/app/routers/tasks.py`
- Faxes: `apps/api/app/routers/faxes.py`
- Messages: `apps/api/app/routers/messages.py`
- Billing: `apps/api/app/routers/billing.py`
- Integrations: `apps/api/app/routers/integrations.py`
- Operations readiness: `apps/api/app/routers/operations.py`
- Analytics/readiness: `apps/api/app/routers/analytics.py`
- Webhooks: `apps/api/app/routers/webhooks.py`

## Core Frontend Surfaces

- App shell and command palette: `apps/web/src/router/routes/__root.tsx`
- Command Center: `apps/web/src/router/routes/index.tsx`
- Patient chart: `apps/web/src/router/routes/patients/$patientId.tsx`
- Assistant Review: `apps/web/src/router/routes/assistant-review.tsx`
- Operations: `apps/web/src/router/routes/operations/index.tsx`
- Integrations: `apps/web/src/router/routes/integrations.tsx`
- Setup: `apps/web/src/router/routes/setup.tsx`
- Billing: `apps/web/src/router/routes/billing.tsx`
- Faxes: `apps/web/src/router/routes/faxes/index.tsx`
- Messaging: `apps/web/src/router/routes/messaging/index.tsx`

## Verification Ladder

Primary full command:

```sh
pnpm verify:local
```

Useful focused commands:

```sh
pnpm --filter @concierge-os/api lint
pnpm --filter @concierge-os/web lint
pnpm --filter @concierge-os/web audit:frontend
pnpm --filter @concierge-os/web smoke
pnpm exec tsc -b packages/shared apps/web --pretty false
cd apps/api && uv run pytest
```

Generate an acquisition report bundle:

```sh
pnpm acquisition:report
RUN_CHECKS=1 pnpm acquisition:report
```

## Data Boundaries

- Synthetic buyer demos should use web demo mode only.
- Real PHI must not be entered into static or local buyer demos.
- Production PHI use requires production infrastructure, signed BAAs, approved
  policies, backups, restore drills, staff training, and go-live approval.
- Vendor credentials must be configured through production secret storage, not
  committed or pasted into docs.
- DrChrono exports must be treated as production migration inputs and handled
  only after clinic approval.

## Production Assumptions

Production launch requires:

- managed Postgres;
- Redis with TLS;
- S3-compatible object storage with encryption;
- production secret store;
- production identity/MFA;
- vendor accounts and BAAs;
- webhook signing secret;
- DNS and HTTPS origin;
- alert routing;
- backup retention owner;
- signed clinic go-live packet.

See `docs/operations/production-launch-checklist.md` for the exact gate.

## Technical Risk Register

| Risk | Current Control | Buyer Handoff |
| --- | --- | --- |
| Vendor credentials unavailable | Integration packets and preflight blockers | Buyer/pilot provides accounts, BAAs, keys, callback URLs |
| Live data migration unavailable | DrChrono dry-run/no-write packet | Buyer/pilot provides exports and review staff |
| AI safety concern | Confirmation-gated proposals and audit events | Demo proposal flow and audit timeline |
| Production deployment not provisioned | Deployment runbook and config audit | Buyer provisions cloud account and secrets |
| Compliance ownership unresolved | Policy docs and approval sessions | Clinic/legal owners approve before live use |
| Verification drift | `pnpm verify:local` and acquisition report script | Run fresh receipts before diligence handoff |

## Diligence Questions And Answers

**Where is the source of truth for launch state?**

`docs/operations/completion-roadmap.md`.

**Where does demo data live?**

In browser local storage through `apps/web/src/lib/demo-api.ts` for static demo
mode, or in local demo infrastructure for full-stack development demos.

**Can the AI command layer write directly?**

No. Write-capable commands create proposals. Staff confirmation calls existing
audited action endpoints.

**What blocks real clinical use?**

External production inputs: infrastructure, BAAs, identity/MFA, vendor
credentials, DrChrono export access, staff validation, policy approval, and
clinic go-live signoff.
