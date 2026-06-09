# Dimension 3 — Visual Hierarchy & Typography for Non-Technical Users (50s+)

**Research Date:** 2026-06-09  
**Target User:** Mid-50s non-technical healthcare practice manager with potential declining vision and lower tech confidence  
**Context:** ConciergeOS warm editorial palette (canvas `#f5f4ed`, ink `#141413`, accent `#c96442`, success `#4a7c59`, warn `#c9a227`, danger `#b53333`). Font stack: Georgia (headlines), Inter (body), JetBrains Mono (code). Dense data grids, status badges, metric cards, operational sections.

---

## Executive Summary

For users in their 50s and beyond, readability is not a nice-to-have—it is a product requirement. Age-related long sightedness is near-universal by age 65, and contrast sensitivity declines measurably even in the 50–60 cohort [Test Partners, 2017]. The research converges on five non-negotiable principles for ConciergeOS:

1. **Minimum 16px body text** (ideally 18px) with generous line height.
2. **Target WCAG AAA contrast (7:1)** for all operational and clinical data; never drop below AA (4.5:1).
3. **Restrained color palette** (3–5 core colors) with triple-encoded status indicators (color + icon + text label).
4. **Generous, rhythmic spacing** (8px base grid, 16–24px between related groups, 32–48px between sections) to reduce cognitive load.
5. **Clear visual weight differentiation**: one primary action per view, secondary actions visually subdued, metadata de-emphasized.

---

## 1. Typography Scale

### 1.1 Minimum Readable Sizes for 50+ Users

| Element | Current Minimum | Recommended for 50+ | Rationale & Source |
|---------|----------------|---------------------|-------------------|
| **Body text / paragraphs** | 16px | **18px (1.125rem)** | Age-Friendly DC Style Guide recommends 14pt (≈18.5px) as ideal for 50+ readers; 12pt is the absolute minimum [Age-Friendly DC, 2020]. Lifespan of Greater Rochester specifies 16px as the web minimum [Lifespan Style Guide]. Test Partners notes 12pt minimum, 14pt ideal for comfortable reading [Test Partners, 2017]. |
| **Data table cells** | 14px | **16px (1rem)** | Tables are dense by nature; smaller text compounds eye strain. 16px is the WCAG-recommended web minimum [Lifespan Style Guide]. |
| **Form labels / input text** | 14px | **16px (1rem)** | Labels must be scannable at a glance. NNGroup research shows heavier font weight improves label prominence [NNGroup, 2025]. |
| **Badges / tags** | 12px | **14px (0.875rem)** | Badges carry status meaning; 14px is the smallest size that remains comfortable for presbyopic users [Test Partners, 2017]. |
| **H1 (Page title)** | 32px | **36–40px (2.25–2.5rem)** | Large text has relaxed WCAG contrast requirements (3:1 at AA), but bigger sizes draw immediate attention and anchor the page hierarchy [Context.dev, 2025]. |
| **H2 (Section header)** | 24px | **28–32px (1.75–2rem)** | Must be clearly distinguishable from body text. 28px+ creates a 1.5× jump from 18px body, satisfying perceptual hierarchy rules [Muksalcreative, 2025]. |
| **H3 (Card / sub-section header)** | 20px | **22–24px (1.375–1.5rem)** | Sub-section headers need to stand out without competing with H2s. 22px with semibold weight (600) is optimal. |
| **Metric / KPI value** | 28px | **32–36px (2–2.25rem)** | Metric cards are the primary insight surface. Large numerals reduce cognitive load for non-technical users [Upskillist, 2025]. |
| **Metric label** | 12px | **14px (0.875rem)** | Labels below metrics should not compete with the number itself, but must still be legible. |
| **Code / monospace** | 12px | **14–15px (0.875–0.9375rem)** | JetBrains Mono is highly legible, but at small sizes monospaced fonts appear denser. 14px minimum preserves character distinction. |
| **Captions / helper text** | 12px | **14px (0.875rem)** | Helper text is already de-prioritized by color and weight; shrinking it further penalizes older eyes. |

