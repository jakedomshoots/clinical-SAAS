# Native Clicky-Style Command Layer Design

## Goal

Build Clicky-style command, voice, contextual guidance, and staged-action functionality directly into ConciergeOS. The feature must be optional per workspace or deployment, but when enabled it lives inside the ConciergeOS web app and uses ConciergeOS permissions, audit trails, and confirmation gates.

This is not an external Clicky API integration. Clicky is useful as product inspiration: fast capture, natural command input, page awareness, and low-friction action staging. ConciergeOS owns the implementation and remains the only source of truth for clinical data and workflow state.

## Product Principles

- Staff can use typed commands and voice commands from the start.
- Voice and typed input feed the same command pipeline.
- Clinical writes are never automatic. Commands stage proposals that staff must review and confirm.
- The feature can be disabled without breaking normal ConciergeOS workflows.
- Context comes from ConciergeOS route, app state, data, roles, and permissions, not desktop screen scraping.
- The UI should feel like an operational tool, not a chat novelty.

## Scope

In scope:

- Global command surface in the ConciergeOS shell.
- Typed command entry.
- Push-to-talk voice capture entry.
- Current-page context resolution.
- Backend command interpretation endpoint.
- Persistent staged proposals.
- Inline proposal review cards on relevant workflow pages.
- Assistant review queue support.
- Audit events for command submitted, proposal created, proposal confirmed, proposal dismissed, and proposal expired.
- Admin/workspace feature toggle.
- Role-gated proposal creation and confirmation.

Out of scope:

- External Clicky app changes.
- External Clicky API compatibility.
- Desktop screen capture.
- Unconfirmed clinical mutations.
- Autonomous background task execution.
- Sending live PHI to unapproved external model, speech, or transcription services.

## Architecture

The command layer has one shared pipeline:

1. The user opens the global command surface.
2. The user types a command or records a short voice command.
3. The frontend submits a normalized command request with the current route and optional selected entity context.
4. The API resolves role, allowed tools, route context, and nearby workflow state.
5. The command interpreter returns one of:
   - a staged proposal,
   - a safe navigation result,
   - a read-only answer or summary,
   - a clarification request,
   - a blocked response with a reason.
6. Any write-capable action becomes a proposal.
7. Staff confirms or dismisses the proposal in the relevant page or Assistant Review.

## Components

### Global Command Surface

Add a compact command control to the app shell. It should support:

- keyboard shortcut,
- typed input,
- push-to-talk voice button,
- loading state,
- command history,
- recent proposal status,
- disabled state when the feature is off.

The first version should avoid a full chat transcript. The primary UI is command in, proposal or result out.

### Voice Capture

Voice capture should be implemented as a frontend input method that produces text for the same command submit endpoint used by typed commands.

The initial version can use browser speech recognition where available, with a clear fallback to typed input. Production use of any external transcription provider must stay behind an explicit approved setting.

### Context Resolver

The resolver should extend the existing assistant context contract. It should include:

- current route path and label,
- current entity type and id when available,
- current user id, role, and display name,
- allowed assistant tools,
- feature policy flags,
- relevant workflow summary for the current route,
- safety rules.

Examples:

- Patient chart context includes open patient id, unresolved tasks, recent messages, documents, and chart blockers.
- Fax center context includes selected fax id, match status, and pending review state.
- Messaging context includes selected conversation, recipient, and draftability.
- Billing context includes claim blockers and checkout state.

### Command Interpreter

Add an API endpoint that accepts typed or transcribed text plus route context and returns a structured result.

The interpreter should start deterministic and narrow:

- match known intents,
- validate payloads with schemas,
- reject ambiguous clinical commands,
- ask for clarification when required data is missing,
- create proposals only for allowed tools.

Supported first intents:

- `navigation.open_route`
- `clinical.create_follow_up_task`
- `clinical.draft_portal_reply`
- `clinical.stage_fax_match`
- `operations.review_blocker`
- `workspace.summarize_current_view`

### Proposal Store

Replace the current in-memory proposal store with persistent storage. A proposal should track:

- id,
- workspace or clinic scope when available,
- source as `concierge_command`,
- input mode as `typed` or `voice`,
- original command text,
- proposal type,
- title,
- summary,
- route path,
- entity type and id,
- payload,
- confidence reason,
- status,
- created by,
- resolved by,
- timestamps,
- expiration timestamp.

Pending proposals should be listed by status, route, entity, and creator.

### Inline Review

Keep `/assistant-review` as the governance queue, but add inline cards where proposals matter:

- Patient chart: follow-up task and portal reply proposals.
- Fax center: fax match proposals.
- Messaging: portal reply proposals.
- Billing and operations pages: blocker review and navigation proposals.
- Command Center: cross-workflow pending proposals.

Each card must show what will happen before confirmation, including the exact payload for clinical writes.

### Feature Toggle

Add a setting that can disable the whole command layer. When disabled:

- command UI is hidden or visibly unavailable,
- command submit endpoint rejects requests,
- proposal creation from command input is rejected,
- existing pending proposals remain reviewable unless explicitly expired by policy.

The setting should support demo mode defaults without weakening production safety.

## Data Flow

Typed command:

1. User enters text.
2. Frontend submits text, `input_mode: typed`, route path, and optional selected entity.
3. API resolves context and policy.
4. API interprets command.
5. API creates proposal or returns read-only result.
6. Frontend displays result inline and refreshes proposal queries.

Voice command:

1. User holds or taps the mic control.
2. Browser captures speech and converts it to text.
3. Frontend shows the transcript for confirmation or immediate submission, depending on UI setting.
4. Frontend submits text, `input_mode: voice`, route path, and optional selected entity.
5. The same backend path handles the command.

Confirmation:

1. Staff reviews proposal.
2. Frontend calls the existing assistant action endpoint for the proposal type.
3. If the action succeeds, frontend marks proposal confirmed.
4. API writes audit events for the created action and proposal resolution.

## Safety And Error Handling

- Commands are rejected when the feature is disabled.
- Commands are rejected when the user lacks permission for the requested proposal type.
- Clinical proposals require explicit confirmation.
- Ambiguous patient, recipient, fax, or billing references produce clarification instead of a proposal.
- Expired proposals cannot be confirmed.
- Proposal confirmation must re-check permissions and relevant entity state.
- Failed confirmations keep the proposal pending and show the error.
- Voice transcript errors fall back to typed input.
- The command surface must never claim that an action completed until the confirmation path succeeds.

## Testing

Backend:

- command endpoint rejects disabled feature state,
- command endpoint resolves route context,
- each supported intent creates the correct proposal,
- unsupported or ambiguous commands return clarification or blocked responses,
- role policy blocks unauthorized proposal creation,
- expired proposals cannot be confirmed,
- audit events are emitted.

Frontend:

- command control renders when enabled and hides or disables when off,
- typed input submits through the command endpoint,
- voice transcript feeds the same submit flow,
- inline proposal cards render route-specific proposals,
- confirmation and dismissal refresh proposal data,
- errors are visible and non-destructive.

Smoke:

- staff can type a follow-up command from a patient chart and confirm the staged task,
- staff can speak a portal reply command and review the staged draft,
- staff can dismiss a proposal,
- disabling the feature removes command entry points and blocks new commands.

## Milestones

1. Add command-layer schemas, policy flags, and persistent proposal model.
2. Add command interpretation endpoint with deterministic first intents.
3. Add global typed command UI.
4. Add browser voice capture feeding the same command path.
5. Add inline proposal cards to the first high-value routes.
6. Add audit events, expiration, and admin toggle enforcement.
7. Expand command coverage after staff workflow testing.

## Success Criteria

- ConciergeOS has Clicky-style command functionality without depending on the Clicky app.
- Both voice and typed commands work from the first usable version.
- All write-capable commands create reviewable proposals before mutation.
- The feature can be turned off.
- Existing clinical workflows still work when the feature is disabled.
- The implementation passes API tests, web typecheck, lint, smoke, and production build without warnings.
