# ConciergeOS Design System — De-AI-Slop Overhaul

## Philosophy

ConciergeOS is a healthcare practice management app. It must feel **trustworthy, warm, and intentional** — not like a generic SaaS dashboard. The design direction is **editorial warmth**: a parchment canvas, terracotta accents, serif headlines against a clean sans-serif body, and data-forward layouts that respect the user's time.

**Key principles:**

- **Warmth over coldness** — No slate gray backgrounds. No emerald green accents.
- **Data density over whitespace** — Healthcare workers need information, not breathing room.
- **Restraint over decoration** — One accent color. Three semantic status colors. Four button variants.
- **Typography with personality** — Serif for headlines creates editorial contrast. Sans for body ensures readability.
- **Cards are earned** — Not every section gets a card. Tables and lists live on the canvas.

---

## Color System

### Canvas (Backgrounds)

| Token           | Value     | Usage                                                 |
| --------------- | --------- | ----------------------------------------------------- |
| `canvas`        | `#f5f4ed` | App background, page canvas                           |
| `canvas-raised` | `#faf9f5` | Elevated surfaces: sidebar, topbar, modal backgrounds |
| `canvas-sunk`   | `#e8e6dc` | Hover states, secondary backgrounds, subtle fills     |
| `canvas-dark`   | `#1a1a18` | Dark mode canvas (future)                             |

### Ink (Text)

| Token           | Value     | Usage                                      |
| --------------- | --------- | ------------------------------------------ |
| `ink`           | `#141413` | Primary text, headings, important labels   |
| `ink-secondary` | `#3d3d3a` | Secondary text, descriptions               |
| `ink-muted`     | `#5e5d59` | Tertiary text, timestamps, metadata        |
| `ink-faint`     | `#87867f` | Placeholders, disabled text, subtle labels |
| `ink-on-dark`   | `#faf9f5` | Text on dark/accent backgrounds            |

### Accent (Terracotta)

| Token          | Value                      | Usage                                           |
| -------------- | -------------------------- | ----------------------------------------------- |
| `accent`       | `#c96442`                  | Primary actions, active nav, links, key metrics |
| `accent-hover` | `#b55332`                  | Button hover, link hover                        |
| `accent-soft`  | `rgba(201, 100, 66, 0.12)` | Active nav bg, subtle highlights, focus rings   |
| `accent-on`    | `#faf9f5`                  | Text on accent backgrounds                      |

### Semantic (3 colors only)

| Token     | Value     | Usage                                                  |
| --------- | --------- | ------------------------------------------------------ |
| `success` | `#4a7c59` | Completed, paid, confirmed, active (terminal positive) |
| `warn`    | `#c9a227` | Pending, needs attention, warning                      |
| `danger`  | `#b53333` | Urgent, blocked, failed, error, overdue                |

### Borders

| Token           | Value                    | Usage                                 |
| --------------- | ------------------------ | ------------------------------------- |
| `border`        | `#e8e6dc`                | Default borders, dividers, separators |
| `border-strong` | `#d5d3c8`                | Focused inputs, emphasized borders    |
| `border-subtle` | `rgba(20, 20, 19, 0.06)` | Very subtle separators                |

### Shadows

| Token       | Value                         | Usage                    |
| ----------- | ----------------------------- | ------------------------ |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)`  | Subtle elevation         |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | Cards, dropdowns, modals |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` | Overlays, drawers        |

---

## Typography

### Font Families

| Token        | Stack                                                          | Usage                                         |
| ------------ | -------------------------------------------------------------- | --------------------------------------------- |
| `font-sans`  | `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif` | Body, UI labels, buttons, tables              |
| `font-serif` | `"Georgia", "Times New Roman", "Libre Baskerville", serif`     | Page titles, section headlines, metric values |
| `font-mono`  | `"JetBrains Mono", ui-monospace, Menlo, monospace`             | Timestamps, MRNs, codes, data values          |

### Type Scale