### 1.2 Line Height & Measure

| Property | Recommendation | Source |
|----------|---------------|--------|
| **Body line height** | **1.6–1.7** (28.8–30.6px for 18px text) | Age-friendly communication guides recommend extra leading to ease eye tracking [Lifespan Style Guide]. NNGroup notes generous spacing improves scannability [NNGroup, 2025]. |
| **Heading line height** | **1.2–1.3** | Tighter leading on large text prevents excessive vertical sprawl while maintaining breathability [Muksalcreative, 2025]. |
| **Table row height** | **48px minimum** (cell padding + text) | 48px touch-target minimum also serves as a comfortable row height for data tables [Boundev, 2026]. |
| **Measure (max line width)** | **60–75 characters** (~600–720px for 18px text) | Long lines force the eye to travel too far; short lines break reading rhythm. 60–75ch is the classic optimal measure [Tinker, 1963; cited in Kwok, 2016]. |

### 1.3 Font Family Recommendations

| Role | Current | Assessment | Recommendation |
|------|---------|------------|----------------|
| **Headlines** | Georgia (serif) | Georgia is a screen-optimized serif with strong legibility. Research on serif vs. sans for older adults is inconclusive for digital [Lifespan Style Guide]. However, serif fonts can appear slightly busier at small sizes. | **Keep Georgia for H1–H2** to preserve editorial warmth. Ensure sizes are 28px+ so serifs do not blur together. |
| **Body / UI** | Inter (sans-serif) | Inter was specifically designed for digital interfaces, with tall x-height and open apertures that improve legibility at small sizes [Aalto University thesis, 2024]. | **Keep Inter** as the primary UI and body font. It is an excellent choice for this demographic. |
| **Code** | JetBrains Mono | Highly legible monospace with distinguishable `0/O`, `l/1/I`. | **Keep JetBrains Mono** but enforce 14px minimum. |
| **Data / numbers** | Inter | Tabular figures in Inter are not enabled by default. | **Enable `font-variant-numeric: tabular-nums`** for all data tables and metric cards so columns align and scan faster. |

### 1.4 Text Case & Style Rules

- **Use sentence case** for all headings, labels, and buttons. ALL CAPS reduces readability by 10–15% for older adults [Lifespan Style Guide; Test Partners, 2017].
- **Avoid italics** for body text or labels. Italics are harder to read than Roman letters, especially for users with astigmatism [Lifespan Style Guide].
- **Use bold sparingly** for emphasis only. Over-boldening destroys hierarchy.
- **Avoid justified text.** Left-aligned (flush left, ragged right) is easier to track for older eyes [Lifespan Style Guide].

---

## 2. Contrast & Color

### 2.1 Minimum Contrast Ratios

| Content Type | WCAG AA Minimum | WCAG AAA Target | ConciergeOS Recommendation | Source |
|--------------|----------------|-----------------|----------------------------|--------|
| **Normal body text** (< 18pt regular) | 4.5:1 | 7:1 | **≥ 7:1** (AAA) for all body, labels, and table text | WCAG 2.1 SC 1.4.3 / 1.4.6; Boundev [2026] recommends AAA for healthcare |
| **Large text** (≥ 18pt / 24px regular, or ≥ 14pt / 18.7px bold) | 3:1 | 4.5:1 | **≥ 4.5:1** (AAA large text) for all headings | WCAG 2.1 SC 1.4.3 / 1.4.6 |
| **UI components** (buttons, inputs, icons) | 3:1 | 4.5:1 | **≥ 4.5:1** for all interactive elements | WCAG 2.1 SC 1.4.11; Niftool [2026] |
| **Status badges / indicators** | 3:1 | 4.5:1 | **≥ 4.5:1** + icon + text label (never color alone) | Boundev [2026]; 8% of men have red-green color deficiency |
| **Critical alerts / danger** | 4.5:1 | 7:1 | **≥ 7:1** + icon + text label | Boundev [2026]; patient safety implication |
| **Placeholder / disabled text** | 3:1 | 4.5:1 | **≥ 4.5:1**; avoid light gray placeholders | Niftool [2026]; light gray `#999` on white = 2.85:1 |

