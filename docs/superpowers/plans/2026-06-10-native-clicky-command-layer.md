# Native Clicky Command Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ConciergeOS-native typed and voice command functionality that stages confirmation-gated AI proposals without depending on the external Clicky app.

**Architecture:** Replace in-memory assistant proposals with a persistent database model, add a deterministic command interpretation endpoint, and upgrade the existing global command palette to submit typed or transcribed voice commands. Existing assistant action endpoints remain the only write paths, so every clinical mutation stays permission-gated and audit-visible.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, Pydantic, React, TanStack Router, TanStack Query, TypeScript, browser SpeechRecognition when available.

---

### Task 1: Persistent Assistant Proposals

**Files:**
- Create: `apps/api/app/models/assistant_proposal.py`
- Create: `apps/api/alembic/versions/010_assistant_proposals.py`
- Modify: `apps/api/app/models/__init__.py`
- Modify: `apps/api/app/services/assistant_proposals.py`
- Modify: `apps/api/app/routers/assistant.py`
- Test: `apps/api/tests/routers/test_assistant.py`

- [ ] Add tests that proposal source supports `concierge_command`, proposals persist through the database session, and expired proposals cannot be confirmed.
- [ ] Run `uv run pytest tests/routers/test_assistant.py::test_concierge_command_proposal_persists_and_can_be_listed tests/routers/test_assistant.py::test_expired_assistant_proposal_cannot_be_confirmed -q` and verify failure.
- [ ] Add the SQLAlchemy model, migration, and service functions.
- [ ] Run the focused tests and verify pass.

### Task 2: Command Interpretation Endpoint

**Files:**
- Modify: `apps/api/app/schemas/assistant.py`
- Create: `apps/api/app/services/assistant_commands.py`
- Modify: `apps/api/app/routers/assistant.py`
- Test: `apps/api/tests/routers/test_assistant.py`

- [ ] Add tests for typed follow-up task command, navigation command, summary command, disabled policy rejection, and ambiguous command clarification.
- [ ] Run the focused new tests and verify failure.
- [ ] Add command request/result schemas and deterministic interpreter.
- [ ] Wire `POST /api/assistant/actions/commands`.
- [ ] Run the focused tests and verify pass.

### Task 3: Web Command And Voice UI

**Files:**
- Modify: `packages/shared/src/types/assistant.ts`
- Modify: `apps/web/src/lib/assistant-tools.ts`
- Modify: `apps/web/src/lib/demo-api.ts`
- Modify: `apps/web/src/router/routes/__root.tsx`
- Modify: `apps/web/src/router/routes/assistant-review.tsx`

- [ ] Add shared command/proposal types.
- [ ] Add command submit helper.
- [ ] Add demo API command/proposal persistence parity.
- [ ] Upgrade the command palette with Search and AI Command modes, typed submit, push-to-talk transcript, result display, and proposal refresh.
- [ ] Update proposal UI labels to use `Concierge command` for native command proposals.
- [ ] Run `pnpm exec tsc -b packages/shared apps/web --pretty false` and `pnpm --filter @concierge-os/web lint`.

### Task 4: Inline Proposal Cards

**Files:**
- Create: `apps/web/src/components/assistant/inline-proposals.tsx`
- Modify: `apps/web/src/router/routes/patients/$patientId.tsx`
- Modify: `apps/web/src/router/routes/faxes/index.tsx`
- Modify: `apps/web/src/router/routes/messaging/index.tsx`
- Modify: `apps/web/src/router/routes/billing.tsx`
- Modify: `apps/web/src/router/routes/index.tsx`

- [ ] Add reusable inline proposal cards using the same confirm/dismiss helpers as Assistant Review.
- [ ] Render route-relevant pending proposals on the first high-value surfaces.
- [ ] Run typecheck, lint, smoke, and build.

### Task 5: SaaS Readiness Closure

**Files:**
- Modify: `docs/operations/completion-roadmap.md`
- Modify: `docs/operations/production-launch-checklist.md`

- [ ] Update the roadmap so native ConciergeOS command functionality replaces the old Clicky integration framing.
- [ ] Re-run local verification.
- [ ] Commit all code and docs.
- [ ] Stop only where production SaaS work requires cloud accounts, vendor credentials, BAAs, DrChrono export files, staff roster, clinic approvals, or go-live sign-off.