| Token           | Size             | Weight | Tracking | Usage                          |
| --------------- | ---------------- | ------ | -------- | ------------------------------ |
| `text-display`  | 28px (1.75rem)   | 500    | -0.02em  | Page titles (h1) — serif       |
| `text-headline` | 18px (1.125rem)  | 600    | -0.01em  | Section headers (h2) — sans    |
| `text-subhead`  | 15px (0.9375rem) | 500    | 0        | Subsection headers (h3) — sans |
| `text-body`     | 14px (0.875rem)  | 400    | 0        | Body copy, descriptions        |
| `text-small`    | 13px (0.8125rem) | 400    | 0        | Secondary text, table cells    |
| `text-meta`     | 12px (0.75rem)   | 500    | 0.01em   | Labels, timestamps, captions   |
| `text-micro`    | 11px (0.6875rem) | 500    | 0.04em   | Badges, tags, status pills     |

### Rules

- Page titles: `font-serif`, `font-weight: 500`, `letter-spacing: -0.02em`, `line-height: 1.1`
- Section headers: `font-sans`, `font-weight: 600`, `letter-spacing: -0.01em`, `line-height: 1.3`
- Body text never below 13px in the main content area.
- Monospace for all timestamps, MRNs, phone numbers, and numeric data.
- One font per context. No mixing serif and sans in the same sentence.

---

## Spacing System

Base unit: **4px**

| Token      | Value | Usage                             |
| ---------- | ----- | --------------------------------- |
| `space-1`  | 4px   | Tight gaps, icon padding          |
| `space-2`  | 8px   | Small gaps, inline spacing        |
| `space-3`  | 12px  | Button padding, compact row gaps  |
| `space-4`  | 16px  | Standard gaps, card padding       |
| `space-5`  | 20px  | Section gaps, comfortable padding |
| `space-6`  | 24px  | Page padding, modal padding       |
| `space-8`  | 32px  | Large section separation          |
| `space-10` | 40px  | Major section breaks              |
| `space-12` | 48px  | Hero spacing                      |

### Layout Rules

- Page content padding: `24px` (comfortable) / `16px` (compact)
- Sidebar width: `240px`
- Topbar height: `56px`
- Assistant panel width: `280px`
- Content max-width: none (data apps should use available space)
- Gap between major sections: `20px`
- Gap between related items: `12px`

---

## Border Radius

| Token          | Value | Usage                                   |
| -------------- | ----- | --------------------------------------- |
| `radius-sm`    | 6px   | Inputs, small buttons, tags             |
| `radius-md`    | 10px  | Cards, panels, modals                   |
| `radius-lg`    | 16px  | Large overlays, feature cards           |
| `radius-pill`  | 999px | Badges, filters, search bars            |
| `radius-sharp` | 0px   | Tables, data grids, full-width sections |

---

## Component Specs

### Button

**4 variants only:**

1. **Primary** — The one main CTA per page/section
   - `bg-accent text-accent-on rounded-md px-4 py-2`
   - Hover: `bg-accent-hover`
   - Active: `scale-[0.98]`
   - Font: `text-sm font-medium`

2. **Secondary** — Non-destructive actions, filters
   - `border border-border bg-canvas-raised text-ink-secondary rounded-md px-3 py-2`
   - Hover: `border-border-strong bg-canvas-sunk`
   - Font: `text-sm font-medium`

3. **Ghost** — Low-emphasis, repeated, navigation
   - `text-ink-muted hover:text-ink hover:bg-canvas-sunk rounded-sm px-2 py-1`
   - Font: `text-sm`

4. **Danger** — Destructive, irreversible
   - `bg-danger text-white rounded-md px-4 py-2`
   - Hover: `brightness-90`
   - Font: `text-sm font-medium`

**Rules:**

- No more than one primary button per section.
- Icon + text buttons: `gap-2`, icon size `16px`.
- Disabled: `opacity-50 cursor-not-allowed`, no transform.

### Input

**2 variants:**

1. **Standard** — Form fields
   - `bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink`
   - Focus: `border-accent ring-1 ring-accent-soft`
   - Placeholder: `text-ink-faint`
   - Disabled: `bg-canvas-sunk opacity-60`

2. **Search** — Search bars, global find
   - `bg-canvas-raised border border-border rounded-pill px-4 py-2 pl-10 text-sm`
   - Focus: `border-accent ring-1 ring-accent-soft`
   - Has search icon inside, left-aligned

### Badge

**One component, 3 intents:**