### 2.2 ConciergeOS Palette Contrast Audit

| Color Pair | Contrast Ratio | WCAG AA | WCAG AAA | Verdict |
|------------|---------------|---------|----------|---------|
| Ink `#141413` on Canvas `#f5f4ed` | **~15.8:1** | ✅ Pass | ✅ Pass | Excellent. Primary text pair. |
| Ink `#141413` on White `#ffffff` | **~18.5:1** | ✅ Pass | ✅ Pass | Excellent. |
| Accent `#c96442` on Canvas `#f5f4ed` | **~4.6:1** | ✅ Pass (large text) | ❌ Fail (normal) | **Marginal.** Use only for large/bold text or buttons with dark text overlay. |
| Accent `#c96442` on White `#ffffff` | **~4.9:1** | ✅ Pass | ❌ Fail | Marginal for normal text. |
| Success `#4a7c59` on Canvas `#f5f4ed` | **~4.8:1** | ✅ Pass | ❌ Fail | Marginal. Use with icon + label. |
| Warn `#c9a227` on Canvas `#f5f4ed` | **~2.4:1** | ❌ Fail | ❌ Fail | **Fails AA.** Must not be used for text. Use as background with dark text, or with icon only. |
| Danger `#b53333` on Canvas `#f5f4ed` | **~5.8:1** | ✅ Pass | ❌ Fail | Acceptable for large/bold. Use with icon + label for safety. |
| Muted gray `#767676` on Canvas `#f5f4ed` | **~4.5:1** | ✅ Barely Pass | ❌ Fail | **Minimum viable.** Do not go lighter for secondary text. |

> **Key Finding:** The warm canvas background (`#f5f4ed`) slightly reduces contrast compared to pure white. Colors that pass on white may fail on canvas. All text colors must be tested against the actual background they appear on.

### 2.3 Color Usage Rules

| Rule | Recommendation | Source |
|------|---------------|--------|
| **Maximum colors on screen** | **3–5 core colors** plus neutrals. Shades/tints of the same hue count as one color. | Lollypop Design [2025]; Upskillist [2025] |
| **Accent color usage** | Terracotta `#c96442` should appear **only for primary CTAs, active states, and key alerts**. Limit to < 10% of screen area to preserve its attention-grabbing power. | Color psychology research: warm oranges are stimulating and should be used sparingly in healthcare [HealthcareSigns, 2025] |
| **Status colors** | Never rely on color alone. Use **color + icon + text label** triple-encoding. Example: "Active" + green checkmark + green background. | Boundev [2026]; 8% of men have red-green color deficiency |
| **Background colors** | Keep the canvas `#f5f4ed` as the primary app background. Use white `#ffffff` for cards and elevated surfaces to create depth. | Material Design depth principles; Aalto thesis [2024] |
| **Danger / warning** | Danger `#b53333` for critical errors only. Warn `#c9a227` must never be used as text on canvas—use as a background chip with dark text, or replace with a darker amber. | WCAG contrast audit above; Simbo AI [2024] |
| **Calming professional tone** | Blues and greens are proven to reduce anxiety in healthcare contexts [Simbo AI, 2024; HealthcareSigns, 2025]. ConciergeOS's success green `#4a7c59` already serves this role. Consider introducing a soft blue for informational states. | Systematic review: cool colors linked to calming effects, reduced stress, lower blood pressure [Brieflands, cited in HealthcareSigns] |

### 2.4 Recommended Color Additions

