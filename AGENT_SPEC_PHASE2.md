# Swarm Coordination Spec — ConciergeOS Phase 2+3 (Remaining Phases)

## User Goal
Complete all remaining UX redesign tasks: role-based views, global search, smart defaults, contextual tooltips, empty states, pre-built dashboards, workspace presets, progressive onboarding, recent activity feed, and widget pin/hide.

## Current Repo Facts
- Stack: React 19 + TypeScript + Tailwind v4 + TanStack Router + TanStack Query
- Package manager: pnpm (binary at `/Users/jakedom/.vite-plus/package_manager/pnpm/10.24.0/pnpm/bin/pnpm`)
- Build: `cd apps/web && npx tsc -b && npx vite build`
- Dev server: `pnpm run dev:web` → http://localhost:5173
- Auth: `useAuth()` from `@/lib/auth` provides `user` with `role` field (`admin`, `manager`, `front_desk`, `provider`, `billing`)
- Layout: `apps/web/src/router/routes/__root.tsx` contains `SideNav`, `TopBar`, `RootLayout`
- Operations page: `apps/web/src/router/routes/operations/index.tsx` (tabbed, expandable cards, critical actions strip)
- Shared components: `ExpandableCard`, `StatusDot`, `CriticalActionsStrip`, `Badge`, `Button`
- Design tokens: `apps/web/src/index.css`

## Architecture Decisions Already Made
- Warm editorial palette is KEEPING
- 5 tabs on Operations: Staff & Training, Systems & Data, Compliance & Security, Go-Live, Post-Launch
- Expandable cards with status counts
- Triple-encoded status indicators
- 18px body text, 16px table text

## Shared Contracts

### ViewMode System
```tsx
type ViewMode = 'simple' | 'standard' | 'power';
type UserRole = 'admin' | 'manager' | 'front_desk' | 'provider' | 'billing';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  effectiveRole: UserRole; // actual auth role
}
```
- Provider: `apps/web/src/lib/view-mode.tsx`
- Wraps app in `__root.tsx` (Worker 1 owns this change)
- Persisted to localStorage as `concierge-os.view-mode`

### Role-Based Section Visibility
Each Operations section has a `visibility` config:
```tsx
interface SectionVisibility {
  id: string;
  roles: UserRole[];      // which roles can see it
  modes: ViewMode[];      // which view modes show it
  defaultExpanded: boolean;
}
```
- Simple mode: shows only Tier 1 sections (4-5 most critical)
- Standard mode: shows Tier 1 + Tier 2 sections
- Power mode: shows all sections

### Global Search
```tsx
interface SearchableSection {
  id: string;
  tabId: string;
  title: string;
  keywords: string[];
  badge: string; // status emoji
}
```
- Search modal triggered from TopBar search button
- Searches across all 20 section titles + keywords
- Clicking a result switches to the correct tab and expands the section

### Smart Defaults (localStorage Keys)
- `concierge-os.operations.active-tab` — last active tab
- `concierge-os.operations.expanded-cards` — array of expanded card IDs
- `concierge-os.view-mode` — simple/standard/power
- `concierge-os.onboarding.completed` — whether onboarding was dismissed

## Task Slices

### Worker 1: Role Views & View Modes (agent/role-views)
**Worktree:** `/Users/jakedom/.worktrees/role-views`

**Ownership:**
1. `apps/web/src/lib/view-mode.tsx` — NEW: ViewModeContext provider
2. `apps/web/src/router/routes/__root.tsx` — Add ViewModeProvider wrapper, add view mode switcher to TopBar
3. `apps/web/src/router/routes/operations/index.tsx` — Add role-based + view-mode-based section visibility
4. `apps/web/src/components/role-dashboard.tsx` — NEW: Pre-built default dashboard per role

**What to implement:**
- **ViewModeContext**: React context with `viewMode` (simple/standard/power), `setViewMode`, and `effectiveRole` (from `useAuth()`). Persist `viewMode` to localStorage.
- **View Mode Switcher**: Add to `TopBar` in `__root.tsx`. A segmented control with 3 options: "Simple", "Standard", "Power". Use the existing density toggle as a style reference. Place it between the search bar and the assistant button.
- **Role-Based Section Hiding**: In Operations page, each section should check:
  - Is the user's role allowed to see this section?
  - Is the current view mode showing this section?
  - Section visibility map:
    | Section | Roles | Modes |
    |---------|-------|-------|
    | Live-Use Rehearsal | admin, manager | all |
    | Staff Training | admin, manager, provider | all |
    | Role Dry-Run | admin, manager | all |
    | Credential Binder | admin, manager | all |
    | Browser QA | admin, manager | standard, power |
    | System Integration | admin, manager | standard, power |
    | Policy Approval | admin, manager | standard, power |
    | Cutover Runbook | admin, manager | standard, power |
    | Go-Live Packet | admin, manager | all |
    | Launch Workplan | admin, manager | all |
    | Post-Launch Monitoring | admin, manager, front_desk | all |
    | Incident Register | admin, manager, front_desk | all |
    | Integration Events | admin, manager | standard, power |
    | Document Storage | admin, manager | standard, power |
    | Production Config | admin, manager | power |
    | Operator Health | admin, manager | power |
    | Vendor Credentials | admin, manager | power |
    | Restore Drill | admin, manager | power |
    | Production Rehearsal | admin, manager | power |
    | Billing Work Queue | admin, manager, billing | all |
- **Pre-built Role Dashboards**: Create a `RoleDashboard` component that shows a role-specific summary:
  - Front Desk: Today's schedule, check-in queue, messages
  - Provider: Today's patients, open charts, tasks
  - Billing: Claims queue, denials, aging
  - Manager: Operations overview (the current tabbed view)
  - Admin: Full access + system health
  This component should be shown on the Operations page when the user first lands there, with a "Go to full Operations" link.