| Intent               | Style                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| `active` / `success` | `bg-success/10 text-success rounded-pill px-2 py-0.5 text-micro font-medium`    |
| `warn` / `pending`   | `bg-warn/10 text-warn rounded-pill px-2 py-0.5 text-micro font-medium`          |
| `danger` / `urgent`  | `bg-danger/10 text-danger rounded-pill px-2 py-0.5 text-micro font-medium`      |
| `muted` / `inactive` | `bg-canvas-sunk text-ink-muted rounded-pill px-2 py-0.5 text-micro font-medium` |

**Rules:**

- No uppercase. No letter-spacing on badges.
- No border on badges (use background tint only).
- Maximum 4 words per badge.

### Card

**Cards are reserved for:**

- Modal/drawer content
- Draggable widgets
- Content needing elevation (assistant panel)
- Primary CTAs that need emphasis

**Card style:**

- `bg-canvas-raised border border-border rounded-md`
- Shadow: `shadow-md` only on hover or when elevated
- Padding: `16px–20px`
- No shadow by default (flat design)

**Do NOT card-wrap:**

- Tables
- Simple lists
- Metric grids
- Form sections

### Table

- No card wrapper.
- Header: `bg-canvas-sunk border-b border-border`, `text-meta font-medium text-ink-muted uppercase`.
- Rows: `border-b border-border-subtle`, hover: `bg-canvas-sunk/50`.
- No vertical borders between columns.
- Cell padding: `px-4 py-3`.
- Numeric columns: `font-mono text-right`.

### Empty State

- No generic `Workflow` icon.
- Use context-appropriate Lucide icon at `32px`, `text-ink-faint`.
- Title: `text-subhead font-medium text-ink`.
- Detail: `text-small text-ink-muted max-w-md`.
- Action: one primary button, no secondary unless needed.
- Language: human, not architectural. "No patients yet" not "Seed the pilot workspace."

### Modal / Drawer

- Overlay: `bg-ink/20 backdrop-blur-sm`
- Container: `bg-canvas-raised border border-border rounded-lg shadow-lg`
- Header: `border-b border-border px-5 py-4`
- Body: `p-5`
- Footer: `border-t border-border px-5 py-4 flex justify-end gap-3`
- Close button: top-right, `text-ink-muted hover:text-ink`

---

## Status Color System

**Replace the 9-color rainbow with 3 semantic colors + neutral progression:**

| State Category                      | Visual Treatment                      |
| ----------------------------------- | ------------------------------------- |
| Early / Queued / Scheduled          | `text-ink-muted` + subtle dot         |
| Active / In Progress / Checked in   | `text-accent` + accent dot            |
| Completed / Filed / Done / Paid     | `text-ink-faint` + checkmark or muted |
| Blocked / Urgent / Failed / Error   | `text-danger` + danger dot            |
| Warning / Needs attention / Pending | `text-warn` + warn dot                |
| Neutral / Inactive / Cancelled      | `text-ink-faint` + no indicator       |

**No more:** sky, teal, violet, lime, emerald, cyan, pink, purple as status colors.

---

## Navigation

### Sidebar

- Background: `bg-canvas-raised`
- Width: `240px`
- Border: `border-r border-border`
- Logo area: `h-14 px-4 border-b border-border`, flex row, gap-3
- Logo mark: `w-8 h-8 bg-ink text-canvas-raised rounded-md grid place-items-center font-serif text-lg font-medium`
- Logo text: `font-serif text-base font-medium text-ink`
- Section labels: `text-meta font-medium text-ink-faint px-3 pt-4 pb-1` — **NO UPPERCASE, NO TRACKING**
- Nav item: `flex items-center gap-3 px-3 py-2 rounded-md text-small text-ink-muted hover:bg-canvas-sunk hover:text-ink`
- Nav item active: `bg-accent-soft text-accent` + `border-l-2 border-accent` (left accent indicator)
- Nav icon: `w-4 h-4`
- Badge on nav item: `ml-auto bg-accent-soft text-accent rounded-pill px-1.5 py-0.5 text-micro`
- Footer: `border-t border-border p-3`, user name + role + sign out

### Topbar

- Background: `bg-canvas-raised`
- Height: `56px`
- Border: `border-b border-border`
- Padding: `px-5`
- Search bar: `flex-1 max-w-xl bg-canvas border border-border rounded-pill px-4 py-2 text-small text-ink-muted`
- Actions: `flex items-center gap-2`
- Icon buttons: `w-9 h-9 flex items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink`
- Density toggle: `text-meta text-ink-muted border border-border rounded-md px-2 py-1`

