# Clicky Concierge Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend Clicky's native macOS voice, screen, and pointing layer with ConciergeOS's audited clinical workflow platform to create a safe desktop-aware clinical operations copilot.

**Architecture:** ConciergeOS remains the source of truth for patients, tasks, faxes, messages, billing, operations, audit, role policy, and confirmations. Clicky becomes a native macOS companion that captures voice and screen context, generates navigation help and staged proposals, then sends those proposals into ConciergeOS for staff confirmation before any clinical mutation occurs.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React/Vite, TanStack Router, TanStack Query, TypeScript shared types, SwiftUI/AppKit macOS menu bar app, ScreenCaptureKit, Cloudflare Worker proxy, existing ConciergeOS audit and assistant policy services.

---

## Source Of Truth

This document is the product and implementation source of truth for the Clicky + ConciergeOS blend.

Canonical path: `docs/operations/clicky-concierge-integration-plan.md`

Related source paths:

- ConciergeOS roadmap: `docs/operations/completion-roadmap.md`
- Existing assistant backend: `apps/api/app/routers/assistant.py`
- Existing assistant policy: `apps/api/app/services/assistant_policy.py`
- Existing assistant schemas: `apps/api/app/schemas/assistant.py`
- Existing assistant tests: `apps/api/tests/routers/test_assistant.py`
- Existing web assistant tools: `apps/web/src/lib/assistant-tools.ts`
- Assistant review route: `apps/web/src/router/routes/assistant-review.tsx`
- Demo API parity layer: `apps/web/src/lib/demo-api.ts`
- Shared package: `packages/shared/src`
- Clicky Swift app: `/Users/jakedom/Documents/clicky-main/leanring-buddy`
- Clicky worker: `/Users/jakedom/Documents/clicky-main/worker`

## Product Boundary

Clicky can:

- Listen through push-to-talk.
- Capture visible screen context.
- Explain what staff is looking at.
- Point to visible UI elements.
- Suggest navigation.
- Draft proposed clinical or operational actions.
- Send proposed actions into ConciergeOS.

Clicky cannot:

- Directly create, update, send, delete, or match clinical records.
- Bypass ConciergeOS authentication.
- Bypass role policy.
- Bypass staff confirmation.
- Bypass audit logging.
- Send live PHI to external model services unless the clinic has explicitly approved that deployment policy.

ConciergeOS must own:

- Patient, task, fax, message, billing, scheduling, and operations data.
- Authentication and user role policy.
- Confirmation UI.
- Audit trail.
- External clinical integrations.
- Production go/no-go controls.

## Milestone Map

### Milestone 0: Planning And Scope Control

Outcome: future agents can find the plan, understand the boundary, and avoid unsafe integration directions.

Acceptance criteria:

- This plan exists at the canonical path.
- The plan is referenced from the top-level operational roadmap.
- No production PHI use is implied by this plan.

### Milestone 1: ConciergeOS Assistant Context API

Outcome: Clicky can ask ConciergeOS for a safe, role-aware snapshot of the current clinical workspace.

API contract:

```json
{
  "route": {
    "path": "/patients/00000000-0000-4000-8000-000000000101",
    "label": "Patient chart",
    "entity_type": "patient",
    "entity_id": "00000000-0000-4000-8000-000000000101"
  },
  "user": {
    "id": "00000000-0000-4000-8000-000000000001",
    "role": "provider",
    "display_name": "Clinic Admin"
  },
  "allowed_tools": [
    "clinical.create_follow_up_task",
    "clinical.draft_portal_reply",
    "clinical.stage_fax_match"
  ],
  "work_summary": {
    "urgent_open_tasks": 1,
    "unread_threads": 2,
    "unmatched_inbound_faxes": 1,
    "today_appointments": 12,
    "readiness_blockers": 3
  },
  "assistant_rules": [
    "Stage proposed actions only.",
    "Require ConciergeOS confirmation before writes.",
    "Do not state that an action was completed until ConciergeOS confirms it."
  ]
}
```

### Milestone 2: Proposal Inbox Backend

Outcome: Clicky can post staged action proposals that ConciergeOS stores, audits, lists, confirms, dismisses, and expires.

Proposal states:

- `pending`
- `confirmed`
- `dismissed`
- `expired`
- `failed`

Proposal types:

- `navigation.open_route`
- `clinical.create_follow_up_task`
- `clinical.draft_portal_reply`
- `clinical.stage_fax_match`
- `operations.review_blocker`

### Milestone 3: Assistant Review UI

Outcome: staff can review Clicky proposals in the existing ConciergeOS assistant review surface and approve or dismiss them.

UI rules:

- Pending proposals appear above existing assistant suggestions.
- Every proposal shows source, requested action, patient or queue context, confidence reason, and exact data that will be submitted.
- Confirm buttons use existing button styling and confirmation copy.
- Destructive or externally visible actions remain blocked unless implemented through existing confirmed ConciergeOS action paths.

### Milestone 4: Clicky Clinic Lane

Outcome: Clicky has a dedicated `clinic` lane that talks like a clinical operations copilot and produces safe proposal payloads.

Clicky rules:

