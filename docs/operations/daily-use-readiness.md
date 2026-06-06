# Daily Use Readiness

This guide describes the operational workflows Concierge OS can support for a complete local product demo and an internal clinic pilot before live vendor credentials are connected.

## Ready In Local/Demo Mode

- Command Center shows today's operational queue, active clinic patients, blockers, open work, unread messages, and fax inbox risk.
- Command Center includes a clinic-wide Document Review Queue for outside records that need staff review before filing or reconciliation.
- Patients includes a Document Intake Workbench with status, role, and priority filters plus inline routing, reviewer, review-note, filing, reconciliation, bulk filing/reconciliation, and review-task creation actions.
- Patient charts include demographics, outside documents, medication reconciliation, care-plan/checkout items, encounters, labs, tasks, and messages.
- Patient Portal supports patient-scoped login, intake updates, appointment requests, and upload confirmation.
- Portal Intake supports chart application, appointment conversion with conflict checks, alternate slot selection, document conversion, and rejection.
- Outside documents are persisted, patient-scoped, organization-scoped, can be marked filed from the chart, can be upload-confirmed, include sending-office contact/reference and clinical review routing metadata, and duplicate upload detection is available.
- Matched inbound faxes with file URLs create patient document records for review.
- Medication and care-plan items are persisted and can be updated from the patient chart.
- Chart summary aggregates document review needs, urgent tasks, faxes, and upcoming appointments into checkout readiness.
- Billing supports charge review, case creation, eligibility checks/history, readiness-gated claim submission, denial rework, remittance placeholders, and audit/integration timelines.
- Patient outreach from tasks is consent-gated by channel, records queued/blocked/delivered state, and exposes blocked/retry counts for operations review.
- Tasks includes Work Queue Control for open/in-progress work, urgent/high priority counts, overdue/due-today/unassigned work, role buckets, source buckets, and next-action guidance.
- Reports include a daily closeout view for open tasks, aging documents, unsigned encounters, billing risk, failed integrations, recommended actions, and CSV export.
- Operations and Setup report readiness, integration event state, launch requirements, incident ownership, readiness snapshots, and demo/pilot readiness scoring.
- Integration Setup includes credential preflight for vendor env/draft fields, connection-test status, and sandbox workflow evidence.
- Operations includes a live-use rehearsal board, Operator Health, a go-live packet, browser QA evidence, role dry-run checklists, dry-run session evidence, staff training evidence, policy approval evidence, cutover runbook evidence, launch workplan, and production rehearsal report that combine readiness, incidents, closeout, credential preflight, access review, backup/restore freshness, launch evidence freshness, owner assignment, rollback decisions, manager sign-off, workplan snapshots, CSV export, and audit-backed rehearsal/training/policy/cutover evidence.
- Audit export, backup, restore validation, and local verification scripts are available.

## Staff Workflow

### Front Desk

- Start in Command Center.
- Watch today's queue for scheduled, checked-in, in-progress, and blocked patients.
- Use Document Review Queue to spot outside records that need matching, routing, or provider review, then use the Patients Document Intake Workbench to filter, route, review, file, or create tracked review tasks for incoming records.
- Use the patient chart checkout handoff before the patient leaves.
- Complete checkout tasks and schedule follow-ups from the Tasks and Scheduling sections.
- Use Work Queue Control to clear overdue work, assign unowned tasks, and prioritize urgent document, checkout, billing, and outreach work.

### Medical Assistant Or Nurse

- Open the patient chart from the queue.
- Review Documents for outside records that need filing or provider review.
- Confirm each outside document's sending office, contact/reference, route role, priority, reviewer, and review note before filing or reconciling it.
- Reconcile Meds and confirm any items marked Review.
- Work Care Plan items assigned to MA or nursing roles.
- Escalate blockers through tasks instead of untracked notes.

### Provider

- Review Clinical Flags, chart blockers, documents needing review, labs, and medication changes.
- Confirm or hold medication items as appropriate.
- Complete provider-owned Care Plan items before checkout.
- Use Tasks for follow-up calls, orders, and outside-record requests.

### Manager/Admin

