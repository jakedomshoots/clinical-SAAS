# AI Command Differentiation

Canonical path: `docs/operations/ai-command-differentiation.md`

Concierge OS should present its AI functionality as a clinical workflow command
layer, not as a generic chatbot. The product advantage is that commands are
contextual, role-aware, confirmation-gated, and audit-visible inside the same
workspace staff already use.

## Positioning

Concierge OS AI helps staff move faster without bypassing clinical control.
Typed and voice commands produce read-only answers or staged proposals. Any
write-capable action requires a staff member to review and confirm it before the
system mutates workflow data.

## Current Capability

- Global command palette supports search and native AI command mode.
- Typed command input uses the same backend command endpoint as voice-derived
  text.
- Browser voice capture feeds the command pipeline when supported.
- Backend command interpretation creates deterministic staged proposals for
  supported intents.
- Proposals persist in the backend and demo API.
- Inline proposal cards appear in high-value routes.
- Assistant Review shows staged proposals and assistant audit events.
- `NATIVE_AI_COMMANDS_ENABLED` can disable command submission in the API.
- The web shell has a local command toggle so demos can show enabled/disabled
  behavior.

## Safety Rails

- No silent clinical writes.
- No autonomous task, fax, message, billing, or chart mutation.
- Role policy controls proposal creation and confirmation.
- Ambiguous commands return clarification instead of unsafe proposals.
- Existing assistant action endpoints perform the actual confirmed write.
- Audit events capture proposal creation, confirmation, dismissal, and expiry.
- Existing launch checklists require browser QA for command search, typed
  command submission, voice fallback, inline review, dismissal, and
  confirmation-gated execution.

## Demo Story

Use a patient chart command:

```text
Create a follow-up task for this patient about lab review
```

Show:

1. command submitted;
2. proposal staged;
3. inline proposal card;
4. Assistant Review queue;
5. staff confirmation;
6. audit event.

The key phrase:

> The AI command layer shortens the path from intent to workflow, but the staff
> member remains the final actor for clinical writes.

## Near-Term Polish Backlog

These are the next highest-value AI moat items after the acquisition package:

1. Command history panel with last command, result type, and proposal status.
2. Suggested next commands based on route context.
3. "Why confirmation is required" explanation on write-capable proposals.
4. Manager-facing AI audit timeline filter.
5. More deterministic intents for billing, operations blockers, and document
   review.
6. Per-role command availability hints in the command palette.
7. Demo script commands that always work in synthetic mode.

## Buyer Differentiators

- Native inside the clinical workflow, not bolted on as an external assistant.
- Works with typed and voice input from the same command pipeline.
- Uses clinical context from the active route.
- Stages reviewable proposals instead of executing blind mutations.
- Keeps manager audit visibility.
- Can be disabled per deployment.
- Does not depend on an external assistant runtime.
