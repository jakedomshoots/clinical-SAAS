# PHI Retention And Incident Response

This document is an operational template. A compliance owner should review and approve it before live clinical use.

Policy approval should be recorded in Operations before any live-use rehearsal. Use the policy approval evidence workflow to mark PHI retention, incident response, access review, backup/restore, patient outreach consent, and assistant policy as approved or needing changes, with reviewer notes.

## PHI Retention

- Patient records: retain according to clinic, state, and payer requirements.
- Audit logs: retain for at least the clinic-approved audit period.
- Fax documents and OCR text: retain only as long as operationally required, then purge according to policy.
- Backups: encrypt at rest, restrict access, and expire according to the approved retention schedule.
- Demo data: never mix with real PHI.

## Access Review

- Review active users monthly.
- Remove inactive users immediately after offboarding.
- Review admin and manager accounts monthly.
- Export and review audit events for user provisioning, patient access, fax matches, message drafts, and assistant actions.

## Incident Response

1. Identify the affected tenant, user, record, or integration.
2. Disable compromised accounts or integration credentials.
3. Preserve relevant audit exports and infrastructure logs.
4. Assess PHI exposure scope.
5. Notify the compliance owner and legal contact.
6. Rotate affected credentials.
7. Restore from a known-good backup if needed.
8. Document timeline, root cause, corrective actions, and follow-up owner.

## Disaster Recovery Drill

- Run a backup.
- Restore into a disposable environment.
- Confirm login and core data visibility.
- Confirm object files are present.
- Record backup reference, RTO/RPO minutes, failures, and next corrective action in the Operations restore drill evidence workflow.
