# Dimension 2 — Information Architecture for Complex Operations Pages

**Research Date:** 2026-06-09  
**Project:** ConciergeOS Healthcare Practice Management SaaS  
**Target User:** Mid-50s, non-technical healthcare practice manager  
**Design Context:** Warm parchment canvas (#f5f4ed), terracotta accent (#c96442)  
**Goal:** Enable users to locate any of 20+ operational sections in under 3 seconds

---

## Executive Summary

Current state: 20 operational sections dumped on a single long-scroll page. Research across information architecture, healthcare workflow design, SaaS navigation patterns, and aging-population UX consistently points to the same solution: **chunk the 20 sections into 5 phase-based groups, present them in a collapsible sidebar with progressive disclosure, and supplement with global search**. This approach respects working memory limits (Miller's Law), matches healthcare workers' process-oriented mental models, and accommodates the visual and cognitive needs of users in their 50s.

---

## 1. Grouping Strategies

### Strategy A: By Implementation Phase (Timeline-Based)

Organize sections according to where they fall in the software implementation lifecycle. This mirrors how project managers already think about their work.

| Phase                   | Sections                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Preparation             | Staff Training, Training Completion, Role Dry-Run, Credential Binder, Policy Approval    |
| Technical Setup         | Browser QA, System Integration, Data Migration, Performance Testing, Backup Verification |
| Validation & Compliance | Compliance Check, Security Audit, Documentation Review, User Acceptance Testing          |
| Go-Live                 | Cutover Runbook, Go-Live Checklist                                                       |
| Post-Launch             | Post-Launch Monitoring, Support Handoff, Disaster Recovery                               |

**Strengths:** Matches the mental model of a practice manager running an implementation project. Creates natural progress tracking. [Himcos research on healthcare workflows shows that clinical and administrative staff think in terms of sequential phases: "admission → treatment → discharge"](https://himcos.com/what-are-different-types-of-healthcare-workflows/) [^1].

**Weaknesses:** Some sections (e.g., Backup Verification) span multiple phases. Users in the middle of a phase may need to jump backward.

### Strategy B: By Functional Domain (Category-Based)

Group by the type of work being performed, independent of timing.

| Domain                | Sections                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| People & Training     | Staff Training, Training Completion, Role Dry-Run, Live-Use Rehearsal, Support Handoff     |
| Systems & Integration | Browser QA, System Integration, Data Migration, Performance Testing                        |
| Compliance & Security | Credential Binder, Policy Approval, Compliance Check, Security Audit, Documentation Review |
| Launch Operations     | Cutover Runbook, Go-Live Checklist, User Acceptance Testing, Backup Verification           |
| Live Operations       | Post-Launch Monitoring, Disaster Recovery                                                  |

**Strengths:** Stable over time. Users always know "training stuff is under People." [Curogram's healthcare workflow automation research categorizes back-office workflows by functional domain: "Employee Onboarding," "Staff Scheduling," "Compliance and Audit Trail"](https://curogram.com/blog/healthcare-workflow-automation) [^2].

**Weaknesses:** Less intuitive for users who think "what do I need to do _this week_?" Go-Live and Live Operations may feel arbitrarily separated.

### Strategy C: By Frequency of Use (Priority-Based)

Surface the 4-5 most-accessed sections by default; bury the rest in expandable groups.

| Tier                      | Sections                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily / High-Frequency    | Staff Training, Go-Live Checklist, Post-Launch Monitoring, Compliance Check                                                                                                                                 |
| Weekly / Medium-Frequency | Credential Binder, Policy Approval, Role Dry-Run, User Acceptance Testing, Support Handoff                                                                                                                  |
| As-Needed / Low-Frequency | Browser QA, Data Migration, System Integration, Security Audit, Backup Verification, Disaster Recovery, Performance Testing, Documentation Review, Cutover Runbook, Live-Use Rehearsal, Training Completion |

**Strengths:** Minimizes visual clutter. [Spaceberry Studio's navigation UX research recommends "restricting primary navigation to 3-5 core items; surface secondary actions via contextual menus"](https://spaceberry.studio/blog/navigation-ux-fixes-to-improve-app-findability/) [^3].

**Weaknesses:** Frequency varies by user and project stage. A section that is "as-needed" today may be "daily" next week. Requires analytics to get right.

### Strategy D: By Role / Responsibility (Ownership-Based)

Group by who performs the work: practice manager, staff, IT vendor, compliance officer.

| Owner            | Sections                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Practice Manager | Policy Approval, Compliance Check, Go-Live Checklist, Post-Launch Monitoring, Documentation Review                           |
| Clinical Staff   | Staff Training, Training Completion, Role Dry-Run, Live-Use Rehearsal, User Acceptance Testing                               |
| IT / Vendor      | Browser QA, System Integration, Data Migration, Performance Testing, Backup Verification, Disaster Recovery, Cutover Runbook |
| Compliance / HR  | Credential Binder, Security Audit, Support Handoff                                                                           |

**Strengths:** Aligns with how practice managers delegate work. [Healthcare workflow research from Himcos emphasizes that workflows "define how work gets done, who does it, and when it happens"](https://himcos.com/what-are-different-types-of-healthcare-workflows/) [^1].

**Weaknesses:** A single practice manager may need to access sections across multiple roles. Creates more groups (4+) and increases navigation complexity.

---

## 2. Recommended Grouping for ConciergeOS

### Primary Recommendation: Phase-Based Chunking (5 Groups)

After analyzing the 20 sections against healthcare workflow patterns, SaaS IA best practices, and the target user's cognitive profile, we recommend a **phase-based grouping with 5 groups**.

| Group | Label                     | Sections                                                                                   | Rationale                                                                                                                                                                                                                                                   |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Staff & Training**      | Staff Training, Training Completion, Role Dry-Run, Live-Use Rehearsal                      | People-first. Healthcare implementations fail when staff aren't ready. [Curogram notes that "Employee Onboarding and Credentialing" is a critical back-office workflow category](https://curogram.com/blog/healthcare-workflow-automation) [^2].            |
| **2** | **Systems & Data**        | Browser QA, System Integration, Data Migration, Performance Testing, Backup Verification   | Technical foundation. Grouping these together signals "IT work" to the practice manager, who can check status without reading details.                                                                                                                      |
| **3** | **Compliance & Security** | Credential Binder, Policy Approval, Compliance Check, Security Audit, Documentation Review | Regulatory cluster. Healthcare practice managers are acutely aware of compliance. [Himcos identifies "Compliance and Audit Trail Reporting" as a distinct administrative workflow category](https://curogram.com/blog/healthcare-workflow-automation) [^2]. |
| **4** | **Go-Live**               | User Acceptance Testing, Cutover Runbook, Go-Live Checklist                                | Launch-critical. These three are tightly coupled in time and purpose. Keeping them separate from post-launch items reduces anxiety.                                                                                                                         |
| **5** | **Post-Launch**           | Post-Launch Monitoring, Support Handoff, Disaster Recovery                                 | Ongoing operations. Separated from Go-Live to create a clean "before/after" mental boundary.                                                                                                                                                                |

### Why 5 Groups?

[George Miller's 1956 research on working memory establishes that humans can hold 7±2 items in short-term memory](https://lawsofux.com/millers-law/) [^4]. [Subsequent research by Cowan (2001) refined this to approximately 4-5 chunks for unrelated information](https://uxuiprinciples.com/en/principles/dashboard-information-density-law) [^5]. [Dashboard research shows that organizing 20 metrics into 5 logical groups achieves 40-60% better comprehension than uniform displays](https://uxuiprinciples.com/en/principles/dashboard-information-density-law) [^5]. Five groups sits comfortably within these cognitive limits.

[Stephanie Walter cautions against misapplying Miller's Law to visible menus—users don't need to _remember_ visible options—but the chunking principle remains valid for organizing complex content](https://stephaniewalter.design/blog/your-menu-doesnt-need-millers-7-plus-minus-2-rule/) [^6]. The goal is not to limit visible items to 7, but to create meaningful clusters that reduce the _perceived_ complexity of 20 sections.

### Why Phase-Based Over Domain-Based?

Card sorting research reveals that users organize information based on their _tasks_ and _context_, not abstract categories. [LogRocket's card sorting guide notes that the method "shows how users categorize information using their own terms, which minimizes jargon and provides insights into their choices"](https://blog.logrocket.com/ux-design/card-sorting-ux-research/) [^7]. For a practice manager in the middle of a go-live project, "what do I need to do this week?" is a more common question than "what domain does this belong to?" Phase-based grouping answers the temporal question directly.

[HeyMarvin's card sorting examples specifically cite "redesigning a crowded product dashboard" as a prime use case](https://heymarvin.com/resources/card-sorting-example) [^8]. [SimpleCardSort notes that card sorting "increased findability: users can locate information faster, reducing task completion time by 20-40%"](https://simplecardsort.com/) [^9].

### Group Labels

Labels must use the practice manager's vocabulary, not engineering jargon:

- "Staff & Training" not "Human Capital Onboarding"
- "Systems & Data" not "Technical Infrastructure"
- "Compliance & Security" not "GRC Framework"
- "Go-Live" not "Deployment Phase"
- "Post-Launch" not "Steady-State Operations"

[Spaceberry Studio emphasizes: "Use user-centered labels that reflect tasks and outcomes (e.g., 'View Projects' instead of 'Portal')"](https://spaceberry.studio/blog/navigation-ux-fixes-to-improve-app-findability/) [^3].

---

## 3. Navigation Structure

### Overall Layout: Collapsible Sidebar + Main Content

For 20+ sections, research consistently recommends a **sidebar over top navigation**:

> "A horizontal bar works when the number of primary sections is limited (4 to 7 tabs)... However, if sections multiply, the top bar becomes cluttered and loses its visual-hierarchy advantage." — [Edana, SaaS Navigation Guide](https://edana.ch/en/2026/04/26/saas-navigation-how-to-design-a-menu-that-accelerates-adoption-reduces-friction-and-supports-product-growth/) [^10]

> "The vertical sidebar excels for applications with complex hierarchies. It can display multiple levels grouped under collapsible headings." — [Edana](https://edana.ch/en/2026/04/26/saas-navigation-how-to-design-a-menu-that-accelerates-adoption-reduces-friction-and-supports-product-growth/) [^10]

[SaaS dashboard pattern research from 0xMinds specifies: "10+ sections → Collapsible sidebar; 3-6 sections → Top navigation; Secondary nav → Tabs (max 6)"](https://gist.github.com/majidmanzarpour/8b95e5e0e78d7eeacd3ee54606c7acc6) [^11].

### Proposed Navigation Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Top Bar: Logo | Global Search | Notifications | Profile │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                           │
│ (260px)  │  - Breadcrumbs (if deep)                     │
│          │  - Group Header + Progress Indicator         │
│          │  - Section Cards (within active group)       │
│          │                                              │
│  Groups: │                                              │
│  ▼ Staff │                                              │
│    & Trn │                                              │
│  ▶ Sys & │                                              │
│    Data  │                                              │
│  ▶ Compl │                                              │
│    & Sec │                                              │
│  ▶ Go-   │                                              │
│    Live  │                                              │
│  ▶ Post- │                                              │
│    Launch│                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar Behavior

| Behavior                   | Specification                                      | Rationale                                                                                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default state**          | Currently active group expanded; others collapsed  | Reduces visual load. [Progressive disclosure "helps keep the interface clean while providing access to additional details without navigating away from the page"](https://whatsuriwrites.medium.com/ux-design-for-aging-populations-f577d3b951be) [^12].                    |
| **Group expansion**        | Click group header → expands, reveals section list | One click to any section. [Razorpay's dashboard redesign using card sorting achieved "65% reduction in dashboard-related support tickets"](https://swayamdg.in/) [^13].                                                                                                     |
| **Active indicator**       | Terracotta left-border accent + subtle background  | High-contrast cue for older users. [NNGroup: "Interactive elements such as buttons, dropdowns, and links are often displayed at a small size that is difficult for older users to click on or tap"](https://www.nngroup.com/articles/usability-for-senior-citizens/) [^14]. |
| **Icons**                  | Every group and section has an icon + text label   | [ACM research on older adults: "All icons were provided with text labels to make their meaning understandable without additional explanations"](https://dl.acm.org/doi/10.1145/3726986.3727000) [^15].                                                                      |
| **Collapse/expand toggle** | Pin icon at bottom of sidebar                      | Power users can collapse to icon-only (64px) for more content space.                                                                                                                                                                                                        |
| **Mobile**                 | Sidebar becomes full-screen drawer via hamburger   | [0xMinds: "Mobile (<1024px): No sidebar visible. Hamburger button in header. Full-screen drawer slides from left. Larger touch targets (48px min height)"](https://0xminds.com/blog/guides/ai-sidebar-drawer-prompts-guide) [^16].                                          |

### Secondary Navigation: Tabs Within a Section

If individual sections have sub-pages (e.g., "Staff Training" has modules, roster, and completion report), use **tabs** for secondary navigation:

> "Use tabs when a section contains several sub-sections that sit under the same parent category... Tabs work only for sections on the same level. If your content has multiple layers, or some items are more important than others, use a sidebar or separate pages instead." — [Forem/Lollypop Design, Ultimate Guide to Tab Design](https://forem.com/lollypopdesign/the-ultimate-guide-to-tab-design-anatomy-types-and-tips-cdk) [^17]

> "Don't force tabs into a layout when another design pattern (like an accordion, slider UI, sidebar, or progressive disclosure) would work better." — [Eleken, Tabs UX Best Practices](https://www.eleken.co/blog-posts/tabs-ux) [^18]

**Rule:** Max 4-5 tabs per section. If more sub-pages exist, use a sub-sidebar or accordion.

### Breadcrumbs

Breadcrumbs are recommended for deep navigation or when users arrive via direct links:

> "Breadcrumbs display the user's current location within your application... provides clear orientation and allows users to navigate back through the hierarchy." — [UX Planet, Navigation UX Design](https://uxplanet.org/navigation-ux-design-types-best-practices-ea808e0af1e2d) [^19]

For ConciergeOS Operations page, breadcrumbs may be lightweight since the sidebar already shows hierarchy:
`Operations / Go-Live / Go-Live Checklist`

---

## 4. Priority / Frequency Analysis

### Visibility Tiers

Not all 20 sections deserve equal visual weight. We propose a **3-tier visibility model**:

#### Tier 1: Always Visible (Expanded by Default)

These sections sit at the top of their group and are visible without scrolling or expanding.

| Section                | Group                 | Why Visible                                                              |
| ---------------------- | --------------------- | ------------------------------------------------------------------------ |
| Staff Training         | Staff & Training      | Most implementations are delayed by training gaps.                       |
| Go-Live Checklist      | Go-Live               | The single most critical artifact on launch day.                         |
| Compliance Check       | Compliance & Security | Healthcare compliance is non-negotiable; managers check this frequently. |
| Post-Launch Monitoring | Post-Launch           | Only relevant after launch, but becomes daily once active.               |

#### Tier 2: Visible Within Expanded Group

These sections appear when their parent group is expanded. They are one click away.

All remaining sections fall into this tier:

- **Staff & Training:** Training Completion, Role Dry-Run, Live-Use Rehearsal
- **Systems & Data:** Browser QA, System Integration, Data Migration, Performance Testing, Backup Verification
- **Compliance & Security:** Credential Binder, Policy Approval, Security Audit, Documentation Review
- **Go-Live:** User Acceptance Testing, Cutover Runbook
- **Post-Launch:** Support Handoff, Disaster Recovery

#### Tier 3: Collapsed / Summary-Only by Default

Sections that are either complete, not yet started, or rarely accessed can be collapsed into a "More" or "Completed" area within each group.

**Dynamic rule:** If a section's status is "Complete," collapse it by default. If "Not Started" and the project phase hasn't reached it yet, collapse it. This creates an adaptive UI that changes as the implementation progresses.

[Progressive disclosure research from the due-diligence-agents project uses a 4-layer model: "Layer 1: The Decision (visible on load, no scrolling required) → Layer 2: What To Do About It (click to expand) → Layer 3: Domain Details → Layer 4: Full Evidence"](https://github.com/zoharbabin/due-diligence-agents/blob/main/docs/user-guide/reading-report.md) [^20]. We adapt this to a 3-layer model for ConciergeOS.

### Group-Level Default Expansion

The currently active group (based on project phase) should be expanded; others collapsed.

| Project Phase         | Expanded Group        |
| --------------------- | --------------------- |
| Weeks 1-4 (Prep)      | Staff & Training      |
| Weeks 5-8 (Build)     | Systems & Data        |
| Weeks 9-10 (Validate) | Compliance & Security |
| Week 11 (Launch)      | Go-Live               |
| Week 12+ (Live)       | Post-Launch           |

This creates a **phase-aware navigation** that surfaces relevant sections automatically.

---

## 5. Search & Findability

### Global Search Bar

A persistent global search bar in the top header is essential for 20+ sections:

> "In content-rich, data-heavy, or command-driven environments, expert users rely on a search bar rather than navigating menus... The drawback appears when novice users don't know the right search terms or are unaware of what they can search for." — [Edana, SaaS Navigation Guide](https://edana.ch/en/2026/04/26/saas-navigation-how-to-design-a-menu-that-accelerates-adoption-reduces-friction-and-supports-product-growth/) [^10]

For ConciergeOS's non-technical user, search must be forgiving:

| Feature              | Implementation                                                         | Rationale                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fuzzy matching**   | "staff train" matches "Staff Training"                                 | Users may not remember exact labels.                                                                                                                                |
| **Keyword synonyms** | "UAT" → "User Acceptance Testing"; "credentials" → "Credential Binder" | Healthcare staff use abbreviations.                                                                                                                                 |
| **Recent searches**  | Show last 5 searches in dropdown                                       | Reduces re-typing. [Older users benefit from "recognition over recall"](https://uxdesign.cc/millers-law-is-there-a-magical-number-in-ux-design-7999f92ef7b8) [^21]. |
| **Scoped search**    | "Search Operations..." placeholder                                     | Sets expectation that search is limited to this page/module.                                                                                                        |
| **Results grouping** | Search results grouped by category (e.g., "Found in Staff & Training") | Maintains IA mental model even in search.                                                                                                                           |

### Section-Level Filtering

Within the Operations page, add a filter bar:

- **Status filter:** Not Started / In Progress / Complete / Blocked
- **Owner filter:** Me / Staff / IT Vendor / Compliance Officer
- **Phase filter:** All / Prep / Build / Validate / Launch / Live

[Asana's operations management research emphasizes that "work intake" and "standardized work requests" help teams "seamlessly prioritize and complete tasks"](https://asana.com/teams/operations) [^22]. Filtering by status and owner creates this standardization.

### Favorites / Pinning

Allow users to pin 3-5 sections to a "Quick Access" area at the top of the sidebar. This is especially valuable for power users who cross phase boundaries frequently.

[Salesforce's dashboard UX is cited for "consistent sidebar navigation and collapsible sections to streamline the user experience"](https://covio.agency/saas-dashboard-ux-audit-best-practices/) [^23]. Adding a pinned/favorites section is a common enhancement in such systems.

### Findability Testing Recommendation

Before finalizing the IA, run a **closed card sort** with 5-8 practice managers:

> "Closed card sorting asks participants to sort items into predefined categories. Ideal for validating an existing structure or testing category labels." — [SimpleCardSort](https://simplecardsort.com/) [^9]

> "15 participants typically reveal most patterns, while 30+ provides stronger statistical confidence." — [SimpleCardSort](https://simplecardsort.com/) [^9]

Follow up with **tree testing** to validate that users can find specific sections within the proposed hierarchy:

> "Tree testing to validate IA and findability without the visual design layer." — [Spaceberry Studio](https://spaceberry.studio/blog/navigation-ux-fixes-to-improve-app-findability/) [^3]

---

## 6. Accessibility & Aging-Population Considerations

The target user (mid-50s, non-technical) has specific needs that must inform the IA and navigation design:

### Visual Design

| Guideline                      | Source                                                                                                                  | Application                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Minimum 16px font size         | [Medium/UX for Aging Populations](https://whatsuriwrites.medium.com/ux-design-for-aging-populations-f577d3b951be) [^12] | All sidebar labels and section headers.                                                                       |
| High contrast (4.5:1 minimum)  | [WCAG 2.1 AA via Accessible.org](https://accessible.org/wcag-21-aa-saas-platforms-required/) [^24]                      | Terracotta (#c96442) on parchment (#f5f4ed) must be tested. Dark text on light background preferred for body. |
| Large touch targets (48px min) | [0xMinds mobile sidebar guide](https://0xminds.com/blog/guides/ai-sidebar-drawer-prompts-guide) [^16]                   | All sidebar items, especially on tablet (ConciergeOS has an iPad app).                                        |
| Text labels for all icons      | [ACM research on older adults](https://dl.acm.org/doi/10.1145/3726986.3727000) [^15]                                    | Never icon-only navigation for primary items.                                                                 |

### Cognitive Design

| Guideline              | Source                                                                                                                                                                                                                                  | Application                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Avoid hidden gestures  | [Spaceberry Studio](https://spaceberry.studio/blog/navigation-ux-fixes-to-improve-app-findability/) [^3]                                                                                                                                | All navigation must be visible or clearly labeled. No swipe-to-reveal.    |
| Consistent terminology | [Hong Kong Elderly-Friendly Design Guide](https://www.digitalpolicy.gov.hk/en/our_work/digital_government/digital_inclusion/accessibility/promoting_resources/application_design_guide/doc/elderly_friendly_design_guide_eng.pdf) [^25] | Same label always leads to same place.                                    |
| Simple, clear language | [ACM research](https://dl.acm.org/doi/10.1145/3726986.3727000) [^15]                                                                                                                                                                    | Avoid jargon. "Go-Live" is better than "Deployment."                      |
| Progressive disclosure | [Medium/UX for Aging](https://whatsuriwrites.medium.com/ux-design-for-aging-populations-f577d3b951be) [^12]                                                                                                                             | Accordions and collapsible groups prevent overwhelm.                      |
| Step-by-step guidance  | [Medium/UX for Aging](https://whatsuriwrites.medium.com/ux-design-for-aging-populations-f577d3b951be) [^12]                                                                                                                             | Complex sections (e.g., Cutover Runbook) should have inline instructions. |

### Interaction Design

[NNGroup's senior citizen usability research found that "small type caused problems and drew complaints even among teenage users. The design choices that irritate younger users create substantial barriers to access for older ones"](https://www.nngroup.com/articles/usability-for-senior-citizens/) [^14].

[Research from the University of Minho on elderly healthcare solutions recommends: "Designing websites with a clear and organized hierarchy instead of non-structured websites. In fact, navigation greatly affect the user performance of seniors"](https://repositorium.sdum.uminho.pt/bitstream/1822/76117/1/Marisa%20Araujo%20Esteves.pdf) [^26].

---

## 7. Implementation Recommendations

### Phase 1: Immediate (Week 1)

1. **Restructure the single page** into 5 collapsible groups using the phase-based grouping above.
2. **Add a sticky sidebar** (260px expanded, 64px collapsed) with group headers and section links.
3. **Implement progressive disclosure:** Only the active group expanded by default; all others collapsed.
4. **Add a global search bar** in the top header with fuzzy matching.

### Phase 2: Short-Term (Weeks 2-4)

1. **Add status indicators** to each section (Not Started / In Progress / Complete / Blocked).
2. **Implement phase-aware default expansion** based on project timeline.
3. **Add filtering** by status and owner.
4. **Conduct closed card sorting** with 5-8 target users to validate group labels.

### Phase 3: Medium-Term (Months 2-3)

1. **Add favorites/pinning** to sidebar.
2. **Implement breadcrumbs** for deep-linked access.
3. **Add keyboard navigation** support (arrow keys to move between groups, Enter to expand).
4. **Run tree testing** to validate findability (< 3 seconds target).

### Success Metrics

| Metric                          | Target                          | Measurement                           |
| ------------------------------- | ------------------------------- | ------------------------------------- |
| Time to find section            | < 3 seconds                     | Task-based usability test             |
| First-try success rate          | > 85%                           | Tree test or moderated usability test |
| Support tickets ("Where is X?") | -50%                            | Support ticket categorization         |
| Card sort consensus             | > 70% agreement on 80% of cards | Closed card sort analysis             |

---

## 8. Sources & References

[^1]: Himcos. "What Are Healthcare Workflows? 3 Major Types Of Healthcare Workflows." March 2025. https://himcos.com/what-are-different-types-of-healthcare-workflows/

[^2]: Curogram. "35 Game-Changing Examples of Healthcare Workflow Automation." June 2025. https://curogram.com/blog/healthcare-workflow-automation

[^3]: Spaceberry Studio. "Navigation UX fixes to Improve App Findability." February 2026. https://spaceberry.studio/blog/navigation-ux-fixes-to-improve-app-findability/

[^4]: Laws of UX. "Miller's Law." https://lawsofux.com/millers-law/

[^5]: UX UI Principles. "Dashboard Information Density Law." October 2025. https://uxuiprinciples.com/en/principles/dashboard-information-density-law

[^6]: Walter, Stephanie. "Your menu doesn't need Miller's 7±2 rule." March 2026. https://stephaniewalter.design/blog/your-menu-doesnt-need-millers-7-plus-minus-2-rule/

[^7]: LogRocket. "Open vs. closed vs. hybrid card sorting for UX research." February 2025. https://blog.logrocket.com/ux-design/card-sorting-ux-research/

[^8]: HeyMarvin. "5 Card Sorting Examples for Smarter UX Design." https://heymarvin.com/resources/card-sorting-example

[^9]: SimpleCardSort. "Card Sorting for UX Research and Information Architecture." https://simplecardsort.com/

[^10]: Edana. "SaaS Navigation: How to Design a Menu That Accelerates Adoption, Reduces Friction, and Supports Product Growth." April 2026. https://edana.ch/en/2026/04/26/saas-navigation-how-to-design-a-menu-that-accelerates-adoption-reduces-friction-and-supports-product-growth/

[^11]: Manzarpour, Majid. "elite-frontend-ux skill for Claude Code." January 2026. https://gist.github.com/majidmanzarpour/8b95e5e0e78d7eeacd3ee54606c7acc6

[^12]: Liu, Shuyi. "UX Design for Aging Populations." Medium, May 2024. https://whatsuriwrites.medium.com/ux-design-for-aging-populations-f577d3b951be

[^13]: DG, Swayam. "How a Systemic UX Redesign Cut Support Costs by 65%." https://swayamdg.in/

[^14]: Nielsen Norman Group. "Usability for Older Adults: Challenges and Changes." September 2019. https://www.nngroup.com/articles/usability-for-senior-citizens/

[^15]: Esteves, Marisa Araujo et al. "Design for Older People: Improving the Usability of Mobile Apps through Targeted Design Recommendations." ACM OzCHI 2024. https://dl.acm.org/doi/10.1145/3726986.3727000

[^16]: 0xMinds. "AI Sidebar Prompts: 30+ Templates That Work." June 2026. https://0xminds.com/blog/guides/ai-sidebar-drawer-prompts-guide

[^17]: Forem / Lollypop Design. "The Ultimate Guide to Tab Design: Anatomy, Types, and Tips." December 2025. https://forem.com/lollypopdesign/the-ultimate-guide-to-tab-design-anatomy-types-and-tips-cdk

[^18]: Eleken. "Tabs UX Best Practices: Examples and Common Mistakes." https://www.eleken.co/blog-posts/tabs-ux

[^19]: UX Planet. "Navigation UX Design: Types & Best Practices." August 2024. https://uxplanet.org/navigation-ux-design-types-best-practices-ea808e0af1e2d

[^20]: Babin, Zohar. "due-diligence-agents/docs/user-guide/reading-report.md." GitHub, February 2026. https://github.com/zoharbabin/due-diligence-agents/blob/main/docs/user-guide/reading-report.md

[^21]: Indraksh, Aryan. "Miller's Law: Is there a magical number in UX design?" UX Collective, April 2020. https://uxdesign.cc/millers-law-is-there-a-magical-number-in-ux-design-7999f92ef7b8

[^22]: Asana. "Operations Management Software | Streamline Success." https://asana.com/teams/operations

[^23]: Covio Agency. "SaaS Dashboard UX Audit Best Practices for Optimal User Engagement." November 2025. https://covio.agency/saas-dashboard-ux-audit-best-practices/

[^24]: Accessible.org. "What WCAG 2.1 AA Actually Requires for SaaS Platforms." March 2026. https://accessible.org/wcag-21-aa-saas-platforms-required/

[^25]: Hong Kong Digital Policy Office. "Elderly-friendly Website/Mobile Application Design Guide." https://www.digitalpolicy.gov.hk/en/our_work/digital_government/digital_inclusion/accessibility/promoting_resources/application_design_guide/doc/elderly_friendly_design_guide_eng.pdf

[^26]: Esteves, Marisa Araujo. "Web-based Healthcare Solutions for the Elderly." University of Minho. https://repositorium.sdum.uminho.pt/bitstream/1822/76117/1/Marisa%20Araujo%20Esteves.pdf

---

## Appendix: Raw Section-to-Group Mapping

| #   | Section                 | Recommended Group     | Alternative Group (Domain-Based) |
| --- | ----------------------- | --------------------- | -------------------------------- |
| 1   | Live-Use Rehearsal      | Staff & Training      | People & Training                |
| 2   | Credential Binder       | Compliance & Security | Compliance & Security            |
| 3   | Browser QA              | Systems & Data        | Systems & Integration            |
| 4   | Staff Training          | Staff & Training      | People & Training                |
| 5   | Policy Approval         | Compliance & Security | Compliance & Security            |
| 6   | Role Dry-Run            | Staff & Training      | People & Training                |
| 7   | Cutover Runbook         | Go-Live               | Launch Operations                |
| 8   | Data Migration          | Systems & Data        | Systems & Integration            |
| 9   | System Integration      | Systems & Data        | Systems & Integration            |
| 10  | Compliance Check        | Compliance & Security | Compliance & Security            |
| 11  | Security Audit          | Compliance & Security | Compliance & Security            |
| 12  | Backup Verification     | Systems & Data        | Launch Operations                |
| 13  | Disaster Recovery       | Post-Launch           | Live Operations                  |
| 14  | Performance Testing     | Systems & Data        | Systems & Integration            |
| 15  | User Acceptance Testing | Go-Live               | Launch Operations                |
| 16  | Go-Live Checklist       | Go-Live               | Launch Operations                |
| 17  | Post-Launch Monitoring  | Post-Launch           | Live Operations                  |
| 18  | Support Handoff         | Post-Launch           | People & Training                |
| 19  | Documentation Review    | Compliance & Security | Compliance & Security            |
| 20  | Training Completion     | Staff & Training      | People & Training                |