### Mobile Nav

- Drawer: `fixed inset-0 z-50 bg-ink/20`
- Panel: `w-72 bg-canvas-raised border-r border-border shadow-lg`
- Same nav item styling as desktop

---

## Assistant Panel

- Background: `bg-canvas-raised`
- Border: `border-l border-border`
- Width: `280px`
- Header: `border-b border-border px-4 py-3`
- Title: `text-subhead font-medium text-ink` — NOT "Clinical Assistant"
- Subtitle: `text-meta text-ink-muted` — NOT "Context-aware shift support"
- Context chips: `flex flex-wrap gap-1.5`, each chip is `bg-canvas-sunk text-ink-secondary rounded-sm px-2 py-1 text-micro`
- Suggestions: `divide-y divide-border`, each item `px-4 py-3`
- Suggestion label: `text-meta font-medium text-ink-muted` — NOT uppercase
- Suggestion detail: `text-small text-ink-secondary mt-0.5`
- Action button: secondary button style, `mt-2`
- Remove the colored severity dot + uppercase label pattern.

---

## Command Palette

- Overlay: `fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4`
- Container: `mx-auto mt-24 max-w-2xl bg-canvas-raised border border-border rounded-lg shadow-lg overflow-hidden`
- Input area: `flex items-center gap-3 border-b border-border px-4 py-3`
- Input: `flex-1 bg-transparent text-body text-ink placeholder:text-ink-faint outline-none`
- Results: `max-h-96 overflow-y-auto p-2`
- Result row: `flex items-center gap-3 px-3 py-3 rounded-md hover:bg-canvas-sunk text-left w-full`
- Result icon: `w-4 h-4 text-accent`
- Result label: `text-small font-medium text-ink`
- Result detail: `text-micro text-ink-muted`

---

## Settings Panel

- Same container style as Command Palette but right-aligned: `ml-auto max-w-md h-full`
- Section headers: `text-meta font-medium text-ink-faint uppercase` — keep uppercase here, it's a settings panel
- Form fields: standard input style
- Save button: primary
- Cancel/Done: ghost

---

## Page-Specific Guidance

### Command Center (Dashboard)

- Page title: `font-serif text-display` — "Command Center"
- Subtitle: `text-small text-ink-muted` — date/context
- Remove: "Demo-ready" badge, "Clinic Needs Strip"
- Metrics: 4-column grid, each metric is `bg-canvas-raised border border-border rounded-md p-4` (no shadow)
  - Value: `font-serif text-2xl font-medium text-ink`
  - Label: `text-meta text-ink-muted mt-1`
  - Note: `text-micro text-ink-faint mt-1`
- Today's Schedule: table on canvas, no card wrapper
- Needs Attention: list with `divide-y divide-border`, no card wrapper
- Document Review Queue: same
- Shift Handoff: same
- Audit Trail: same
- Bottom quick actions: 3 cards with `bg-canvas-raised border border-border rounded-md p-4 hover:border-border-strong`

### Patients

- Page title: `font-serif text-display` — "Patients"
- Document Intake Workbench: table-style layout on canvas, no card wrapper
  - Filter row: `flex gap-2 pb-3 border-b border-border`
  - Each document row: `grid grid-cols-[1fr_32rem] gap-3 px-4 py-3 border-b border-border-subtle`
  - Bulk actions bar: `bg-canvas-sunk px-4 py-2 border-b border-border`
- Patient search: search input variant, `mb-4`
- Patient table: standard table style, no card wrapper
- Pagination: `flex justify-between text-small text-ink-muted mt-4`
- New Patient modal: standard modal style

### Schedule

- Page title: `font-serif text-display` — "Schedule"
- Week navigator: `flex items-center gap-3`
  - Prev/Next: secondary button (icon only)
  - Date range: `text-small font-medium text-ink`
  - Today: ghost button
