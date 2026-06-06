# Deployment Runbook

Use this runbook after production credentials and infrastructure have been provisioned.

## Preflight

- Copy `.env.production.example` into the deployment secret store.
- Replace every placeholder value.
- Confirm `/api/operations/production-config-audit` has status `ready`.
- Run `pnpm verify:local`.
- Run `pnpm migrate:api` against the target database.

## Launch

- Deploy API and web containers.
- Confirm `/api/health` returns `ok`.
- Confirm `/api/ready` reports core infrastructure `ok`.
- Confirm Operations shows integration readiness and no unexpected failed events.

## Monitoring

- Run `BASE_URL=https://<production-host> sh scripts/health-report.sh` from a trusted workstation.
- Configure uptime checks for `/api/health` and `/api/ready`.
- Alert on failed integration events, failed backups, and degraded object storage.

## Backups

- Schedule `scripts/backup-local.sh` or the production equivalent daily.
- Run `scripts/validate-backup.sh <backup-dir>` after each backup.
- Restore into a disposable environment at least monthly.

## Rollback

- Keep the previous API/web image available.
- Roll back web first, then API.
- Do not roll back database migrations without a written migration-specific rollback plan.