- Use screen context for navigation and explanations.
- Use ConciergeOS context API for role and allowed-tool awareness.
- Include `[POINT:x,y:label]` tags only for UI navigation or visible explanation.
- Emit structured proposal JSON to ConciergeOS for actions.
- Keep TTS language short, calm, and staff-facing.

### Milestone 5: End-To-End Patient Task Flow

Outcome: the first complete blend works from voice to audit trail.

Reference flow:

1. Staff opens a patient chart in ConciergeOS.
2. Staff says: "Create a follow-up task for this patient tomorrow morning."
3. Clicky captures transcript and screen.
4. Clicky fetches assistant context from ConciergeOS.
5. Clicky posts a pending `clinical.create_follow_up_task` proposal.
6. ConciergeOS shows the proposal in Assistant Review.
7. Staff confirms.
8. ConciergeOS calls the existing `/api/assistant/actions/follow-up-task` write path.
9. ConciergeOS records audit history.
10. Task list updates.

### Milestone 6: Queue Operations Flows

Outcome: Clicky helps staff operate high-volume queues without adding clinical risk.

Flows:

- Fax triage: "What fax should I work next?" and "Stage this fax for this patient."
- Messaging: "Draft a reply to this unread thread."
- Tasks: "Show me urgent work" and "Create a callback task."
- Scheduling: "Point out today's schedule risk."
- Setup and operations: "What is blocking launch readiness?"

### Milestone 7: Production Safety And Compliance Gates

Outcome: Clicky integration is ready for clinic-owned pilot review, not automatic live PHI use.

Required controls:

- Clinic-controlled model routing policy.
- PHI transmission policy documented and approved.
- Clicky request audit events.
- User-visible setting to disable screen capture for ConciergeOS.
- Admin-visible setting to disable Clicky proposals.
- Local/demo mode support that avoids external PHI transmission.
- Production deployment checklist entry.

---

## Implementation Tasks

### Task 1: Register This Plan In The Operations Roadmap

**Files:**

- Modify: `docs/operations/completion-roadmap.md`

- [ ] **Step 1: Add the plan to Agent Navigation**

Insert this bullet under `## Agent Navigation`:

```markdown
- Clicky Concierge integration plan: `docs/operations/clicky-concierge-integration-plan.md`
```

- [ ] **Step 2: Add a phase note**

Insert this paragraph under `## Current Baseline`:

```markdown
- Clicky Concierge integration is planned as a native macOS command and perception layer. ConciergeOS remains the audited clinical source of truth; Clicky may stage proposals, point to UI, and guide navigation, but all clinical writes remain confirmation-gated in ConciergeOS.
```

- [ ] **Step 3: Verify docs references**

Run:

```bash
rg -n "Clicky Concierge integration plan|native macOS command" docs/operations/completion-roadmap.md
```

Expected:

```text
docs/operations/completion-roadmap.md contains both inserted references.
```

- [ ] **Step 4: Commit**

```bash
git add docs/operations/clicky-concierge-integration-plan.md docs/operations/completion-roadmap.md
git commit -m "docs: add clicky concierge integration plan"
```

### Task 2: Add Assistant Context Schemas

**Files:**

- Modify: `apps/api/app/schemas/assistant.py`
- Test: `apps/api/tests/routers/test_assistant.py`

- [ ] **Step 1: Add schema imports**

In `apps/api/app/schemas/assistant.py`, ensure these imports exist:

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
```

- [ ] **Step 2: Add context schemas**

Append these schemas to `apps/api/app/schemas/assistant.py`:

```python
class AssistantRouteContext(BaseModel):
    path: str = Field(min_length=1)
    label: str = Field(min_length=1)
    entity_type: str | None = None
    entity_id: str | None = None


class AssistantUserContext(BaseModel):
    id: str
    role: str
    display_name: str


class AssistantWorkSummary(BaseModel):
    urgent_open_tasks: int = 0
    unread_threads: int = 0
    unmatched_inbound_faxes: int = 0
    today_appointments: int = 0
    readiness_blockers: int = 0


class AssistantContextOut(BaseModel):
    route: AssistantRouteContext
    user: AssistantUserContext
    allowed_tools: list[str]
    work_summary: AssistantWorkSummary
    assistant_rules: list[str]
```

- [ ] **Step 3: Add proposal schemas**

Append these schemas to `apps/api/app/schemas/assistant.py`:

```python
AssistantProposalType = Literal[
    "navigation.open_route",
    "clinical.create_follow_up_task",
    "clinical.draft_portal_reply",
    "clinical.stage_fax_match",
    "operations.review_blocker",
]

AssistantProposalStatus = Literal["pending", "confirmed", "dismissed", "expired", "failed"]


class AssistantProposalCreate(BaseModel):
    proposal_type: AssistantProposalType
    title: str = Field(min_length=1, max_length=160)
    summary: str = Field(min_length=1, max_length=500)
    route_path: str = Field(min_length=1)
    entity_type: str | None = None
    entity_id: str | None = None
    payload: dict[str, object]
    confidence_reason: str = Field(min_length=1, max_length=500)
    source: Literal["clicky"] = "clicky"


class AssistantProposalOut(AssistantProposalCreate):
    id: str
    status: AssistantProposalStatus
    created_at: datetime
    created_by_user_id: str
    resolved_at: datetime | None = None
    resolved_by_user_id: str | None = None
