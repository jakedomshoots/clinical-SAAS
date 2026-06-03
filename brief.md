# ConciergeOS — Design Constitution

## Register

**Product.** This is a clinical instrument, not a brand experience. Providers and staff operate this surface 8+ hours a day. Speed, reliability, and clarity are the deliverables. Every visual decision must earn trust through consistency, not novelty.

## Users

- **Provider** — encounters, documentation, prescriptions, lab review. High cognitive load. Needs to move fast without thinking about the UI.
- **Medical Assistant** — intake, follow-up, tasks, faxes. Switching contexts all day.
- **Front Desk** — scheduling, check-in/check-out, patient lookup. Repetitive workflows at volume.
- **Office Manager** — reporting, oversight, staff management. Needs scan-ability across the practice.
- **Patient** — messaging, forms, results, appointment requests. Low frequency, low training.

## Voice

Calm, solid, fast. The interface should feel like a well-built medical instrument — nothing jumps, nothing lags, nothing surprises you. It recedes so the patient and the work occupy attention, not the tool.

## Anti-References

- **Generic SaaS** (Linear, Vercel, Stripe) — no gradients, glassmorphism, purple blur, startup chrome, or dark-on-dark terminal aesthetics
- **Legacy EHR** (Athenahealth, Epic, Cerner) — no dense gray grids, 90s enterprise chrome, or 100-field forms
- **Consumer health apps** — no cartoon illustrations of smiling doctors, no oversized rounded everything

## Composition Defaults

The dominant work patterns are **Operate** and **Monitor**.

- **Operate** surfaces — patient chart, scheduler, charting, tasks, fax center, labs, prescriptions. These need command bars, inspectors, side panels, and direct manipulation. The patient chart is the central domain artifact; everything else orbits it.
- **Monitor** surfaces — the desktop system tray and health dashboard. Status boards, sync indicators, backup state, alerts with live priority.

Allowed layout shapes: split panes, master-detail, timeline feeds, command bars with side panels, table-with-inspector. Reject centered heroes, card grids with pills, and marketing layouts on product surfaces.

## Visual Foundation

**Color — Calm & Grounded**
- Neutral-first palette with low-chroma warmth. The interface should feel like a physical workspace: slate, warm gray, subtle green or amber for status. No medical blue-teal-white, no SaaS purple-to-cyan.
- High contrast for clinical text — data must be readable under fluorescent lights on varied monitors.
- Status colors (red/amber/green) must pass deuteranopia, protanopia, and tritanopia simulations.
- The system tray icon is the only brand surface — subtle, professional, recognizable at 16px.

**Type — System Fonts**
- Use the OS-native interface font stack: SF Pro (macOS), Segoe UI (Windows), system-ui (fallback). No web font loading, no FOUT. This is a desktop-first product.
- Clinical data requires clear hierarchy: patient name, vitals, lab values, medication names must be instantly scannable.
- Measure: 65-75ch for reading contexts (clinical notes, messages). Tighter for data-dense tables and lists.

**Layout — The Patient Chart is Central**
- Master-detail: patient list → patient chart with tabbed sections (demographics, encounters, labs, tasks, messages)
- Side panels for task queues, fax inbox, lab results — collapsible, not modal
- Density tunable — compact for power users, relaxed for patient-facing views
- The desktop system tray and server health dashboard use a separate, minimal composition

**Depth & Motion**
- Three-plane model: background (data surfaces), content (charts, forms, tables), attention (notifications, sync alerts, system tray popovers)
- Motion is reserved for system events: sync completion, new lab result, incoming fax, task assignment. No decorative transitions on product surfaces.
- Responsive to `prefers-reduced-motion`.

## Component Rules

- **Tables** are a primary interface element — patient lists, schedules, task queues, fax logs, lab results. TanStack Table by default. Sortable, filterable, selectable. Row density control.
- **Forms** are high-frequency — SOAP notes, intake forms, labs orders, prescriptions. Inline validation, auto-save drafts, section collapsibility. Never a single 40-field form.
- **Side panels** over modals for inspection — patient preview, task detail, fax viewer. Modals reserved for destructive actions and system alerts only.
- **Command palette** — global Cmd+K for patient lookup, task creation, navigation. The fastest path to any record.
- **Status indicators** — sync health (green/amber/red badge), task priority, fax delivery state, lab order status. Consistent icon + color language.

## Accessibility

- WCAG 2.2 AA minimum. Clinical data demands AAA for body text contrast.
- Full keyboard navigation — providers often chart with keyboard shortcuts.
- Focus rings visible and consistent at 2px with 3:1 contrast offset.
- Touch targets minimum 44×44px for tablet use (iPad at front desk, provider tablet on rounds).
- Screen reader support for all patient data, lab values, and clinical content.

## Desktop Shell (Tauri)

The Tauri application is the clinic's server supervisor, not the primary clinical interface. It lives in the system tray with:
- Server status indicator (green/yellow/red)
- Sync status
- Backup controls
- One-click "Open Portal" to launch the browser interface
- Settings and quit

Staff access the full product via browser at localhost. The Tauri window is minimal, system-native in feel, and never competes with the clinical interface.

## Drift to Refuse

- Any hero section, centered CTA block, or marketing layout on a product surface
- Gradients, glassmorphism, or decorative blur
- Blue-violet or purple-to-cyan as a primary accent
- Card grids with pill-shaped tags as the default layout
- Illustrations of doctors, patients, or medical cross icons
- Dark mode as the only mode — this ships light mode first, dark as a preference
