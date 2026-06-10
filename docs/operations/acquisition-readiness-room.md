# Acquisition Readiness Room

Canonical path: `docs/operations/acquisition-readiness-room.md`

This is the buyer-facing source of truth for reviewing Concierge OS while the
product waits for acquisition, partnership, or pilot conversations. It is
written for technical diligence, product diligence, and clinic-operations
review. It should stay honest about the current line: Concierge OS is locally
demo-ready and code-complete for synthetic-data review, but not approved for
live patient operations until the external production inputs in the launch
checklist are supplied and signed off.

## Current Position

- Product: clinic operations SaaS for front desk, scheduling, chart review,
  documents, faxes, messaging, billing work queues, launch operations, and
  confirmation-gated AI command workflows.
- Verified local state: `pnpm verify:local` passed after the latest API lint
  baseline cleanup.
- Current local checkout: `/Users/jakedom/concierge-os`.
- Latest verification-oriented commit before this packet: `c773309 chore: clean api lint baseline`.
- Demo boundary: synthetic data only. Demo mode is suitable for product,
  technical, and buyer review. It is not live clinical use.
- Production boundary: live use waits for BAAs, deployment accounts,
  production identity/MFA, vendor credentials, DrChrono export access, staff
  validation, and go-live signoff.

## Room Index

Use these documents as the acquisition room table of contents:

- Product status and launch boundary: `docs/operations/completion-roadmap.md`
- Buyer demo setup: `docs/operations/hosted-demo-environment.md`
- Buyer demo talk track: `docs/operations/buyer-demo-script.md`
- Product diligence hardening: `docs/operations/product-diligence-hardening.md`
- AI command differentiation: `docs/operations/ai-command-differentiation.md`
- Technical diligence inventory: `docs/operations/technical-diligence-inventory.md`
- Production launch checklist: `docs/operations/production-launch-checklist.md`
- Vendor adapter plan: `docs/integrations/vendor-adapter-plan.md`
- Compliance procedures: `docs/compliance/phi-retention-and-incident-response.md`

## Buyer Narrative

Concierge OS is positioned as a clinical operations command center for clinics
that are trying to replace fragmented front-office and DrChrono-dependent
workflows. The current product emphasizes:

- fast staff navigation across patients, tasks, schedule, faxes, messages,
  billing, and operations;
- synthetic-data demo workflows that show a complete clinic day without PHI;
- role-gated, audit-visible operational actions;
- launch-readiness packets that make external blockers explicit instead of
  hiding them in a spreadsheet;
- a native AI command layer that stages proposals for staff review before any
  clinical write.

The strongest buyer story is not "all vendor accounts are connected." The
strongest story is "the product already knows how to operate safely, and it has
clear gates for the vendor and clinic inputs that a buyer or pilot clinic must
provide."

## Evidence To Show First

1. `README.md` for product surface, local setup, and verification commands.
2. `docs/operations/completion-roadmap.md` for local completion status and live
   launch blockers.
3. `docs/operations/hosted-demo-environment.md` for a repeatable buyer demo.
4. `docs/operations/technical-diligence-inventory.md` for architecture,
   verification, data boundaries, and risk register.
5. `docs/operations/ai-command-differentiation.md` for the product moat.
6. The generated report from:

   ```sh
   pnpm acquisition:report
   ```

   For a stronger bundle with fast checks:

   ```sh
   RUN_CHECKS=1 pnpm acquisition:report
   ```

## Review Agenda

Use this order for a 60-minute acquisition review:

1. Product overview and market wedge: 10 minutes.
2. Synthetic-data demo: 20 minutes.
3. Native AI command layer and safety model: 10 minutes.
4. Technical architecture and verification receipts: 10 minutes.
5. Production blockers, vendor lanes, and acquisition handoff path: 10 minutes.

## Clean Claims

Safe claims:

- Concierge OS is locally demo-ready with synthetic data.
- Major clinic workflows are represented in the product surface.
- AI actions are staged as proposals and require confirmation before writes.
- The app has operational readiness packets for launch, credential, vendor,
  migration, backup, restore, and staff validation workflows.
- Production launch blockers are explicit and tracked.

Do not claim:

- The product is ready for real patients.
- Vendor integrations are live with real clinic accounts.
- The app has completed clinic legal, BAA, staff, or payer enrollment review.
- AI can autonomously perform clinical writes.

## Acquisition Workstreams

### 1. Acquisition Readiness Room

Outcome: buyer can review product, architecture, safety model, demo path, and
known blockers from a single document set.

Owner artifact: this document.

### 2. Hosted Demo Environment

Outcome: buyer can open a deployed demo that uses synthetic data and does not
require clinic credentials.

Owner artifact: `docs/operations/hosted-demo-environment.md`.

### 3. Product Diligence Hardening

Outcome: confusing demo, placeholder, and legacy-brand wording is controlled.
Buyer sees intentional product boundaries instead of unfinished-product noise.

Owner artifact: `docs/operations/product-diligence-hardening.md`.

### 4. AI Command Moat Polish

Outcome: the native command layer is framed as a clinical workflow accelerator
with safety rails, not as a generic chatbot.

Owner artifact: `docs/operations/ai-command-differentiation.md`.

### 6. Technical Diligence Cleanup

Outcome: buyer can inspect stack, data boundaries, verification receipts,
deployment assumptions, and live-use blockers without reading the whole repo.

Owner artifact: `docs/operations/technical-diligence-inventory.md`.