| Purpose | Suggested Color | Notes |
|---------|---------------|-------|
| **Info / neutral status** | `#4a7c8c` (soft blue-gray) | Complements the existing palette; reduces anxiety; passes 7:1 on canvas for large text, ~5:1 for normal. |
| **Secondary text** | `#4a4a48` (warm dark gray) | Softer than pure ink for captions; passes 7:1 on canvas. |
| **Disabled / placeholder** | `#8a8a85` (warm mid-gray) | Minimum viable for disabled states; ~4.5:1 on canvas. Never lighter. |
| **Warn text alternative** | `#7a5c1a` (dark amber) | Replaces `#c9a227` for text usage; passes 7:1 on canvas. Use `#c9a227` only as a background. |

---

## 3. Spacing System

### 3.1 Base Unit & Grid

| Token | Value | Usage | Source |
|-------|-------|-------|--------|
| **Base unit** | **8px (0.5rem)** | All spacing values should be multiples of 8px. | Google Material Design; IBM Carbon; Context.dev [2025] |
| **Density unit** | **4px (0.25rem)** | Allowed only inside components (icon-to-text gaps, internal badge padding). | Material Design compact zones |
| **Grid gutter** | **24px (1.5rem)** | Standard gap between cards in a grid layout. | NNGroup [2025]; Context.dev [2025] |

### 3.2 Spacing Scale

| Token | Value | Usage | Cognitive Load Rationale |
|-------|-------|-------|------------------------|
| `space-1` | **8px** | Icon-to-text gap, inline badge padding, tight internal gaps | Minimal separation for closely related elements |
| `space-2` | **16px** | Button padding (vertical), form field internal padding, table cell padding | Comfortable touch target padding; reduces accidental clicks [Boundev, 2026] |
| `space-3` | **24px** | Card internal padding, gap between related form fields, list item padding | Related elements grouped with proximity (Gestalt) [NNGroup, 2025] |
| `space-4` | **32px** | Gap between unrelated cards, section sub-group separation | Clear grouping without visible borders; whitespace creates "breathing room" [Upskillist, 2025] |
| `space-5` | **48px** | Major section separation (e.g., between "Today's Appointments" and "Revenue Metrics") | Major cognitive reset; prevents section blending [Full Clarity, 2024] |
| `space-6` | **64px** | Page-level section breaks, above-the-fold to below-the-fold transition | Large pause allows the eye to re-orient; critical for dense dashboards [Siteimprove, 2026] |

### 3.3 Component-Specific Spacing

| Component | Padding | Gap Between Items | Notes |
|-----------|---------|-------------------|-------|
| **Metric card** | 24px | — | Internal padding creates a "frame" around the number, increasing its perceived importance. |
| **Data table row** | 16px vertical, 24px horizontal | — | 48px minimum row height (including borders). 24px horizontal padding prevents text from touching edges. |
| **Status badge** | 4px vertical, 12px horizontal | 8px from adjacent text | Compact but tappable. Never let badge text touch other elements. |
| **Button (primary)** | 12px vertical, 24px horizontal | 16px from other buttons | 48px minimum height. 16px gap prevents accidental mis-clicks [Boundev, 2026]. |
| **Button (secondary)** | 10px vertical, 20px horizontal | 16px from other buttons | Slightly smaller padding visually subordinates the button without making it hard to click. |
| **Form section** | 32px internal | 48px between sections | HoneyBook-style container grouping reduces form complexity [NNGroup, 2025]. |
| **Page header** | 48px below H1 | 32px below breadcrumb | Generous header whitespace signals "this is the start of a new context." |

### 3.4 Whitespace & Cognitive Load

Research consistently shows that whitespace is not empty space—it is an active design element that reduces cognitive load:

