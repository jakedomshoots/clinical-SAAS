# Buyer Demo Script

Canonical path: `docs/operations/buyer-demo-script.md`

Use this script for acquisition, partner, or pilot conversations. Keep the
opening statement direct:

> This is a synthetic-data Concierge OS demo. It shows the operating model,
> workflow coverage, AI safety rails, and launch-readiness controls. It is not
> connected to live clinic data or production vendor accounts.

## 5-Minute Version

1. Open Command Center.
   - Show today's queue, operational work, and navigation density.
   - Message: "This is built for repeated clinic work, not a marketing landing
     page."

2. Open a patient chart.
   - Show medications, care plan, documents, and task handoff.
   - Message: "The chart is tied to operational work, not isolated from it."

3. Open the command palette.
   - Type a patient-context command such as `create follow up task for this patient`.
   - Show that Concierge OS stages a proposal instead of writing immediately.
   - Message: "The AI layer accelerates work while preserving staff control."

4. Open Assistant Review.
   - Confirm or dismiss the staged proposal.
   - Message: "AI-assisted work is reviewable and audit-visible."

5. Open Operations.
   - Show go-live packet, credential readiness, and production blockers.
   - Message: "The product knows what is missing before live clinical use."

## 20-Minute Version

### 1. Product Frame

Explain that Concierge OS is built around clinic operations:

- front desk intake and scheduling;
- chart/document review;
- faxes and messages;
- billing work queues;
- launch readiness and vendor cutover;
- native AI commands that stage proposals.

### 2. Daily Work

Walk through:

- `/` Command Center;
- `/patients` and a patient chart;
- `/scheduling`;
- `/tasks`;
- `/faxes`;
- `/messaging`;
- `/billing`.

Call out that demo mode uses synthetic data and local persistence.

### 3. AI Safety

Open the command palette. Use one typed command and one voice command when the
browser supports speech recognition. Show:

- command input;
- staged proposal;
- inline proposal card;
- Assistant Review queue;
- confirmation or dismissal;
- audit trail.

Phrase to use:

> Concierge OS does not let AI silently mutate clinical data. It creates a
> staff-reviewable proposal and uses the existing role, confirmation, and audit
> path.

### 4. Operations And Launch Control

Open `/operations` and show:

- Go-Live Packet;
- Credential Dry-Run Binder;
- Vendor Credential Request Packet;
- Adapter Implementation Packet;
- Integration Cutover Readiness Packet;
- Production Rehearsal;
- role dry-run, staff training, policy approval, restore drill, and cutover
  sessions.

Phrase to use:

> The buyer can see exactly what is product-ready, what is demo-only, and what
> requires clinic/vendor input before live use.

### 5. Technical Confidence

Show:

- `README.md` verification commands;
- `docs/operations/technical-diligence-inventory.md`;
- latest generated acquisition report;
- latest `pnpm verify:local` receipt.

### 6. Close

End with the acquisition handoff:

- "The next real milestone is not another screen. It is a controlled hosted
  demo, buyer diligence package, and then production inputs from a pilot clinic
  or acquiring team."

## Objections

**Is this live with real vendors?**

No. The app has vendor contracts, readiness gates, and sandbox/demo lanes. Live
vendor use requires accounts, BAAs, credentials, sandbox references, callback
URLs, and signoff.

**Can the AI write clinical data?**

Only after staff review and confirmation through the same audited action path.

**Can this replace DrChrono today?**

It can demonstrate the replacement workflow today. Live replacement waits for
DrChrono export access, migration reconciliation, staff dry-runs, vendor setup,
and clinic go-live approval.
