# Production Launch Checklist

Concierge OS should not be used for live clinical operations until each item is complete and signed off.

## Infrastructure

- Production `DATABASE_URL`, `REDIS_URL`, and MinIO/S3-compatible object storage are provisioned.
- `APP_ENV=production`.
- `AUTO_CREATE_SCHEMA=false`.
- `ENSURE_OBJECT_STORAGE_ON_STARTUP=true`.
- `SECRET_KEY` is unique, random, and at least 32 characters.
- `CORS_ORIGINS` contains only production HTTPS origins.
- `pnpm migrate:api` runs successfully during deployment.
- `/api/health` returns `ok`.
- `/api/ready.status` returns `ok`.

## Integrations

- `EHR_API_BASE_URL` is set and the chosen EHR adapter has been implemented.
- `FAX_PROVIDER_API_KEY` is set and the chosen fax provider adapter has been implemented.
- `PORTAL_API_BASE_URL` is set and portal messaging is vendor-tested.
- `CALENDAR_API_BASE_URL` is set and appointment sync is vendor-tested.
- `COPILOTKIT_RUNTIME_URL` is set and the runtime is reachable.
- `/api/ready.operational_status` returns `ok`.

## Security

- Default seeded admin password is changed or seed endpoint is disabled upstream.
- User provisioning is limited to admins/managers and reviewed.
- Manager-created users are limited to the manager's organization.
- Role matrix is reviewed with the clinic owner.
- Audit export access is limited to admin/manager roles.
- Session lifetime is approved for clinic policy.

## Backup And Restore

- `pnpm backup:local` succeeds against the deployed-like local stack.
- `pnpm restore:local backups/<timestamp>` has been tested on a disposable stack.
- Backup retention location and access controls are documented.
- Recovery time objective and recovery point objective are approved.

## Verification

- `pnpm verify:local` passes.
- Container app profile has been smoke-tested.
- Browser QA covers login, patients, tasks, schedule, faxes, messages, audit export, and assistant actions.
- PHI retention and incident response policies are approved.