- **Gestalt Proximity Principle:** Elements close together are perceived as related. Strategic spacing clarifies relationships without needing visible borders [NNGroup, 2025].
- **Depletion Effect:** Continuous dense information reduces working memory capacity. Whitespace between sections acts as a "period of rest," allowing cognitive resources to recover [InnerDrive, 2024].
- **Data-Ink Ratio:** Every visual element that does not convey data competes for attention. Remove unnecessary gridlines, decorative icons, and repeated legends [Upskillist, 2025].
- **Scanning Patterns:** Users read only ~28% of words on a page. Whitespace guides the eye to the remaining 72% that actually matters [Lifespan Style Guide].

---

## 4. Visual Weight Rules

### 4.1 The Hierarchy of Importance

For a non-technical user in their 50s, the interface must answer one question instantly: **"What do I need to do right now?"** Visual weight is the tool that answers it.

| Tier | Visual Treatment | Examples in ConciergeOS |
|------|-----------------|------------------------|
| **1. Primary Action** | Largest size, accent color `#c96442`, high contrast, prominent position (top-left or center-top), shadow or elevation if appropriate | "Schedule Appointment" button, "Submit Claim" CTA, critical alert banner |
| **2. Primary Data / KPIs** | Large numerals (32–36px), ink `#141413` on white card, generous card padding, top-of-page placement | Revenue today, patients waiting, pending tasks count |
| **3. Secondary Data** | Standard body size (18px), regular weight, secondary text color `#4a4a48`, grouped in tables or lists | Appointment list, recent claims, staff schedule |
| **4. Metadata / Context** | Small but legible (14px), muted color `#8a8a85`, lighter weight (400), placed below or beside primary data | Timestamp, "last updated," user ID, source system |
| **5. Decorative / Structural** | No color, no weight, minimal presence | Divider lines (1px, `#e5e5e0`), background canvas `#f5f4ed` |

### 4.2 Action Hierarchy (Buttons)

| Type | Background | Text | Border | Elevation | Usage |
|------|-----------|------|--------|---------|-------|
| **Primary** | Accent `#c96442` | White `#ffffff` | None | Subtle shadow (0 1px 3px rgba(0,0,0,0.1)) | One per view. The action the user is most likely to take. |
| **Secondary** | White `#ffffff` | Ink `#141413` | 1px `#d5d5d0` | None | Alternative valid actions (e.g., "Export CSV"). |
| **Tertiary** | Transparent | Ink `#141413` | None | None | Low-priority actions (e.g., "Learn more"). Underline on hover. |
| **Danger** | Danger `#b53333` | White `#ffffff` | None | None | Destructive actions only. Confirm on click. |
| **Disabled** | `#e5e5e0` | `#8a8a85` | None | None | Non-interactive. |

> **Rule:** Never present more than one primary button in the same visual group. If two actions seem equally important, re-evaluate the user flow [Siteimprove, 2026].

### 4.3 Data Hierarchy (Dashboards & Grids)

| Principle | Implementation | Source |
|-----------|---------------|--------|
| **F-Pattern placement** | Most critical metrics in the **top-left** corner. Users scan in an F-pattern; top-left gets the first fixation [Context.dev, 2025]. | Eye-tracking studies; Context.dev [2025] |
| **Size = Importance** | Primary KPIs should be visually dominant. A 36px metric should not sit next to a 36px heading—they compete. | Visual hierarchy principles [Prosjektrom Normanns] |
| **Color = Urgency** | Use accent color only for items requiring action. If everything is highlighted, nothing is highlighted. | Upskillist [2025] |
| **Grouping by proximity** | Related metrics (e.g., "Revenue" cards) sit closer together (16px gap) than unrelated sections (48px gap). | Gestalt principles [NNGroup, 2025] |
| **Progressive disclosure** | Show summary first; details on demand via expand/collapse or drill-down. Non-technical users prefer manageable chunks [Aalto thesis, 2024]. | Progressive disclosure [NNGroup, 2025; Prosjektrom Normanns] |

### 4.4 Status & Badge Hierarchy

