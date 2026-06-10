# Product Diligence Hardening

Canonical path: `docs/operations/product-diligence-hardening.md`

This checklist keeps Concierge OS clean for buyer review. It focuses on product
truthfulness: demo mode should look intentional, not unfinished; production
blockers should be visible, not hidden; and legacy integration language should
not confuse the native Concierge OS direction.

## Hardening Rules

- Demo copy must say synthetic data, demo, sandbox, or local rehearsal when that
  is what the user is seeing.
- Production claims must be tied to the launch checklist and vendor evidence.
- Native AI command functionality should be called Concierge command, native AI
  command, Assistant proposal, or Assistant Review.
- User-facing UI should not imply an external assistant dependency.
- Placeholder vendor adapters should be explained as blocked live-use lanes, not
  hidden as complete integrations.
- "In production this would..." comments should not appear in buyer-facing UI.
  Developer comments can remain only when they clarify a real boundary.

## Current Cleanup Completed

- Assistant Review now labels staged work as Assistant proposals rather than
  legacy branded proposal copy.
- Demo-created assistant proposal IDs now use `demo-assistant-proposal-*`.
- The acquisition room, hosted demo guide, and AI differentiation docs make the
  synthetic-data and live-use boundaries explicit.

## Buyer-Facing Surfaces To Recheck Before Every Demo

- `/login`
- `/`
- `/patients`
- `/patients/:patientId`
- `/assistant-review`
- `/operations`
- `/integrations`
- `/setup`
- `/billing`
- `/faxes`
- `/messaging`

Use:

```sh
pnpm --filter @concierge-os/web audit:frontend
pnpm --filter @concierge-os/web smoke
```

## Wording Checklist

Use:

- "synthetic-data demo"
- "local rehearsal"
- "production vendor evidence required"
- "confirmation-gated AI proposal"
- "audit-visible staff action"
- "external blocker"
- "buyer/pilot input required"

Avoid:

- "live-ready" unless all launch checklist gates are actually satisfied;
- "autonomous AI";
- "external assistant integration" for the current product;
- "production adapter complete" without vendor evidence;
- "HIPAA complete" without signed BAA and clinic policy approval.

## Diligence Risk Register

| Risk | Buyer Concern | Current Control | Next Action |
| --- | --- | --- | --- |
| Demo confused with production | Buyer thinks live readiness is being overstated | Demo and launch docs separate synthetic review from live use | Keep demo disclaimers visible in every handoff |
| Vendor accounts missing | Buyer sees integration gaps | Credential preflight and cutover packets show blockers | Use vendor request packet during diligence |
| AI trust | Buyer worries about unsafe automation | Commands stage proposals and require confirmation | Demo proposal confirmation and audit trail |
| DrChrono migration | Buyer worries about data migration | Dry-run packet and no-write import batch artifacts | Require real export before final migration work |
| Compliance ownership | Buyer worries about HIPAA operations | PHI retention and incident response docs exist | Require clinic/legal approval before live use |