```

- [ ] **Step 4: Run schema type checks**

Run:

```bash
pnpm --filter @concierge-os/api typecheck
```

Expected:

```text
No new errors from apps/api/app/schemas/assistant.py.
```

### Task 3: Add Assistant Context Endpoint

**Files:**

- Modify: `apps/api/app/routers/assistant.py`
- Test: `apps/api/tests/routers/test_assistant.py`

- [ ] **Step 1: Write failing context test**

Add this test to `apps/api/tests/routers/test_assistant.py`:

```python
async def test_assistant_context_returns_role_policy_and_safe_summary(client, auth_headers):
    response = await client.get(
        "/api/assistant/actions/context?path=/patients/00000000-0000-4000-8000-000000000101",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["route"]["path"] == "/patients/00000000-0000-4000-8000-000000000101"
    assert body["route"]["label"] == "Patient chart"
    assert "clinical.create_follow_up_task" in body["allowed_tools"]
    assert body["work_summary"]["urgent_open_tasks"] >= 0
    assert "Require ConciergeOS confirmation before writes." in body["assistant_rules"]
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd apps/api
uv run pytest tests/routers/test_assistant.py::test_assistant_context_returns_role_policy_and_safe_summary -q
```

Expected:

```text
FAIL because /api/assistant/actions/context does not exist yet.
```

- [ ] **Step 3: Add route label helper**

Add this helper to `apps/api/app/routers/assistant.py`:

```python
def _assistant_route_label(path: str) -> tuple[str, str | None, str | None]:
    if path.startswith("/patients/"):
        return "Patient chart", "patient", path.split("/")[2]
    if path.startswith("/patients"):
        return "Patient search", None, None
    if path.startswith("/tasks"):
        return "Task queue", None, None
    if path.startswith("/scheduling"):
        return "Schedule", None, None
    if path.startswith("/faxes"):
        return "Fax center", None, None
    if path.startswith("/messaging"):
        return "Messages", None, None
    if path.startswith("/billing"):
        return "Billing", None, None
    if path.startswith("/operations"):
        return "Operations", None, None
    if path.startswith("/setup"):
        return "Setup checklist", None, None
    if path.startswith("/assistant-review"):
        return "AI review", None, None
    return "Command center", None, None
```

- [ ] **Step 4: Add endpoint**

Add imports:

```python
from app.schemas.assistant import AssistantContextOut, AssistantRouteContext, AssistantUserContext, AssistantWorkSummary
```

Add the endpoint above the existing action endpoints:

```python
@router.get("/context", response_model=AssistantContextOut)
async def get_assistant_context(
    path: str = "/",
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    label, entity_type, entity_id = _assistant_route_label(path)
    return AssistantContextOut(
        route=AssistantRouteContext(
            path=path,
            label=label,
            entity_type=entity_type,
            entity_id=entity_id,
        ),
        user=AssistantUserContext(
            id=str(current_user.id),
            role=current_user.role.value,
            display_name=current_user.full_name,
        ),
        allowed_tools=allowed_tools_for(current_user),
        work_summary=AssistantWorkSummary(),
        assistant_rules=[
            "Stage proposed actions only.",
            "Require ConciergeOS confirmation before writes.",
            "Do not state that an action was completed until ConciergeOS confirms it.",
        ],
    )
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
cd apps/api
uv run pytest tests/routers/test_assistant.py::test_assistant_context_returns_role_policy_and_safe_summary -q
```

Expected:

```text
1 passed
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/schemas/assistant.py apps/api/app/routers/assistant.py apps/api/tests/routers/test_assistant.py
git commit -m "feat: expose assistant context for clicky"
```

### Task 4: Add Proposal Persistence Service

**Files:**

- Create: `apps/api/app/services/assistant_proposals.py`
- Modify: `apps/api/app/routers/assistant.py`
- Test: `apps/api/tests/routers/test_assistant.py`

- [ ] **Step 1: Add in-memory proposal service**

Create `apps/api/app/services/assistant_proposals.py`:

```python
from datetime import UTC, datetime
from uuid import uuid4

from app.schemas.assistant import AssistantProposalCreate, AssistantProposalOut

_PROPOSALS: dict[str, AssistantProposalOut] = {}


def create_proposal(data: AssistantProposalCreate, user_id: str) -> AssistantProposalOut:
    proposal = AssistantProposalOut(
        **data.model_dump(),
        id=str(uuid4()),
        status="pending",
        created_at=datetime.now(UTC),
        created_by_user_id=user_id,
    )
    _PROPOSALS[proposal.id] = proposal
    return proposal


def list_pending_proposals() -> list[AssistantProposalOut]:
    return sorted(
        [proposal for proposal in _PROPOSALS.values() if proposal.status == "pending"],
        key=lambda proposal: proposal.created_at,
        reverse=True,
    )


def resolve_proposal(proposal_id: str, status: str, user_id: str) -> AssistantProposalOut | None:
    proposal = _PROPOSALS.get(proposal_id)
    if proposal is None:
        return None
    if proposal.status != "pending":
        return proposal
    updated = proposal.model_copy(
        update={
            "status": status,
            "resolved_at": datetime.now(UTC),
            "resolved_by_user_id": user_id,
        }
    )
    _PROPOSALS[proposal_id] = updated
    return updated


def clear_proposals_for_tests() -> None:
    _PROPOSALS.clear()
```

- [ ] **Step 2: Write proposal create/list test**

Add this test to `apps/api/tests/routers/test_assistant.py`:

```python
async def test_clicky_can_create_and_list_pending_proposals(client, auth_headers):
    proposal = {
        "proposal_type": "clinical.create_follow_up_task",
        "title": "Create follow-up task",
        "summary": "Follow up with the patient tomorrow morning.",
        "route_path": "/patients/00000000-0000-4000-8000-000000000101",
        "entity_type": "patient",
        "entity_id": "00000000-0000-4000-8000-000000000101",
        "payload": {
            "context": "Patient chart",
            "title": "Follow up tomorrow morning",
            "priority": "normal",
        },
        "confidence_reason": "The user asked for a follow-up task while viewing the patient chart.",
        "source": "clicky",
    }

    create_response = await client.post(
        "/api/assistant/actions/proposals",
        json=proposal,
        headers=auth_headers,
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["status"] == "pending"
    assert created["source"] == "clicky"

    list_response = await client.get("/api/assistant/actions/proposals", headers=auth_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == created["id"] for item in list_response.json())
```

- [ ] **Step 3: Add proposal routes**

In `apps/api/app/routers/assistant.py`, import:

```python
from app.schemas.assistant import AssistantProposalCreate, AssistantProposalOut
from app.services import assistant_proposals
```

Add routes:

```python
@router.post("/proposals", response_model=AssistantProposalOut, status_code=status.HTTP_201_CREATED)
async def create_assistant_proposal(
    data: AssistantProposalCreate,
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    return assistant_proposals.create_proposal(data, str(current_user.id))


@router.get("/proposals", response_model=list[AssistantProposalOut])
async def list_assistant_proposals(current_user: User = Depends(get_current_user)):  # noqa: B008
    return assistant_proposals.list_pending_proposals()
```

- [ ] **Step 4: Run proposal tests**

Run:

```bash
cd apps/api
uv run pytest tests/routers/test_assistant.py::test_clicky_can_create_and_list_pending_proposals -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/assistant_proposals.py apps/api/app/routers/assistant.py apps/api/tests/routers/test_assistant.py
git commit -m "feat: stage clicky assistant proposals"
```

### Task 5: Add Proposal Confirmation And Dismissal

**Files:**

- Modify: `apps/api/app/routers/assistant.py`
- Modify: `apps/api/app/services/assistant_proposals.py`
- Test: `apps/api/tests/routers/test_assistant.py`

- [ ] **Step 1: Write dismiss test**

Add this test:

```python
async def test_assistant_proposal_can_be_dismissed(client, auth_headers):
    proposal_response = await client.post(
        "/api/assistant/actions/proposals",
        json={
            "proposal_type": "operations.review_blocker",
            "title": "Review launch blocker",
            "summary": "Review the readiness blocker in setup.",
            "route_path": "/setup",
            "entity_type": None,
            "entity_id": None,
            "payload": {"context": "Setup checklist"},
            "confidence_reason": "The user asked what blocks launch readiness.",
            "source": "clicky",
        },
        headers=auth_headers,
    )
    proposal_id = proposal_response.json()["id"]

    dismiss_response = await client.post(
        f"/api/assistant/actions/proposals/{proposal_id}/dismiss",
        headers=auth_headers,
    )

    assert dismiss_response.status_code == 200
    assert dismiss_response.json()["status"] == "dismissed"
```

- [ ] **Step 2: Add dismiss route**

Add this route to `apps/api/app/routers/assistant.py`:

```python
@router.post("/proposals/{proposal_id}/dismiss", response_model=AssistantProposalOut)
async def dismiss_assistant_proposal(
    proposal_id: str,
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    proposal = assistant_proposals.resolve_proposal(proposal_id, "dismissed", str(current_user.id))
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    return proposal
```

- [ ] **Step 3: Run dismiss test**

Run:

```bash
cd apps/api
uv run pytest tests/routers/test_assistant.py::test_assistant_proposal_can_be_dismissed -q
```

Expected:

```text
1 passed
```

- [ ] **Step 4: Defer write confirmation to existing action paths**

Add this comment above the dismiss route:

```python
# Proposal confirmation is intentionally handled by the web client calling the
# existing confirmation-gated assistant action endpoints with the staged payload.
# This keeps clinical writes on established role-gated, audit-visible paths.
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/assistant.py apps/api/app/services/assistant_proposals.py apps/api/tests/routers/test_assistant.py
git commit -m "feat: dismiss staged assistant proposals"
```

### Task 6: Add Shared TypeScript Contracts

**Files:**

- Create: `packages/shared/src/types/assistant.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `pnpm exec tsc -b packages/shared --pretty false`

- [ ] **Step 1: Add shared assistant types**

Create `packages/shared/src/types/assistant.ts`:

```typescript
export type AssistantProposalType =
  | 'navigation.open_route'
  | 'clinical.create_follow_up_task'
  | 'clinical.draft_portal_reply'
  | 'clinical.stage_fax_match'
  | 'operations.review_blocker';

export type AssistantProposalStatus = 'pending' | 'confirmed' | 'dismissed' | 'expired' | 'failed';

export interface AssistantRouteContext {
  path: string;
  label: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface AssistantWorkSummary {
  urgent_open_tasks: number;
  unread_threads: number;
  unmatched_inbound_faxes: number;
  today_appointments: number;
  readiness_blockers: number;
}

export interface AssistantContext {
  route: AssistantRouteContext;
  user: {
    id: string;
    role: string;
    display_name: string;
  };
  allowed_tools: string[];
  work_summary: AssistantWorkSummary;
  assistant_rules: string[];
}

export interface AssistantProposal {
  id: string;
  proposal_type: AssistantProposalType;
  title: string;
  summary: string;
  route_path: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  confidence_reason: string;
  source: 'clicky';
  status: AssistantProposalStatus;
  created_at: string;
  created_by_user_id: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
}
```

- [ ] **Step 2: Export shared types**

Add this export to `packages/shared/src/index.ts`:

```typescript
export * from './types/assistant';
```

- [ ] **Step 3: Run shared typecheck**

Run:

```bash
pnpm exec tsc -b packages/shared --pretty false
```

Expected:

```text
Exit code 0.
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/assistant.ts packages/shared/src/index.ts
git commit -m "feat: share assistant proposal contracts"
```

### Task 7: Add Assistant Review Proposal UI

**Files:**

- Modify: `apps/web/src/router/routes/assistant-review.tsx`
- Modify: `apps/web/src/lib/assistant-tools.ts`
- Test: `pnpm exec tsc -b packages/shared apps/web --pretty false`

- [ ] **Step 1: Add proposal API helpers**

In `apps/web/src/lib/assistant-tools.ts`, import:

```typescript
import type { AssistantProposal } from '@concierge-os/shared';
```

Add helper functions:

```typescript
export async function fetchAssistantProposals(api: {
  get: <T>(path: string) => Promise<T>;
}): Promise<AssistantProposal[]> {
  return api.get<AssistantProposal[]>('/assistant/actions/proposals');
}

export async function dismissAssistantProposal(
  api: { post: <T>(path: string, body?: unknown) => Promise<T> },
  proposalId: string
): Promise<AssistantProposal> {
  return api.post<AssistantProposal>(`/assistant/actions/proposals/${proposalId}/dismiss`);
}
```

- [ ] **Step 2: Render pending Clicky proposals**

In `apps/web/src/router/routes/assistant-review.tsx`, add a TanStack Query call for `/assistant/actions/proposals` and render each proposal with:

```tsx
<section className="assistant-review-proposals" aria-label="Clicky proposals">
  <div className="section-header">
    <h2>Clicky proposals</h2>
    <p>Review staged voice and screen suggestions before ConciergeOS writes anything.</p>
  </div>
  {proposals.length === 0 ? (
    <p>No pending Clicky proposals.</p>
  ) : (
    proposals.map((proposal) => (
      <article key={proposal.id} className="assistant-proposal">
        <div>
          <h3>{proposal.title}</h3>
          <p>{proposal.summary}</p>
          <p>{proposal.confidence_reason}</p>
        </div>
        <div className="proposal-actions">
          <button type="button" onClick={() => confirmProposal(proposal)}>
            Review action
          </button>
          <button type="button" onClick={() => dismissProposal(proposal.id)}>
            Dismiss
          </button>
        </div>
      </article>
    ))
  )}
</section>
```

- [ ] **Step 3: Wire confirmation to existing action paths**

Implement `confirmProposal(proposal)` with this dispatch table:

```typescript
const proposalActionPath: Partial<Record<AssistantProposal['proposal_type'], string>> = {
  'clinical.create_follow_up_task': '/assistant/actions/follow-up-task',
  'clinical.draft_portal_reply': '/assistant/actions/portal-reply-draft',
  'clinical.stage_fax_match': '/assistant/actions/fax-match',
};
```

For `navigation.open_route` and `operations.review_blocker`, navigate to `proposal.route_path` instead of writing clinical data.

- [ ] **Step 4: Run web typecheck**

Run:

```bash
pnpm exec tsc -b packages/shared apps/web --pretty false
```

Expected:

```text
Exit code 0.
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/router/routes/assistant-review.tsx apps/web/src/lib/assistant-tools.ts
git commit -m "feat: review clicky assistant proposals"
```

### Task 8: Add Demo API Parity

**Files:**

- Modify: `apps/web/src/lib/demo-api.ts`
- Test: `pnpm --filter @concierge-os/web smoke`

- [ ] **Step 1: Add demo proposal state**

Add a module-level array in `apps/web/src/lib/demo-api.ts`:

```typescript
let demoAssistantProposals: AssistantProposal[] = [];
```

- [ ] **Step 2: Add demo handlers**

Handle these routes in the demo API dispatcher:

```typescript
if (path === '/assistant/actions/proposals' && method === 'GET') {
  return demoAssistantProposals.filter((proposal) => proposal.status === 'pending');
}

if (path === '/assistant/actions/proposals' && method === 'POST') {
  const proposal = body as Omit<
    AssistantProposal,
    'id' | 'status' | 'created_at' | 'created_by_user_id' | 'resolved_at' | 'resolved_by_user_id'
  >;
  const created: AssistantProposal = {
    ...proposal,
    id: `demo-clicky-proposal-${Date.now()}`,
    status: 'pending',
    created_at: new Date().toISOString(),
    created_by_user_id: 'demo-user',
    resolved_at: null,
    resolved_by_user_id: null,
  };
  demoAssistantProposals = [created, ...demoAssistantProposals];
  return created;
}
```

Add a dismiss matcher for `/assistant/actions/proposals/:id/dismiss`.

- [ ] **Step 3: Run smoke test**

Run:

```bash
pnpm --filter @concierge-os/web smoke
```

Expected:

```text
Smoke test passes and demo routes remain loadable.
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/demo-api.ts
git commit -m "feat: mirror clicky proposals in demo mode"
```

### Task 9: Add Clicky Clinic Lane

**Files:**

- Modify: `/Users/jakedom/Documents/clicky-main/leanring-buddy/CompanionLane.swift`
- Modify: `/Users/jakedom/Documents/clicky-main/leanring-buddy/CompanionManager.swift`

- [ ] **Step 1: Add the lane enum case**

In `CompanionLane.swift`, add:

```swift
case clinic = "clinic"
```

- [ ] **Step 2: Add lane display metadata**

Add switch cases:

```swift
case .clinic:
    return "Clinic"
```

```swift
case .clinic:
    return "cross.case.fill"
```

```swift
case .clinic:
    return "Clinical operations guidance for ConciergeOS."
```

```swift
case .clinic:
    return "Tell me the patient, queue, or blocker you are working on in ConciergeOS."
```

```swift
case .clinic:
    return "Name the ConciergeOS screen and the clinical action you want staged."
```

- [ ] **Step 3: Add clinic prompt**

Add this `lanePrompt` case:

```swift
case .clinic:
    return """

    You are the ConciergeOS clinic lane. You help front desk, medical assistants, providers, billers, and managers operate ConciergeOS quickly and safely.
    - Treat ConciergeOS as the source of truth.
    - You may explain visible screens, point to UI, suggest navigation, and stage proposals.
    - You must not claim a clinical action is complete until ConciergeOS confirms it.
    - For clinical writes, say that you are staging the action for review.
    - Keep language calm, concise, and staff-facing.
    - If the user asks where to click, use a POINT tag.
    """
```

- [ ] **Step 4: Set clinic default model**

In `defaultModel`, add:

```swift
case .clinic:
    return "claude-sonnet-4-6"
```

- [ ] **Step 5: Build in Xcode**

Run through Xcode:

```text
Open /Users/jakedom/Documents/clicky-main/leanring-buddy.xcodeproj
Select the leanring-buddy scheme
Press Cmd+B
```

Expected:

```text
Build succeeds with the Clinic lane visible in the panel.
```

- [ ] **Step 6: Commit**

```bash
cd /Users/jakedom/Documents/clicky-main
git add leanring-buddy/CompanionLane.swift leanring-buddy/CompanionManager.swift
git commit -m "feat: add concierge clinic lane"
```

### Task 10: Add Clicky ConciergeOS API Client

**Files:**

- Create: `/Users/jakedom/Documents/clicky-main/leanring-buddy/ConciergeOSClient.swift`
- Modify: `/Users/jakedom/Documents/clicky-main/leanring-buddy/CompanionManager.swift`
- Modify: `/Users/jakedom/Documents/clicky-main/leanring-buddy/Info.plist`

- [ ] **Step 1: Add Info.plist setting**

Add:

```xml
<key>ConciergeOSBaseURL</key>
<string>http://localhost:8000</string>
```

- [ ] **Step 2: Create ConciergeOS client**

Create `ConciergeOSClient.swift`:

```swift
import Foundation

struct ConciergeAssistantContext: Decodable {
    let route: Route
    let allowedTools: [String]
    let assistantRules: [String]

    struct Route: Decodable {
        let path: String
        let label: String
        let entityType: String?
        let entityId: String?

        enum CodingKeys: String, CodingKey {
            case path
            case label
            case entityType = "entity_type"
            case entityId = "entity_id"
        }
    }

    enum CodingKeys: String, CodingKey {
        case route
        case allowedTools = "allowed_tools"
        case assistantRules = "assistant_rules"
    }
}

struct ConciergeAssistantProposal: Encodable {
    let proposalType: String
    let title: String
    let summary: String
    let routePath: String
    let entityType: String?
    let entityId: String?
    let payload: [String: String]
    let confidenceReason: String
    let source: String

    enum CodingKeys: String, CodingKey {
        case proposalType = "proposal_type"
        case title
        case summary
        case routePath = "route_path"
        case entityType = "entity_type"
        case entityId = "entity_id"
        case payload
        case confidenceReason = "confidence_reason"
        case source
    }
}

final class ConciergeOSClient {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchContext(path: String) async throws -> ConciergeAssistantContext {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/assistant/actions/context"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "path", value: path)]
        let (data, response) = try await session.data(from: components.url!)
        try Self.validate(response: response)
        return try JSONDecoder().decode(ConciergeAssistantContext.self, from: data)
    }

    func createProposal(_ proposal: ConciergeAssistantProposal) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/assistant/actions/proposals"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(proposal)
        let (_, response) = try await session.data(for: request)
        try Self.validate(response: response)
    }

    private static func validate(response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
```

- [ ] **Step 3: Use client only in clinic lane**

In `CompanionManager.swift`, when `selectedLane == .clinic`, fetch context before model request and append this to the user prompt:

```swift
let conciergeContextText = """

ConciergeOS context:
- route: \(context.route.label) at \(context.route.path)
- allowed tools: \(context.allowedTools.joined(separator: ", "))
- rules: \(context.assistantRules.joined(separator: " "))
"""
```

- [ ] **Step 4: Build in Xcode**

Expected:

```text
Clicky builds and non-clinic lanes still work without ConciergeOS running.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/jakedom/Documents/clicky-main
git add leanring-buddy/ConciergeOSClient.swift leanring-buddy/CompanionManager.swift leanring-buddy/Info.plist
git commit -m "feat: connect clinic lane to conciergeos"
```

### Task 11: Add First End-To-End Proposal Flow

**Files:**

- Modify: `/Users/jakedom/Documents/clicky-main/leanring-buddy/CompanionManager.swift`
- Modify: `/Users/jakedom/Documents/clicky-main/leanring-buddy/ConciergeOSClient.swift`
- Modify: `apps/web/src/router/routes/assistant-review.tsx`
- Test: manual local end-to-end run

- [ ] **Step 1: Define proposal extraction format**

Add this to the clinic prompt:

```text
When the user asks for a ConciergeOS action, include exactly one hidden proposal block after your spoken response:
[CONCIERGE_PROPOSAL:{"proposal_type":"clinical.create_follow_up_task","title":"Create follow-up task","summary":"Follow up with the patient tomorrow morning.","payload":{"context":"Patient chart","title":"Follow up tomorrow morning","priority":"normal"},"confidence_reason":"The user asked for a follow-up task while viewing the patient chart."}]
If no action should be staged, do not include a proposal block.
```

- [ ] **Step 2: Parse proposal block**

Add a parser beside `parsePointingCoordinates`:

```swift
struct ConciergeProposalParseResult {
    let spokenText: String
    let proposalJSON: String?
}

static func parseConciergeProposal(from responseText: String) -> ConciergeProposalParseResult {
    let pattern = #"\[CONCIERGE_PROPOSAL:(\{.*\})\]\s*$"#
    guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]),
          let match = regex.firstMatch(in: responseText, range: NSRange(responseText.startIndex..., in: responseText)),
          let jsonRange = Range(match.range(at: 1), in: responseText),
          let fullRange = Range(match.range(at: 0), in: responseText) else {
        return ConciergeProposalParseResult(spokenText: responseText, proposalJSON: nil)
    }
    let spoken = responseText[..<fullRange.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
    return ConciergeProposalParseResult(spokenText: spoken, proposalJSON: String(responseText[jsonRange]))
}
```

- [ ] **Step 3: Post proposal when present**

When `selectedLane == .clinic` and `proposalJSON` is present, decode it, fill route/entity fields from context, and call `createProposal`.

- [ ] **Step 4: Run local stack**

Run:

```bash
cd /Users/jakedom/concierge-os
pnpm dev:api
pnpm dev:web
```

Expected:

```text
API starts and web app is available at http://localhost:5173.
```

- [ ] **Step 5: Manual end-to-end check**

Manual test:

```text
1. Open ConciergeOS at http://localhost:5173.
2. Log in using the local demo flow.
3. Open a patient chart.
4. Start Clicky in Clinic lane.
5. Say: "Create a follow-up task for this patient tomorrow morning."
6. Open /assistant-review.
7. Confirm a pending Clicky proposal appears.
8. Confirm the proposal.
9. Verify the task appears in /tasks.
```

- [ ] **Step 6: Commit both repos separately**

```bash
cd /Users/jakedom/concierge-os
git add apps/web/src/router/routes/assistant-review.tsx
git commit -m "feat: confirm clicky follow-up proposals"
```

```bash
cd /Users/jakedom/Documents/clicky-main
git add leanring-buddy/CompanionManager.swift leanring-buddy/ConciergeOSClient.swift
git commit -m "feat: stage conciergeos proposals from clinic lane"
```

### Task 12: Add Safety And Admin Controls

**Files:**

- Modify: `apps/api/app/routers/settings.py`
- Modify: `apps/api/app/schemas/settings.py`
- Modify: `apps/web/src/router/routes/setup.tsx`
- Modify: `docs/compliance/phi-retention-and-incident-response.md`
- Test: `cd apps/api && uv run pytest tests -q`

- [ ] **Step 1: Add settings fields**

Add settings:

```python
clicky_enabled: bool = False
clicky_allow_external_model_context: bool = False
clicky_allow_screen_context: bool = False
clicky_proposals_require_confirmation: bool = True
```

- [ ] **Step 2: Enforce disabled default**

In proposal creation, reject proposals when `clicky_enabled` is false outside demo mode:

```python
raise HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Clicky Concierge proposals are disabled for this workspace",
)
```

- [ ] **Step 3: Add setup controls**

In `/setup`, add toggles for:

```text
Enable Clicky Concierge proposals
Allow screen context
Allow external model context
Require staff confirmation
```

- [ ] **Step 4: Document PHI policy**

Add this compliance rule:

```markdown
Clicky Concierge may not transmit live PHI, screenshots, transcripts, or patient context to external model, transcription, or voice services until the clinic owner has approved the model routing policy, BAA coverage, retention terms, and audit procedure. Local/demo mode may use synthetic data for product validation.
```

- [ ] **Step 5: Run broad checks**

Run:

```bash
cd apps/api
uv run pytest tests -q
cd ../..
pnpm exec tsc -b packages/shared apps/web --pretty false
pnpm --filter @concierge-os/web lint
```

Expected:

```text
All checks pass or only documented unrelated baseline failures remain.
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/settings.py apps/api/app/schemas/settings.py apps/web/src/router/routes/setup.tsx docs/compliance/phi-retention-and-incident-response.md
git commit -m "feat: gate clicky concierge safety settings"
```

### Task 13: Final Verification And Pilot Review Packet

**Files:**

- Create: `docs/operations/clicky-concierge-pilot-review.md`
- Modify: `docs/operations/production-launch-checklist.md`

- [ ] **Step 1: Create pilot review packet**

Create `docs/operations/clicky-concierge-pilot-review.md` with:

```markdown
# Clicky Concierge Pilot Review

## Scope

Clicky Concierge is approved only as a staged proposal and navigation assistant until clinic leadership signs this packet.

## Verified Flows

- [ ] Assistant context API returns route, role, allowed tools, and safety rules.
- [ ] Clicky Clinic lane can fetch ConciergeOS context.
- [ ] Clicky can stage a follow-up task proposal.
- [ ] ConciergeOS requires staff confirmation before writing the task.
- [ ] ConciergeOS audit history records the resulting action.
- [ ] Demo mode works without live PHI.

## Controls

- [ ] Clicky proposals can be disabled by an admin.
- [ ] Screen context can be disabled by an admin.
- [ ] External model context can be disabled by an admin.
- [ ] Staff confirmation remains required.
- [ ] PHI policy is approved.

## Go/No-Go

Pilot status: HOLD

Required signers:

- Clinic owner:
- Compliance owner:
- Technical owner:
- Operations lead:
```

- [ ] **Step 2: Add launch checklist reference**

Add to `docs/operations/production-launch-checklist.md`:

```markdown
- [ ] Clicky Concierge pilot review is signed before live PHI, screenshots, transcripts, or patient context are transmitted through the native companion.
```

- [ ] **Step 3: Run final verification**

Run:

```bash
pnpm verify:local
git diff --check
```

Expected:

```text
pnpm verify:local passes or produces documented unrelated baseline failures.
git diff --check exits 0.
```

- [ ] **Step 4: Commit**

```bash
git add docs/operations/clicky-concierge-pilot-review.md docs/operations/production-launch-checklist.md
git commit -m "docs: add clicky concierge pilot review"
```

---

## Execution Order

Recommended order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 8
8. Task 7
9. Task 9
10. Task 10
11. Task 11
12. Task 12
13. Task 13

Reason: complete the ConciergeOS backend contracts before adding the web review UI, then add Clicky lane/client work, then run one vertical end-to-end flow, then harden safety controls.

## Testing Ladder

Use this validation ladder as the work progresses:

```bash
cd /Users/jakedom/concierge-os/apps/api
uv run pytest tests/routers/test_assistant.py -q
```

```bash
cd /Users/jakedom/concierge-os
pnpm exec tsc -b packages/shared apps/web --pretty false
pnpm --filter @concierge-os/web lint
pnpm --filter @concierge-os/web smoke
```

```bash
cd /Users/jakedom/concierge-os
pnpm verify:local
git diff --check
```

Clicky validation:

```text
Open /Users/jakedom/Documents/clicky-main/leanring-buddy.xcodeproj
Build the leanring-buddy scheme
Run the app
Select Clinic lane
Verify non-clinic lanes still answer without ConciergeOS running
Verify Clinic lane fetches ConciergeOS context when ConciergeOS is running
```

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Clicky bypasses clinical confirmation | Clicky can only post proposals; ConciergeOS owns all writes. |
| PHI leaks to external model/transcription/TTS providers | Default production settings disable Clicky context until clinic approval. |
| Proposal payloads drift from existing assistant action schemas | Confirm proposals by calling existing assistant action endpoints. |
| Demo mode and API mode diverge | Add demo API proposal handlers before UI completion. |
| Users mistake proposal staging for completed work | Clicky prompt forbids claiming completion until ConciergeOS confirms. |
| Two-repo work becomes hard to track | Commit ConciergeOS and Clicky changes separately with matching milestone names. |

## Review Checklist

- [ ] The plan preserves ConciergeOS as source of truth.
- [ ] The plan does not let Clicky write clinical data directly.
- [ ] Every milestone has a visible acceptance outcome.
- [ ] First end-to-end flow is narrow and testable.
- [ ] Production PHI use stays blocked behind explicit settings and pilot review.
- [ ] Future agents can find this plan from `docs/operations`.
