# Clicky Concierge Integration Plan

This file is retained as a compatibility pointer for older roadmap links.

**Superseded as of 2026-06-10.** Do not modify `/Users/jakedom/Documents/clicky-main` and do not build an external Clicky API bridge for the current ConciergeOS product direction.

The active direction is ConciergeOS-native Clicky-style functionality:

- Spec: `docs/superpowers/specs/2026-06-10-native-clicky-command-layer-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-10-native-clicky-command-layer.md`

Current product rule: typed commands, voice commands, contextual guidance, persistent staged proposals, inline proposal review, audit events, and confirmation-gated clinical writes are built directly into ConciergeOS. The feature can be enabled or disabled without depending on the external Clicky app.

Current implementation note: Clicky now has a dedicated `/clicky` workspace plus an optional floating overlay that can sit over normal ConciergeOS routes. The original `/Users/jakedom/Documents/clicky-main` project remains reference-only; ConciergeOS owns command interpretation, proposal staging, confirmation, and audit behavior.
