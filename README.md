# Concierge OS

Concierge OS is a clinic operations workspace for patient search, tasking, scheduling, faxes, messaging, audit review, and a confirmation-gated clinical assistant.

## Current Product Surface

- React/Vite web app with local development demo data gated behind demo mode.
- FastAPI backend with auth, role-gated operational mutations, audit logging, and test coverage for the core routers.
- Clinical assistant rail that can stage follow-up tasks, draft portal replies, and stage fax matches after staff confirmation.
- Optional CopilotKit v2 bridge that is off by default, lazy-loaded when configured, and exposes the same clinical tools as confirmation-required actions.

## Local Setup

Install workspace dependencies:

```sh
pnpm install
```

Start infrastructure:

```sh
pnpm dev:infra
```

Start the API:

```sh
pnpm dev:api
```

Start the web app:

```sh
pnpm dev:web
```

Open the web app at `http://localhost:5173`. In local development, demo mode can use `demo-dev-token` for local demo data; real API login failures do not fall back to demo data.

Run the containerized app stack:

```sh
docker compose -f docker/docker-compose.yml --profile app up --build
```

The containerized web app listens at `http://localhost:8080` and proxies `/api` to the API container.

## Environment

Copy `.env.example` into the environment file used by each app as needed. The API reads `apps/api/.env` by default.

CopilotKit is disabled unless one of these web env vars is set before starting Vite:

```sh
VITE_COPILOTKIT_RUNTIME_URL=/api/copilotkit
VITE_COPILOTKIT_PUBLIC_API_KEY=
```

Use a runtime URL for a self-managed CopilotKit runtime, or a public API key for CopilotKit Cloud. The frontend forwards the logged-in bearer token to the CopilotKit provider when enabled.

The API readiness endpoint reports external integration configuration under `integrations`.
Populate these when moving beyond demo/local operation:

```sh
EHR_API_BASE_URL=
FAX_PROVIDER_API_KEY=
PORTAL_API_BASE_URL=
CALENDAR_API_BASE_URL=
COPILOTKIT_RUNTIME_URL=
COMMUNICATIONS_PROVIDER=
COMMUNICATIONS_PROVIDER_API_KEY=
CLEARINGHOUSE_API_BASE_URL=
CLEARINGHOUSE_API_KEY=
USE_SANDBOX_ADAPTERS=false
```

`/api/ready.status` reflects core infrastructure. `/api/ready.operational_status` includes these external integration checks.
Configured credentials do not make an integration live-ready by themselves; placeholder vendor adapters keep `/api/ready.operational_status` and `/api/integrations/credential-preflight` blocked until the adapter is implemented and sandbox evidence is recorded.
Set `USE_SANDBOX_ADAPTERS=true` only for local contract rehearsal; it enables deterministic fake adapters so teams can test adapter wiring before real vendor credentials are available.

## Verification

Frontend:

```sh
pnpm exec tsc -b packages/shared apps/web --pretty false
pnpm --filter @concierge-os/web lint
pnpm --filter @concierge-os/web build
pnpm --filter @concierge-os/web smoke
pnpm --filter @concierge-os/web audit:frontend
```

Backend:

```sh
cd apps/api
uv run pytest
```

All local checks:

```sh
pnpm verify:local
```

Container config:

```sh
docker compose -f docker/docker-compose.yml --profile app config
```

Local backup:

```sh
pnpm backup:local
```

Backups are written under `backups/<timestamp>/` with a Postgres dump, MinIO object archive, and a manifest.

Local restore:

```sh
pnpm restore:local backups/<timestamp>
```

Validate a backup folder without restoring it:

```sh
pnpm backup:validate backups/<timestamp>
```

Run API migrations explicitly before production-style startup:

```sh
pnpm migrate:api
```

For production-like environments, set `AUTO_CREATE_SCHEMA=false` and run migrations as a deploy step. Development keeps `AUTO_CREATE_SCHEMA=true` so local/test databases can still bootstrap quickly.

## Demo And Internal Pilot Readiness

Ready for complete local product demos and internal clinic pilot dry runs:

- Demo-mode walkthroughs across all major operational routes, including Patient Portal, Portal Intake, Billing, Operations, and Setup.
- API test suite coverage for auth, patients, tasks, scheduling, faxes, messages, audit, and role permissions.
- Organization-level isolation across patients, tasks, messages, faxes, scheduling, and audit logs.
- Backup and restore commands for local Postgres and MinIO data.
- Assistant actions are confirmation-gated and audit-visible in demo/API flows.
- `/api/analytics/pilot-readiness` and `/setup` report product demo and internal pilot readiness scores.
- `/setup` can seed the missing local pilot workspace data required to reach 100% demo/pilot readiness.

Not ready for real daily clinical operations with live patients yet:

- CopilotKit still needs a deployed runtime endpoint and model policy before live use.
- Production identity/MFA, monitoring, and deployment secrets need final clinic-specific configuration.
- EHR, fax, external portal, calendar, communications, clearinghouse, and object-storage integrations are still local/demo or adapter surfaces.
- Compliance policies need clinic/legal owner approval before live PHI use.

Operational docs:

- [Production launch checklist](docs/operations/production-launch-checklist.md)
- [Vendor adapter plan](docs/integrations/vendor-adapter-plan.md)
- [PHI retention and incident response](docs/compliance/phi-retention-and-incident-response.md)