**Forbidden:**
- Do NOT change the SideNav role filtering logic
- Do NOT change auth system
- Do NOT remove any sections permanently

**Validation:**
- `cd apps/web && pnpm install` (use CI=true if needed)
- `cd apps/web && npx tsc -b && npx vite build`
- Must pass build

---

### Worker 2: Search, Persistence & UX Polish (agent/search-persistence)
**Worktree:** `/Users/jakedom/.worktrees/search-persistence`

**Ownership:**
1. `apps/web/src/components/global-search.tsx` — NEW: Global search modal for Operations
2. `apps/web/src/lib/persistence.ts` — NEW: localStorage helpers for smart defaults
3. `apps/web/src/components/tooltip.tsx` — NEW: Contextual tooltip component
4. `apps/web/src/components/empty-state.tsx` — NEW: Friendly empty state component
5. `apps/web/src/components/recent-activity.tsx` — NEW: Recent activity feed
6. `apps/web/src/router/routes/operations/index.tsx` — Integrate persistence, empty states, tooltips

**What to implement:**
- **Global Search**: A search modal (similar to CommandPalette in `__root.tsx`) that searches across all 20 Operations sections. Each section has a title + keywords. Results show section title, tab name, and status. Clicking a result: switches to the correct tab, expands the section, closes the modal. Triggered from a new search icon in the Operations page header (next to the page title).
- **Smart Defaults (Persistence)**:
  - Remember last active tab in localStorage (`concierge-os.operations.active-tab`)
  - Remember which cards are expanded (`concierge-os.operations.expanded-cards`)
  - On page load, restore these states
  - Add a "Reset to defaults" button in the Operations page header
- **Contextual Tooltips**: Create a `Tooltip` component using Tailwind + CSS (no new dependencies). Wrap it around confusing elements. On the Operations page, add tooltips to:
  - Tab badges ("3 items need attention")
  - Status dots ("Complete / In Progress / Needs Attention")
  - Card header counts
  - Action buttons
- **Empty States**: For each section that might have no data, show a friendly empty state with an icon + message + optional action. Example: "No training sessions yet. Start your first session →"
- **Recent Activity Feed**: A small component showing "What happened since you last logged in" — computed from the data already fetched (new incidents, completed training items, failed events, etc.). Show it at the top of the Post-Launch tab or as a collapsible strip.

**Forbidden:**
- Do NOT change `__root.tsx` (Worker 1 owns layout changes)
- Do NOT change the tab structure
- Do NOT change auth

**Validation:**
- `cd apps/web && pnpm install`
- `cd apps/web && npx tsc -b && npx vite build`
- Must pass build

---

### Worker 3: Onboarding & Workspace Presets (agent/onboarding-polish)
**Worktree:** `/Users/jakedom/.worktrees/onboarding-polish`

**Ownership:**
1. `apps/web/src/components/onboarding-tour.tsx` — NEW: Progressive onboarding flow
2. `apps/web/src/components/workspace-preset.tsx` — NEW: Workspace preset selector
3. `apps/web/src/components/pinnable-section.tsx` — NEW: Widget pin/hide system
4. `apps/web/src/router/routes/operations/index.tsx` — Integrate onboarding, presets, pin/hide
5. `apps/web/src/router/routes/__root.tsx` — Add onboarding trigger on first login

**What to implement:**
- **Progressive Onboarding**: A lightweight onboarding system:
  - First login: Show a welcome modal (not a tour) — "Welcome to ConciergeOS. You're viewing the Standard dashboard."
  - Highlight the view mode switcher with a pulsing indicator
  - Show one tooltip per session: "Did you know? You can expand any card to see details"
  - After 3 sessions, mark onboarding as complete in localStorage
  - Never show all 20 sections on day one — start with Simple mode
- **Workspace Presets**: A preset system that configures the view:
  - "Simple" (default for new users): Shows only 4-5 critical sections, all cards expanded, no advanced sections
  - "Standard" (default for returning users): Shows Tier 1 + Tier 2 sections, first card expanded per tab
  - "Power" (for admins/managers): Shows all sections, remembers last state
  - Preset selector integrated with the view mode switcher (Worker 1)
- **Widget Pin/Hide**: Within each tab, users can pin sections to always show at the top, or hide sections they don't need. This is a power-user feature:
  - Add a small pin icon to each card header (next to the expand chevron)
  - Pinned sections appear first in the tab
  - Hidden sections are collapsed to a "Show hidden sections (3)" button at the bottom
  - Persist pin/hide state to localStorage per role

**Forbidden:**
- Do NOT change the SideNav
- Do NOT change auth system
- Do NOT remove any functionality

**Validation:**
- `cd apps/web && pnpm install`
- `cd apps/web && npx tsc -b && npx vite build`
- Must pass build

## Merge Order
1. Merge Worker 1 (role-views) first — provides ViewModeContext and role-based visibility
2. Merge Worker 2 (search-persistence) second — uses existing page structure
3. Merge Worker 3 (onboarding-polish) third — may depend on view mode system
4. After all merges, reconcile any conflicts in `operations/index.tsx` and `__root.tsx`
5. Final validation in main workspace

## Notes
- All workers start from the same Phase 1 baseline commit (`d79b5d4`)
- Each worktree must install its own dependencies
- The Operations page is large (~3142 lines) — workers should be surgical with edits
- Preserve all existing data fetching, mutations, form state
- Use existing design tokens and components where possible
- No new npm packages unless absolutely necessary