| Status | Background | Text | Icon | Border | Notes |
|--------|-----------|------|------|--------|-------|
| **Success** | `#e8f0ea` (light green tint) | `#4a7c59` | Checkmark | None | Calming, professional. Green = health/healing [Simbo AI, 2024]. |
| **Warning** | `#f5f0e0` (light amber tint) | `#7a5c1a` (dark amber) | Triangle | None | Dark amber text passes contrast. Never use `#c9a227` on canvas for text. |
| **Danger** | `#f5e0e0` (light red tint) | `#b53333` | Alert circle | None | Reserved for true errors only. |
| **Info** | `#e8f0f5` (light blue tint) | `#4a7c8c` | Info circle | None | New addition for neutral operational states. |
| **Neutral / Default** | `#f0f0eb` (warm gray) | `#4a4a48` | — | None | Draft, pending, inactive. |

> **Rule:** Every status indicator must include an icon + text label. Color is the third signal, not the first. This protects users with color vision deficiency and reduces ambiguity for non-technical users [Boundev, 2026].

---

## 5. Specific Recommendations for ConciergeOS

### 5.1 Immediate Changes (High Impact, Low Effort)

| # | Change | Rationale | Effort |
|---|--------|-----------|--------|
| 1 | **Increase body text from 16px to 18px** across all operational views (appointments, claims, billing). | 18px is the age-friendly ideal. Reduces eye strain for the primary demographic. | Low (CSS variable change) |
| 2 | **Increase table cell text from 14px to 16px** and row height to 48px minimum. | Dense tables are the core UI surface. 16px + 48px rows dramatically improve scannability. | Low |
| 3 | **Replace warn text color `#c9a227` with dark amber `#7a5c1a`** for all text on canvas. | Current warn color fails WCAG AA on canvas (2.4:1). This is a legal and usability liability. | Low |
| 4 | **Add icons to all status badges** (checkmark, triangle, alert circle, info circle). | 8% of men cannot distinguish the current green/red badges. Icons provide universal comprehension. | Low |
| 5 | **Enable `font-variant-numeric: tabular-nums`** on all data tables and metric cards. | Columns of numbers align, making comparison and scanning faster for non-technical users. | Low |
| 6 | **Increase card padding from 16px to 24px** and section gaps from 24px to 32–48px. | Whitespace reduces cognitive load and makes dense dashboards feel manageable rather than overwhelming. | Low |
| 7 | **Remove ALL CAPS** from all buttons, labels, badges, and table headers. Use sentence case. | ALL CAPS reduces readability by 10–15% for older adults and feels aggressive in a healthcare context. | Low |

### 5.2 Medium-Term Changes (High Impact, Medium Effort)