- Provider Availability: `bg-canvas-raised border border-border rounded-md p-4`
- Reminder Queue: same card style
- Calendar grid: `grid grid-cols-7 gap-0 border border-border rounded-md overflow-hidden`
  - Day header: `bg-canvas-sunk border-b border-border p-2 text-center text-meta font-medium text-ink-muted`
  - Day cell: `min-h-32 border-r border-b border-border-subtle p-2`
  - Today cell: `bg-accent-soft/30`
  - Appointment block: `bg-canvas-sunk border border-border rounded-sm p-2 text-micro`
  - Status colors: use the 3-color semantic system (not the old 9-color rainbow)

### Tasks

- Page title: `font-serif text-display` — "Tasks"
- Filter bar: `flex flex-wrap gap-2 mb-4`
  - Filter buttons: secondary button style, active state uses `bg-ink text-canvas-raised`
- Outreach metrics: 4-column grid, metric style
- Work Queue Control: `bg-canvas-raised border border-border rounded-md`
  - Header: `border-b border-border px-4 py-3 flex justify-between`
  - Stats grid: `grid gap-2`
  - Role/Source buckets: secondary button style
- Task table: standard table style
  - Status dropdown: `border-0 rounded-sm px-2 py-1 text-micro font-medium` with bg color from semantic system
  - Priority: icon + dropdown
  - Action buttons: ghost style, compact
- New Task modal: standard modal
- Outreach Draft modal: standard modal

### Login

- Background: `bg-canvas` (not `bg-clinic-50`)
- Center card: `bg-canvas-raised border border-border rounded-lg shadow-md p-8 max-w-sm mx-auto`
- Logo: `font-serif text-2xl font-medium text-ink` (no Activity icon)
- Title: `font-serif text-headline text-ink`
- Subtitle: `text-small text-ink-muted`
- Inputs: standard input style
- Primary button: full width
- Demo mode button: secondary, full width
- Patient portal link: ghost, full width
- Error banner: `bg-danger/10 border border-danger/20 text-danger rounded-md px-3 py-2 text-small`

### Messaging / Faxes / Billing / Reports / Staff

- Follow the same patterns:
  - Page title: `font-serif text-display`
  - Tables: on canvas, no card wrapper
  - Metrics: 3-4 column grid, `bg-canvas-raised border border-border rounded-md p-4`
  - Actions: primary + secondary buttons
  - Empty states: context-appropriate icon + human language

---

## Animation & Micro-interactions

- **Row hover:** `transition-colors duration-150`, `hover:bg-canvas-sunk/50`
- **Button press:** `active:scale-[0.98] transition-transform duration-75`
- **Card hover:** `transition-shadow duration-200`, `hover:shadow-md` (only if card has shadow by default)
- **Focus ring:** `focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1`
- **Modal enter:** `animate-in fade-in duration-200`
- **Modal content:** `animate-in slide-in-from-bottom-4 duration-200`
- **Nav active indicator:** `transition-all duration-150`

---

## Responsive Rules

- **Desktop (≥1280px):** Full layout — sidebar + main + assistant panel
- **Tablet (768–1279px):** Sidebar + main, assistant panel as drawer
- **Mobile (<768px):** Collapsible sidebar drawer, main only, assistant as drawer
- **Tables:** Horizontal scroll with `overflow-x-auto` on mobile
- **Metrics:** 4 cols → 2 cols → 1 col
- **Modals:** Full-screen on mobile, `p-4` padding

---

## What to Remove

1. **Supervisor box** in sidebar — remove entirely
2. **Clinic Needs Strip** — remove entirely
3. **"Demo-ready" badge** — remove from Command Center header
4. **"AI Review" nav label** — rename to "Assistant Log"
5. **All `text-clinic-*` and `bg-clinic-*` classes** — replace with new tokens
6. **All `text-accent-*` numeric shades** — use `accent`, `accent-hover`, `accent-soft`, `accent-on`
7. **Card wrappers around tables and simple lists** — remove 70% of cards
8. **Uppercase section labels with tracking** — use normal case
9. **9-color status rainbow** — replace with 3 semantic colors
10. **Generic empty state icon** — use context-appropriate icons

---

## Implementation Order

1. **Design system** (`index.css` + shared components) — must be done first
2. **Root layout** (`__root.tsx`) — sidebar, topbar, assistant panel, modals
3. **Pages** — can be done in parallel after design system is merged
4. **Cleanup** — remove old color references, verify no `clinic-*` classes remain

---

_This document is the contract. All workers must follow these specs exactly. No improvisation on colors, spacing, or component variants._
