# Swarm Coordination Spec — ConciergeOS Phase 1 UX Implementation

## User Goal
Transform the Operations page from a data-dense wall of 20+ sections into an intuitive, progressive-disclosure interface that a mid-50s non-technical healthcare practice manager can use. Keep all functionality.

## Current Repo Facts
- Stack: React 19 + TypeScript + Tailwind v4 + TanStack Router + TanStack Query
- Package manager: pnpm
- Build: `pnpm run build:web` (from repo root) or `tsc -b && vite build` (from apps/web)
- Dev server: `pnpm run dev:web` → http://localhost:5173
- Main file: `apps/web/src/router/routes/operations/index.tsx` (3132 lines, 20 sections)
- Design tokens: `apps/web/src/index.css`
- Shared components: `apps/web/src/components/button.tsx`, `badge.tsx`
- Utility: `cn()` from `@/lib/utils` (clsx + tailwind-merge)

## Architecture Decisions
- Warm editorial palette is KEEPING: canvas `#f5f4ed`, ink `#141413`, accent `#c96442`, success `#4a7c59`, danger `#b53333`
- Font stack is KEEPING: Georgia (headlines), Inter (body), JetBrains Mono (code)
- All 20 sections stay — none are removed, only reorganized

## Shared Contracts

### New Components (to be created)

**`ExpandableCard`** — wraps each of the 20 sections
```tsx
interface ExpandableCardProps {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  status: 'complete' | 'in-progress' | 'needs-attention' | 'not-started';
  countComplete?: number;
  countPending?: number;
  countUrgent?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}
```

**`StatusDot`** — triple-encoded status indicator
```tsx
interface StatusDotProps {
  status: 'complete' | 'in-progress' | 'needs-attention' | 'not-started';
  showLabel?: boolean;
  size?: 'sm' | 'md';
}
```

**`CriticalActionsStrip`** — top-of-page urgency summary
```tsx
interface CriticalAction {
  label: string;
  count: number;
  status: 'complete' | 'in-progress' | 'needs-attention';
  tabId: string;
  sectionId?: string;
}
```

### Tab Structure
5 tabs with these IDs and labels:
| ID | Label | Sections |
|----|-------|----------|
| `staff-training` | Staff & Training | Live-Use Rehearsal, Staff Training Evidence, Role Dry-Run Checklists, Dry-Run Session Evidence |
| `systems-data` | Systems & Data | System Integration, Browser QA Evidence, Document Storage Readiness, Production Config Audit, Operator Health |
| `compliance-security` | Compliance & Security | Credential Binder, Vendor Credential Packet, Policy Approval Evidence, Restore Drill Evidence, Production Rehearsal |
| `go-live` | Go-Live | Cutover Readiness, Cutover Runbook, Go-Live Packet, Launch Workplan |
| `post-launch` | Post-Launch | Incident Register, Integration Events |

### Color Mapping for Status
- `complete` → green dot + CheckCircle icon + "Complete" text
- `in-progress` → amber dot + Clock icon + "In Progress" text  
- `needs-attention` → red dot + AlertTriangle icon + "Needs Attention" text
- `not-started` → gray dot + Circle icon + "Not Started" text

## Task Slices

### Worker 1: Design System (agent/design-system)
**Ownership:**
- `apps/web/src/index.css` — update typography scale, spacing, add new tokens
- `apps/web/src/components/badge.tsx` — increase sizes, fix warn contrast
- `apps/web/src/components/expandable-card.tsx` — NEW component
- `apps/web/src/components/status-dot.tsx` — NEW component
- `apps/web/src/components/critical-actions-strip.tsx` — NEW component

**Forbidden:**
- Do NOT edit `operations/index.tsx`
- Do NOT edit `button.tsx`
- Do NOT change route structure

**Validation:**
- `cd apps/web && pnpm install --no-audit --no-fund`
- `cd apps/web && npx tsc -b && npx vite build`
- Must pass build without errors

### Worker 2: Operations Refactor (agent/operations-refactor)
**Ownership:**
- `apps/web/src/router/routes/operations/index.tsx` — refactor to use tabs, critical actions strip, expandable cards

**What to do:**
1. Add tab navigation at top of page content (below the existing page header)
2. Add "Today's Critical Actions" strip below tabs
3. Group 20 sections into 5 tab panels
4. Wrap each section in an expandable card structure (inline the card JSX since shared components won't exist in this worktree yet — use the same className patterns)
5. Add status dots to each card header based on section data
6. Increase text sizes within sections (body 18px, table 16px, row height 48px)
7. Fix warn color usage (`#7a5c1a` for text instead of `#c9a227`)

**Forbidden:**
- Do NOT edit `index.css`
- Do NOT edit shared components outside operations
- Do NOT remove any sections or functionality
- Do NOT change data fetching logic
- Do NOT change route definition

**Validation:**
- `cd apps/web && pnpm install --no-audit --no-fund`
- `cd apps/web && npx tsc -b && npx vite build`
- Must pass build without errors

## Merge Order
1. Merge Worker 1 (design-system) first — provides shared components
2. Merge Worker 2 (operations-refactor) second — uses shared components
3. After merge, reconcile: Worker 2's inline card JSX should be replaced with imports from shared components
4. Final validation in main workspace

## Notes
- Both workers start from the same baseline commit
- Each worktree must install its own dependencies (`pnpm install`)
- The operations page is 3132 lines — Worker 2 should be prepared for a large file
- Preserve all existing data fetching, mutations, form state, and query keys
