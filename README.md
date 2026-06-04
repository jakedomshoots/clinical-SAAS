# Concierge OS

Concierge OS is a clinic operations workspace for patient search, tasking, scheduling, faxes, messaging, audit review, and a confirmation-gated clinical assistant.

## Current Product Surface

- React/Vite web app with demo fallback data for local exploration.
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

Open the web app at `http://localhost:5173`. If the API is unavailable, the frontend falls back to local demo data after login or API request failure.

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

Container config:

```sh
docker compose -f docker/docker-compose.yml --profile app config
```

## Daily-Use Readiness

Ready for local product work:

- Demo-mode walkthroughs across the main operational routes.
- API test suite coverage for auth, patients, tasks, scheduling, faxes, messages, audit, and role permissions.
- Assistant actions are confirmation-gated and audit-visible in demo/API flows.

Not ready for real daily clinical operations yet:

- CopilotKit still needs a deployed runtime endpoint and model policy before live use.
- Assistant actions need backend-owned action endpoints so the AI path never relies on frontend-only mutation orchestration.
- Production auth, account provisioning, tenant isolation, backups, monitoring, and deployment secrets are not finalized.
- EHR, fax, portal, calendar, and object-storage integrations are still local/demo surfaces.
- Compliance hardening needs a pass over PHI retention, access logging, audit exports, session policy, and disaster recovery.