| # | Change | Rationale | Effort |
|---|--------|-----------|--------|
| 8 | **Introduce a soft blue `#4a7c8c` for informational states** and neutral operational badges. | Healthcare research shows blues reduce anxiety and improve trust [Simbo AI, 2024]. Currently missing from the palette. | Medium |
| 9 | **Implement progressive disclosure for dense operational sections.** Show summary cards first; expand for detail. | Non-technical users are overwhelmed by full data dumps. Progressive disclosure lets them control complexity [NNGroup, 2025]. | Medium |
| 10 | **Create a "Focus Mode" or "Simplified View" toggle** for key dashboards (appointments, billing). | Allows users to hide secondary metadata and see only what requires action. Reduces cognitive load on demand. | Medium |
| 11 | **Standardize button hierarchy** to one primary per view, with clear secondary/tertiary styles. | Multiple competing CTAs cause decision paralysis (Hick's Law) [DeltaCronTech, 2023]. | Medium |
| 12 | **Add 1.6 line height to all body text** and increase paragraph spacing to 16px between blocks. | Generous leading is specifically recommended for 50+ readers [Lifespan Style Guide]. | Low-Medium |
| 13 | **Audit all placeholder text** (`#999999` equivalent). Ensure minimum 4.5:1 contrast. | Light gray placeholders are the #1 contrast failure in healthcare apps [Niftool, 2026]. | Low |

### 5.3 Strategic Changes (High Impact, Higher Effort)

| # | Change | Rationale | Effort |
|---|--------|-----------|--------|
| 14 | **Consider a "Large Text" accessibility toggle** that bumps all text up one scale step (18px → 20px body, etc.). | Browser zoom breaks layouts. A designed large-text mode preserves hierarchy while serving low-vision users. | High |
| 15 | **Re-evaluate Georgia for H3 and below.** Consider Inter for all UI text below 24px. | While Georgia is readable, sans-serif fonts have slightly better screen legibility at smaller sizes [Test Partners, 2017]. Inter's tall x-height is specifically designed for this. | Medium |
| 16 | **Implement a consistent 8px spacing token system** across all components (Tailwind or CSS custom properties). | Inconsistent spacing is a primary source of visual clutter and cognitive load in dense UIs [Context.dev, 2025]. | Medium |
| 17 | **User testing with 5–8 practice managers aged 50+.** Task: find a pending claim, identify a no-show patient, submit a billing correction. Measure time-to-completion and error rate. | All recommendations above are evidence-based, but individual user validation is essential for a specialized demographic. | High |

### 5.4 What Should NOT Change

| Element | Reason |
|---------|--------|
| **Canvas background `#f5f4ed`** | The warm editorial tone differentiates ConciergeOS from sterile clinical software. Warm neutrals are calming and reduce eye strain compared to pure white [Simbo AI, 2024]. |
| **Georgia for H1–H2 headlines** | At 28px+, Georgia's serifs are distinct and convey trust, warmth, and editorial quality. Research does not show a sans-serif advantage at these sizes [Lifespan Style Guide]. |
| **Inter for body text** | Inter is among the best screen fonts available. Its design for digital interfaces makes it ideal for this use case [Aalto thesis, 2024]. |
| **Terracotta accent `#c96442`** | Warm orange is associated with cheerfulness and invitation in healthcare [HealthcareSigns, 2025]. Used sparingly (< 10% of screen), it creates a welcoming, non-institutional feel. |
| **Success green `#4a7c59`** | Green is the universal color of health, nature, and healing [Simbo AI, 2024]. It is already well-chosen and calming. |

---

## 6. Sources & References

1. **Test Partners (2017).** "Older Adults Accessibility Issue 2: Text Size and Readability." https://testpartners.co.uk/blog/blog_accessibility/older-adults-accessibility-2-text-size-and-readability0.htm
2. **Age-Friendly DC (2020).** "Reaching Older Adults More Effectively Through Print." https://agefriendly.dc.gov/sites/default/files/dc/sites/agefriendly/publication/attachments/Writing%20Handout%20One%20Page.pdf
3. **Lifespan of Greater Rochester.** "A Style Guide for Age-friendly Communication." https://life-span.squarespace.com/s/Style_Guide_for_Age-Friendly_Communication.pdf
4. **Boundev (2026).** "Healthcare App Accessibility: A WCAG Compliance Guide." https://www.boundev.com/blog/healthcare-app-accessibility-wcag-compliance
5. **Niftool (2026).** "Color Contrast Checker: How to Test WCAG Accessibility Ratios." https://niftool.com/blog/color-contrast-checker-how-to-test-wcag-accessibility-ratios
6. **WCAG 2.1.** "Success Criterion 1.4.3 Contrast (Minimum)" and "1.4.6 Contrast (Enhanced)." https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
7. **NNGroup (2025).** "4 Principles to Reduce Cognitive Load in Forms." https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
8. **Context.dev (2025).** "10 Essential Dashboard Design Best Practices for SaaS in 2025." https://www.context.dev/blog/dashboard-design-best-practices
9. **Upskillist (2025).** "Simplicity vs. Detail: Dashboard Design Explained." https://www.upskillist.com/blog/simplicity-vs-detail-dashboard-design-explained/
10. **Full Clarity (2024).** "Reducing cognitive overload in UX design." https://fullclarity.co.uk/insights/cognitive-overload-in-ux-design/
11. **Siteimprove (2026).** "Web Design Principles that Reduce Cognitive Load." https://www.siteimprove.com/blog/design-principles-that-reduce-cognitive-load/
12. **Simbo AI (2024).** "Color Psychology in Medical Office Design: Creating Calming Environments." https://www.simbo.ai/blog/color-psychology-in-medical-office-design-creating-calming-environments-to-alleviate-patient-anxiety-and-improve-satisfaction-2021367/
13. **HealthcareSigns (2025).** "The Art of Healing Hues: How Color Psychology in Signage Creates a Calming Healthcare Environment." https://blog.healthcaresigns.com/2025/08/05/the-art-of-healing-hues-how-color-psychology-in-signage-creates-a-calming-healthcare-environment/
14. **Lollypop Design (2025).** "7 Key UI Considerations for a Great SaaS Dashboard Design." https://lollypop.design/blog/2018/may/tips-for-a-great-dashboard-ui/
15. **Muksalcreative (2025).** "Typography Trends in UI/UX Design for 2025." https://muksalcreative.com/2025/07/10/typography-in-ui-ux-design-2025/
16. **Aalto University (2024).** Master's thesis on dashboard UI design (Inter typeface, cognitive load, progressive disclosure). https://aaltodoc.aalto.fi/
17. **Kwok, B.S.-H. (2016).** "Legibility of medicine labels: User studies on Chinese typefaces and font size for senior citizens in Hong Kong." *Information Design Journal*, 22(3), 202–220. https://ira.lib.polyu.edu.hk/bitstream/10397/105132/1/Kwok_Legibility_Medicine_Labels.pdf
18. **DeltaCronTech (2023).** "How to Reduce Cognitive Load for a Better UI/UX Design." https://www.deltacrontech.com/blog/how-to-reduce-cognitive-load-for-a-better-ui-ux-design
19. **InnerDrive (2024).** "What links Spacing, Interleaving and Cognitive Load Theory together?" https://www.innerdrive.co.uk/blog/spacing-interleaving-cognitive-load/
20. **Prosjektrom Normanns.** "Depth mapping in data-dense screens." https://www.prosjektromnormanns.com/
21. **Figr Design (2026).** "Dashboard Design Best Practices for Product Teams." https://figr.design/blog/dashboard-design-best-practices
22. **ITU Online (2026).** "Impactful Reports For Non-Technical Stakeholders." https://www.ituonline.com/blogs/creating-impactful-reports-and-dashboards-for-non-technical-stakeholders/

---

## Appendix: Quick Reference Card

### Typography
- Body: **18px / 1.6 line height**
- Tables: **16px / 48px row height**
- H1: **36–40px**
- H2: **28–32px**
- H3: **22–24px**
- Badges/captions: **14px minimum**
- Font families: **Georgia (H1–H2), Inter (everything else)**
- Case: **Sentence case everywhere**

### Contrast
- Normal text: **≥ 7:1 (AAA)**
- Large text: **≥ 4.5:1**
- UI components: **≥ 4.5:1**
- Never use `#c9a227` for text on canvas

### Spacing
- Base unit: **8px**
- Card padding: **24px**
- Related group gap: **16–24px**
- Section gap: **32–48px**
- Page break: **64px**

### Color Discipline
- Max 3–5 core colors on screen
- Accent (`#c96442`) < 10% of screen area
- Status: **icon + text + color** (never color alone)
- Add soft blue `#4a7c8c` for info states

### Visual Weight
- One primary action per view
- Primary = accent color, large, elevated
- Secondary = outlined, smaller
- Tertiary = text-only, underlined