- Use Operator Health and Production Config Audit in Operations to check production readiness, unsafe launch settings, backup and restore freshness, integration-event failures, credential blockers, and launch evidence gaps.
- Use the Live-Use Rehearsal Board as the manager's top-level launch view for go-live packet status, production rehearsal gates, workplan blockers, credential blockers, browser QA, staff training, policy approval, and role dry-run evidence.
- Use Go-Live Packet for final manager review and sign-off, then use Launch Workplan to review open launch blockers, incident risks, credential preflight gaps, and assigned rehearsal work in one queue; save/export snapshots before and after rehearsal fixes.
- Use Role Dry-Run Checklists to rehearse front desk, MA/nurse, provider, billing, and manager workflows before live integrations are connected; start a dry-run session, mark each item complete or blocked, and capture evidence notes.
- Use Browser QA Evidence to record manual smoke coverage for login, patients, scheduling, documents, faxes, billing, audit, assistant actions, portal intake, and reports before live-use rehearsal.
- Use Staff Training Evidence to record front desk, MA/nurse, provider, billing, and manager training sign-off for workflow usage, PHI handling, assistant policy, incident response, access review, and launch responsibilities.
- Use Policy Approval Evidence to record clinic-owner or compliance-owner approval for PHI retention, incident response, access review, backup/restore, patient outreach consent, and assistant policy before live-use rehearsal.
- Use Cutover Runbook to rehearse timed launch steps, assign owners, capture step evidence, record rollback triggers, and save the go/no-go rollback decision before live-use rehearsal or production cutover.
- Capture readiness snapshots during rehearsals and before/after fixing incidents so managers can see trend history.
- Use Reports at closeout to clear urgent tasks, aging documents, unsigned encounters, billing coding gaps, and failed integrations before the day is marked complete.
- Review audit exports for sensitive workflow activity.
- Run backup and restore validation before any live-use rehearsal.

## Not Ready Without Real Credentials

- Live EHR patient import, encounters, medications, labs, and problem-list sync.
- Live fax sending, inbound fax download, and delivery status callbacks.
- Live patient portal message sync with an external portal vendor.
- Live SMS/email delivery through a production communications vendor.
- Calendar/provider schedule sync.
- CopilotKit runtime with production tool authorization.
- Production object-storage credentials, bucket policy, and network access for document viewing.

## Required Before Real Patients

- Provision production database, Redis, and S3-compatible object storage.
- Run `pnpm migrate:api` with `AUTO_CREATE_SCHEMA=false`.
- Set `ALLOW_SEED_ENDPOINT=false`.
- Provision admin users through the approved identity workflow and review role assignments.
- Set `WEBHOOK_SHARED_SECRET` before enabling vendor callbacks.
- Confirm `/api/operations/production-config-audit` reports zero critical checks.
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
- Each role can walk through its Operations dry-run checklist with no unroutable workflow items, and the manager can save an audit-backed dry-run session with complete/blocked status and notes for launch review.
- Staff training is recorded in Operations with reviewed/signed evidence for front desk, MA/nurse, provider, billing, and manager roles before live-use rehearsal.
- Policy approval is recorded in Operations with approved/needs-changes evidence for PHI retention, incident response, access review, backup/restore, patient outreach consent, and assistant policy.
- Cutover runbook evidence is recorded in Operations with timed step owners, complete/blocked/rollback statuses, rollback readiness, and exportable go/no-go notes.
- A patient can use Patient Portal to send intake, request an appointment, and upload a document.
- Managers can export audit data, retry failed integration events, and inspect readiness.
- Managers can use Operator Health to route critical production signals to Operations, Integrations, or evidence workflows before a live-use rehearsal.
- Managers can review and sign off the Go-Live Packet, use/export the Live-Use Rehearsal Board, save and export the Launch Workplan, assign owners to rehearsal blockers, complete browser QA, staff training, policy approval, cutover runbook, and role dry-run sessions, and save/export the production rehearsal report before scheduling a live-use dry run.

## Recommended Next Build Items For Production

- Vendor-backed EHR, fax, portal, calendar, communications, clearinghouse, and object-storage adapters.
- Completed credential preflight with vendor sandbox evidence for each live adapter.
- Production validation of signed document upload and download URLs.
- Production MFA and identity-provider integration.
- Real remittance/ERA import and claim reconciliation.
- Compliance owner approval of PHI retention, incident response, backups, and access review.
