# Production Launch Checklist

Concierge OS should not be used for live clinical operations until each item is complete and signed off.

## Infrastructure

- Production `DATABASE_URL`, `REDIS_URL`, and MinIO/S3-compatible object storage are provisioned.
- `.env.production.example` has been copied into the deployment secret store and all placeholders are replaced.
- `APP_ENV=production`.
- `AUTO_CREATE_SCHEMA=false`.
- `ENSURE_OBJECT_STORAGE_ON_STARTUP=true`.
- `ALLOW_SEED_ENDPOINT=false`.
- `WEBHOOK_SHARED_SECRET` is unique, random, and shared only with trusted webhook senders.
- `SECRET_KEY` is unique, random, and at least 32 characters.
- `CORS_ORIGINS` contains only production HTTPS origins.
- `/api/operations/production-config-audit` has status `ready` with zero critical checks.
- `pnpm migrate:api` runs successfully during deployment.
- `docs/operations/deployment-runbook.md` is reviewed and assigned to an owner.
- `BASE_URL=<production-host> sh scripts/health-report.sh` succeeds from a trusted workstation.
- `/api/health` returns `ok`.
- `/api/ready.status` returns `ok`.

## Integrations

- `EHR_API_BASE_URL` is set and the chosen EHR adapter has been implemented.
- `FAX_PROVIDER_API_KEY` is set and the chosen fax provider adapter has been implemented.
- `PORTAL_API_BASE_URL` is set and portal messaging is vendor-tested.
- SMS/email delivery provider is selected; queued `patient_outreach.staged` events are routed through the provider and delivery callbacks update status.
- Communications delivery callbacks have been tested for queued, blocked, failed, and delivered states.
- `COMMUNICATIONS_PROVIDER` and `COMMUNICATIONS_PROVIDER_API_KEY` are set for the chosen SMS/email/portal vendor.
- Clearinghouse claim submission, denial, payment, and remittance/ERA callbacks are vendor-tested against the billing work queue.
- `/api/integrations/credential-preflight` has no missing or blocked integration items, and every sandbox workflow has recorded passing evidence with notes or a vendor reference.
- `CALENDAR_API_BASE_URL` is set and appointment sync is vendor-tested.
- `COPILOTKIT_RUNTIME_URL` is set and the runtime is reachable.
- `/api/ready.operational_status` returns `ok`.

## Security

- Startup admin seeding is disabled, one-time seed endpoints are disabled, and production admin accounts are provisioned through the approved identity workflow.
- User provisioning is limited to admins/managers and reviewed.
- Newly provisioned users receive temporary credentials that expire and must be rotated before a normal session is issued.
- Password resets are issued only through Staff recovery controls, expire as temporary credentials, and are reviewed in audit events.
- Manager-created users are limited to the manager's organization.
- Manager-created users cannot be assigned admin access.
- Production staff login blocks session issuance until MFA enrollment is recorded.
- Role matrix is reviewed with the clinic owner.
- Audit export access is limited to admin/manager roles.
- Patient document viewer access is audited and expiring access metadata is reviewed.
- Patient outreach consent policy is approved before enabling real SMS/email sends.
- Session lifetime is approved for clinic policy.

## Backup And Restore

- `pnpm backup:local` succeeds against the deployed-like local stack.
- `pnpm restore:local backups/<timestamp>` has been tested on a disposable stack.
- `/api/operations/restore-drill-sessions` includes an audit-backed restore drill with backup reference, disposable restore evidence, object-file check, RTO/RPO minutes, and CSV export.
- Backup retention location and access controls are documented.
- Recovery time objective and recovery point objective are approved.

## Verification

- `pnpm verify:local` passes.
- Container app profile has been smoke-tested.
- Browser QA covers login, patients, tasks, schedule, faxes, messages, audit export, and assistant actions.
- Browser QA covers Command Center queue blockers, patient Documents, Meds, and Care Plan actions.
- Browser QA covers staff admin, task outreach staging, document preview/download modes, and schedule conflict handling.
- `/api/operations/operator-health` has no critical checks, backup/restore freshness is current, integration failures are cleared, and launch evidence gaps are assigned before the live-use rehearsal.
- `/api/operations/alert-rules` has no critical triggered rules, and `/api/operations/incident-timeline` has been reviewed for failed integrations, blocked logins, expired onboarding, backup/restore gaps, and document access review signals.
- `/api/operations/live-use-rehearsal` has been reviewed/exported by the manager and has no blocking gates before the live-use rehearsal starts.
- `/api/operations/production-rehearsal` has been reviewed, saved as rehearsal evidence, exported for the launch packet, and every blocking gate has an assigned owner, status, due date, and launch note before the rehearsal starts.
- `/api/operations/launch-workplan` has no unassigned blocking launch items before the rehearsal starts, and a saved/exported workplan snapshot is included in the launch packet.
- `/api/operations/go-live-packet` has been reviewed by the manager/clinic owner as the final launch packet summary, and an audit-backed approval or needs-changes attestation has been recorded.
- `/api/operations/browser-qa-sessions` includes a completed QA session with passed/failed status and evidence notes for login, patients, scheduling, documents, faxes, billing, audit, assistant actions, portal intake, and reports.
- `/api/operations/role-dry-run-checklists` has been reviewed with front desk, MA/nurse, provider, billing, and manager staff.
- `/api/operations/role-dry-run-sessions` includes a completed dry-run session with complete/blocked status and evidence notes for each role before the live-use rehearsal.
- `/api/operations/staff-training-sessions` includes a completed staff training session with reviewed/signed status and evidence notes for front desk, MA/nurse, provider, billing, and manager responsibilities before the live-use rehearsal.
- `/api/operations/policy-approval-sessions` includes a completed policy approval session with approved/needs-changes status and evidence notes for PHI retention, incident response, access review, backup/restore, patient outreach consent, and assistant policy before the live-use rehearsal.
- `/api/operations/restore-drill-sessions` includes a completed restore drill session with complete/blocked checklist item status, RTO/RPO evidence, and exportable notes before the live-use rehearsal.
- `/api/operations/cutover-runbook-sessions` includes a completed cutover session with each timed step assigned, complete/blocked/rollback status captured, rollback readiness reviewed, and go/no-go decision notes exported before production cutover.
- Daily-use workflow in `docs/operations/daily-use-readiness.md` is reviewed with front desk, MA/nurse, provider, and manager roles.
- PHI retention and incident response policies are approved.
