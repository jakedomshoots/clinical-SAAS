# Pre-Sales SaaS Readiness

ConciergeOS can be prepared as a sellable SaaS demo and staging product before a clinic signs, shares credentials, or supplies production PHI.

## Self-Service Buildout

These areas do not require customer-owned clinic credentials:

1. **Production-like app infrastructure** - staging host, managed Postgres, Redis, object storage, logs, alerts, backup jobs, health checks, and deployment runbook.
2. **SaaS account model** - organization-scoped users, roles, trial workspace defaults, and tenant-safe data boundaries.
3. **Sales demo workspace** - synthetic patients, schedule, faxes, messages, tasks, billing cases, and resettable walkthrough data.
4. **Vendor-neutral integrations** - sandbox and placeholder lanes for fax, communications, clearinghouse, Labs/HIE, payments, eRx, identity, and calendar.
5. **Native AI functionality** - typed and voice command input, staged proposals, inline proposal review, assistant review, audit events, and demo-safe command flows.
6. **Sales/admin readiness** - setup checklist, operations readiness, trial workspace story, product tour script, and readiness score.
7. **Compliance prep without PHI** - retention, incident response, access review, backup/restore, audit export, downtime, assistant policy, and launch evidence procedures.

## Current Product Surface

- API: `GET /api/analytics/presales-saas-readiness`
- UI: `/setup`, "Pre-Sales SaaS Buildout"
- Demo seeding: `POST /api/analytics/pilot-readiness/seed` when seed endpoints are allowed outside production
- Native AI command toggle: Settings panel in the app shell

## External Inputs Deferred Until Sale

- Clinic BAA, DNS, production ownership, and billing contact
- Staff roster, identity provider, MFA policy, and role approval
- DrChrono export/API access, attachment files, freeze window, and migration sign-off
- Vendor accounts, credentials, enrollment approvals, support contacts, and callback URLs
- Clinic workflow validation, training sessions, compliance approval, and go-live sign-off

## Demo Safety Rule

Pre-sales work must use synthetic data only. Do not import real patient data, use live vendor credentials, or route PHI through AI, transcription, communications, fax, clearinghouse, eRx, labs, or payment services until the customer has signed the required agreements and approved the production configuration.
