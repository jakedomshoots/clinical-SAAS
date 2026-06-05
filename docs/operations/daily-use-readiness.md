# Daily Use Readiness

This guide describes the operational workflows Concierge OS can support before live vendor credentials are connected, and what must be completed before using it with real patients.

## Ready In Local/Demo Mode

- Command Center shows today's operational queue, active clinic patients, blockers, open work, unread messages, and fax inbox risk.
- Patient charts include demographics, outside documents, medication reconciliation, care-plan/checkout items, encounters, labs, tasks, and messages.
- Outside documents are persisted, patient-scoped, organization-scoped, and can be marked filed from the chart.
- Matched inbound faxes with file URLs create patient document records for review.
- Medication and care-plan items are persisted and can be updated from the patient chart.
- Chart summary aggregates document review needs, urgent tasks, faxes, and upcoming appointments into checkout readiness.
- Operations dashboard reports readiness and integration event state.
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
- Patient portal message sync.
- Calendar/provider schedule sync.
- CopilotKit runtime with production tool authorization.
- Production object-storage download URLs for document viewing.

## Required Before Real Patients

- Provision production database, Redis, and S3-compatible object storage.
- Run `pnpm migrate:api` with `AUTO_CREATE_SCHEMA=false`.
- Set `ALLOW_SEED_ENDPOINT=false`.
- Replace demo admin credentials and review role assignments.
- Configure vendor adapters listed in `docs/integrations/vendor-adapter-plan.md`.
- Confirm `/api/ready` reports `operational_status: ok`.
- Run `pnpm verify:local`.
- Test backup and restore on a disposable stack.
- Review PHI retention and incident-response policy with the clinic owner.

## Recommended Next Build Items

- Signed download URLs for document viewing.
- Dedicated role-filtered queues for front desk, MA/nurse, provider, and manager.
- EHR adapter implementation for medications, labs, encounters, and demographics.
- Lab result persistence and review workflow.
- Encounter/note persistence and provider sign-off workflow.
- Browser-level smoke assertions for the Command Center and patient chart tabs.
