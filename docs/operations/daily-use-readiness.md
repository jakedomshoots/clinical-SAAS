# Daily Use Readiness

This guide describes the operational workflows Concierge OS can support for a complete local product demo and an internal clinic pilot before live vendor credentials are connected.

## Ready In Local/Demo Mode

- Command Center shows today's operational queue, active clinic patients, blockers, open work, unread messages, and fax inbox risk.
- Patient charts include demographics, outside documents, medication reconciliation, care-plan/checkout items, encounters, labs, tasks, and messages.
- Patient Portal supports patient-scoped login, intake updates, appointment requests, and upload confirmation.
- Portal Intake supports chart application, appointment conversion with conflict checks, alternate slot selection, document conversion, and rejection.
- Outside documents are persisted, patient-scoped, organization-scoped, can be marked filed from the chart, can be upload-confirmed, and duplicate upload detection is available.
- Matched inbound faxes with file URLs create patient document records for review.
- Medication and care-plan items are persisted and can be updated from the patient chart.
- Chart summary aggregates document review needs, urgent tasks, faxes, and upcoming appointments into checkout readiness.
- Billing supports charge review, case creation, eligibility checks/history, claim submit/deny/payment, and audit/integration timelines.
- Patient outreach from tasks is consent-gated by channel, records queued/blocked/delivered state, and exposes blocked/retry counts for operations review.
- Operations and Setup report readiness, integration event state, launch requirements, and demo/pilot readiness scoring.
- Audit export, backup, restore validation, and local verification scripts are available.

## Staff Workflow

### Front Desk

- Start in Command Center.
- Watch today's queue for scheduled, checked-in, in-progress, and blocked patients.
- Use the patient chart checkout handoff before the patient leaves.
- Complete checkout tasks and schedule follow-ups from the Tasks and Scheduling sections.

### Medical Assistant Or Nurse

- Open the patient chart from the queue.
- Review Documents for outside records that need filing or provider review.
- Reconcile Meds and confirm any items marked Review.
- Work Care Plan items assigned to MA or nursing roles.
- Escalate blockers through tasks instead of untracked notes.

### Provider

- Review Clinical Flags, chart blockers, documents needing review, labs, and medication changes.
- Confirm or hold medication items as appropriate.
- Complete provider-owned Care Plan items before checkout.
- Use Tasks for follow-up calls, orders, and outside-record requests.

### Manager/Admin

- Use Operations to check production readiness and integration-event failures.
- Review audit exports for sensitive workflow activity.
- Run backup and restore validation before any live-use rehearsal.

## Not Ready Without Real Credentials

- Live EHR patient import, encounters, medications, labs, and problem-list sync.
- Live fax sending, inbound fax download, and delivery status callbacks.
- Live patient portal message sync with an external portal vendor.
- Live SMS/email delivery through a production communications vendor.
- Calendar/provider schedule sync.
- CopilotKit runtime with production tool authorization.
- Production object-storage download URLs for document viewing.

## Required Before Real Patients

- Provision production database, Redis, and S3-compatible object storage.
- Run `pnpm migrate:api` with `AUTO_CREATE_SCHEMA=false`.
- Set `ALLOW_SEED_ENDPOINT=false`.
- Provision admin users through the approved identity workflow and review role assignments.
- Set `WEBHOOK_SHARED_SECRET` before enabling vendor callbacks.
- Configure vendor adapters listed in `docs/integrations/vendor-adapter-plan.md`.
- Approve patient outreach consent policy and test queued, blocked, failed, and delivered callback states.
- Confirm `/api/ready` reports `operational_status: ok`.
- Run `pnpm verify:local`.
- Test backup and restore on a disposable stack.
- Review PHI retention and incident-response policy with the clinic owner.

## Internal Pilot Definition

An internal clinic pilot is ready when:

- `/setup` reports Product Demo and Internal Pilot at 100%.
- If either score is below 100%, use `/setup` → Seed pilot workspace or call `POST /api/analytics/pilot-readiness/seed` as an admin to create the missing local pilot data.
- `pnpm verify:local` passes, including all API tests, web type checks, lint, frontend audit, and smoke checks.
- Staff can complete a dry-run day from Command Center through checkout, documents, messaging, faxes, billing, operations, and reports.
- A patient can use Patient Portal to send intake, request an appointment, and upload a document.
- Managers can export audit data, retry failed integration events, and inspect readiness.

## Recommended Next Build Items For Production

- Vendor-backed EHR, fax, portal, calendar, communications, clearinghouse, and object-storage adapters.
- Signed production download URLs for document viewing.
- Production MFA and identity-provider integration.
- Real remittance/ERA import and claim reconciliation.
- Compliance owner approval of PHI retention, incident response, backups, and access review.
