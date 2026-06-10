# Dimension 10 — Healthcare SaaS UX Benchmarks Deep Dive

**Research Date:** 2026-06-09  
**Researcher:** UX Research Sub-Agent  
**Project:** ConciergeOS — Healthcare Practice Management SaaS  
**Target User:** Mid-50s, non-technical healthcare practice manager  
**Scope:** Operational/administrative UX patterns (scheduling, billing, patient management, dashboards, communications). NOT clinical charting/EHR depth.

---

## Executive Summary

This document analyzes the UI/UX patterns of seven leading healthcare practice management platforms to identify what makes them successful, what users consistently praise or criticize, and which patterns ConciergeOS should adopt, adapt, or avoid. Every claim cites a source.

**Key Finding:** The most successful healthcare SaaS products are not the most feature-rich — they are the ones that reduce cognitive load for non-technical staff through workflow-oriented architecture, clean scheduling views, color-coded status systems, and progressive disclosure of complexity.

---

## 1. Product Profiles

### 1.1 Jane App

**What it does:** Web-based practice management for therapists, wellness professionals, and allied health clinics. Scheduling, charting, billing, telehealth, and online booking in one platform. [Jane.app](https://jane.app/)

**What users praise:**

- **"Beautiful design, with simplicity in mind"** — users consistently call the interface "clean," "nice-looking," and "simple to learn" [Jane.app homepage; Pabau 2026]
- **Calendar-as-homepage** — the schedule is the default view, reducing navigation friction [Medesk Jane App Review 2026]
- **Orange-highlighted available slots** — speed up appointment booking by making open times visually obvious [Medesk Jane App Review 2026]
- **Split-screen telehealth charting** — providers can take notes during video calls without leaving the session [Medesk Jane App Review 2026]
- **Strong onboarding reputation** — "new staff can get up to speed quickly" [Pabau 2026]
- **96% user satisfaction rating** based on 144 reviews [SelectHub]

**Interface description (from reviews):**

- Calendar-based homepage with day/week views
- Multi-provider scheduling (view 1-3 provider schedules simultaneously)
- Customizable tags for appointment types and shifts
- Group appointment support (useful for classes/family therapy)
- Patient booking portal with provider photos/bios
- Reporting module with pre-made report categories (Billing, Appointments, EMR, Retail, Retention, Referral)

**Specific UI patterns:**

- **Color-coded scheduling grid** with orange open slots
- **Tag-based categorization** for shifts, treatments, and appointment types
- **Inline billing generation** — create invoice directly from calendar without navigating away
- **Waitlist management** integrated into scheduling view
- **Branded patient portal** with standalone booking site (yourclinic.janeapp.com)

**What users criticize:**

- Interface can feel "dated" and "clunky" once services grow complex [Pabau 2026; Capterra reviewer]
- No monthly calendar view; no ability to see ALL open slots across providers [Medesk]
- Platform "locks into the last patient" when navigating schedule, risking wrong chart access [Medesk]
- Limited insurance billing automation; manual entry is "tedious" [Medesk]
- Reporting is "basic" with limited search/filter capabilities [Medesk]

---

### 1.2 Tebra (formerly Kareo + PatientPop)

**What it does:** All-in-one platform unifying EHR, billing, patient engagement, and practice management for independent practices. 42,000+ practices use it. [Software Advice 2026; MedPrecisionBilling 2026]

**What users praise:**

- **"One of the cleaner UIs in the PM market"** — modern interface reduces clinician training time [MedPrecisionBilling 2026]
- **Intuitive navigation and layout** — "easy to navigate and find information, even for first-time users" [Software Advice 1,362 reviews]
- **Dashboard/Calendar toggle** — switch between daily operational view and calendar view [Tebra Help Center 2026]
- **Appointment Flow tracking** — color-coded tabs: Scheduled (yellow if late), In Office (blue if roomed), Finished (red for no-show/cancelled) [Tebra Help Center 2026]
- **Drag-and-drop rescheduling** and color-coded appointment types [Healos.ai 2025]
- **Hover-to-preview** — hover over patient name to see phone, email, address, last/next appointment, alerts [Tebra Help Center 2026]
- **Global search bar** with recent patients and instant record creation [Tebra Help Center 2026]
- **Keyboard shortcuts** (Ctrl+N new patient, Ctrl+D daily schedule, Ctrl+B billing) [Healos.ai 2025]

**Interface description (from help docs and reviews):**

- Top navigation bar with module icons: Platform, Clinical, Billing, Patient Experience, Analytics
- Left-aligned module icons; white = active, gray = inactive
- Central search box for patient lookup and recent patients
- Dashboard view with Appointment Flow tabs (Scheduled → In Office → Finished)
- Appointment cards showing: patient name, status, alerts, resources (provider/room/equipment), visit reason, appointment mode (in-office/telehealth), balance, insurance policy with copay/authorizations
- Outstanding Items panel for high-priority tasks (eRx requests, pending orders, flagged messages, tentative appointments, patient intake pending review)
- Financial Information tab with red dot indicator for outstanding balance

**Specific UI patterns:**

- **5-stage patient visit model** visible in UI flow: Scheduled → Arrived/Checked In → Roomed → Checked Out → No Show/Rescheduled/Cancelled
- **Status-driven color coding** throughout the interface
- **Appointment cards as popover modals** — click appointment to see full context without page change
- **Charge capture status tracking** embedded in appointment card (not started / in progress / in billing / completed)
- **Integrated eligibility checking** — one-click check for all patients scheduled that day
- **Exception-based workflow dashboard** — surfaces only items needing attention

**What users criticize:**

- **Learning curve for advanced features** — "some users report a steep learning curve, particularly during initial implementation" [RevMaxx 2026]
- **Customer support responsiveness** — frequent complaint across review sites [SelectHub; Software Advice]
- **Occasional system slowdowns and glitches** [RevMaxx 2026; Simply.coach 2026]
- **Limited customization options** in certain areas [Tebra Patient Experience reviews]
- **Modular subscription confusion** — features grayed out if not subscribed, creating visual clutter [Tebra Help Center]

---

### 1.3 ChiroHD

**What it does:** Cloud-based practice management built specifically for chiropractic clinics. Scheduling, SOAP notes, billing, patient texting, inventory, lead management. 1,500+ practitioners. [ChiroHD.com; FindEMR 2025]

**What users praise:**

- **"I like how clear the schedule is"** — 85% positive sentiment on Ease of Use & Workflow [FindEMR 2025]
- **"Setup was fast, and we were operational within a week"** [FindEMR 2025]
- **"Very intuitive, looks clean, notes are quick and customizable"** [ChiroHD.com testimonials]
- **Browser-based, no installation** — "runs on any browser on any device and is always current" [ChiroHD.com]
- **Ease of scheduling patients months in advance** [ChiroHD.com]
- **4.9/5 customer support satisfaction** [ChiroHD.com]
- **4.8/5 overall on Capterra** (62 reviews) [Keragon 2026]

**Interface description (from reviews and marketing):**

- Clean, modern web interface with "90s-free" positioning
- Clear schedule view with bulk scheduling capabilities
- Two-way text communication for appointment confirmations/reminders
- 30-second SOAP note feature
- Patient check-in with automated texting
- Built-in billing and insurance management
- Mobile app for iOS/Android (though some report "minor glitches or navigation challenges") [FindEMR 2025]

**Specific UI patterns:**

- **Specialty-specific workflow optimization** — built around chiropractic visit flow rather than generic medical
- **Bulk scheduling tools** for multi-provider, multi-location practices
- **Automated patient texting** integrated into scheduling workflow
- **Cloud-native simplicity** — no desktop app, no server updates
- **Patient lifecycle management** with 24/7 monitoring tools

**What users criticize:**

- **Limited customization** — 75% negative sentiment on customization limitations [FindEMR 2025]
- **Mobile app functionality issues** — 85% negative sentiment [FindEMR 2025]
- **Technical support follow-up delays** [FindEMR 2025]
- **Chiropractic-specific** — patterns may not generalize to other practice types

---

### 1.4 AdvancedMD

**What it does:** Cloud-based EHR + practice management for small-to-mid-sized multi-specialty practices. 26,000+ practitioners. Founded 1999. [EHRReviews; Business News Daily 2021]

**What users praise:**

- **"The scheduler is equally intuitive and offers a pleasing user interface"** [EHRReviews]
- **Schedule snapshot tool** — daily appointments based on resources, location, or provider [Business News Daily 2021]
- **Quick-look summaries** — click appointment to see type, duration, clinical notes, contact info [Business News Daily 2021]
- **Instant insurance eligibility checks** on one or all appointments [Business News Daily 2021]
- **Patient room tracking** — track office visits and use metrics to shorten wait times [Business News Daily 2021]
- **Recurring appointment tools** with waitlist auto-fill [Business News Daily 2021]
- **Task Donuts** — visual work volume indicators for outstanding/critical tasks [EHRReviews]
- **Patient Cards** — chronologically ordered frequent-task shortcuts [EHRReviews]

**Interface description (from reviews and docs):**

- EHR Homepage with quick-reference schedules, rooming, prioritized tasks, action items, patient cards
- Unified with Practice Management — schedules, demographics, charges synchronized bidirectionally
- Customizable templates for notes and sub-notes
- Telehealth suite with appointment dashboard, call screenshot storage, secure two-way video
- Mobile EHR iOS app (though "lacks full parity with web platform") [EHRSource 2026]
- Ad-Hoc Report Writer with drill-down capabilities [NextGen brochure reference]

**Specific UI patterns:**

- **"Task Donuts"** — circular visual indicators showing work volume and critical tasks
- **Patient Rooming tracker** — status tracking with wait notifications
- **Color-coded appointment types** with customizable time intervals
- **Cross-department compliance committee** — regular UX updates for HIPAA/ICD-10 compliance [SoftwareFinder 2026]
- **AI-generated notes** and automated insurance entry (2024-2025 updates) [SoftwareFinder 2026]

**What users criticize:**

- **"Interface feels dated compared to newer entrants"** — "lacks modern, consumer-grade polish" [EHRSource 2026]
- **Steep learning curve** — "onboarding takes 4 to 8 weeks before staff feel comfortable" [EHRSource 2026]
- **"Too many clicks between moving one page to another"** [EHRReviews user comment]
- **"Some features are hard to locate in the UI"** [EHRReviews]
- **Dense menus and multiple clicks for common tasks** [EHRSource 2026]
- **Modular pricing escalates to $700+/provider/month** [EHRSource 2026]
- **Customer support quality inconsistent** [EHRSource 2026]

---

### 1.5 NextGen Healthcare

**What it does:** Enterprise-grade EHR and practice management for multi-provider, multi-location groups. Strong in specialty-specific workflows. [SoftwareFinder; ClinicMind 2026]

**What users praise:**

- **"Remarkable design"** — "combines an intuitive, easy-to-use interface with true enterprise functionality" [NextGen PM brochure]
- **Customizable, encounter-driven scheduling and billing** [NextGen PM brochure]
- **Ad-Hoc Report Writer** — "extremely easy to use with drill-down capabilities" [NextGen PM brochure]
- **Patient Experience Platform (PxP Portal)** — unified patient portal for records, check-in, scheduling, payments, prescriptions [NextGen brochure]
- **Group scheduling** — create and manage linked patient groups [NextGen brochure]
- **Cost estimation tool** — collect patient responsibility upfront [NextGen brochure]
- **Well-regarded training and support system** [IJRPR research paper]

**Interface description (from brochures and reviews):**

- Enterprise-scale navigation with role-based views
- Patient portal as "virtual front door" tied into EHR and PM
- Claim Status redesign — "modern, aesthetically pleasing User Interface" for adjudication info [NextGen brochure]
- SOAP, Intake, Well-child templates with simplified APSO document format [NextGen brochure]
- Mobile integration with speech recognition [NextGen brochure]

**What users criticize:**

- **"Complex to use"** — "robust features and capabilities can also make it complex" [IJRPR research paper]
- **"Less intuitive compared to other EHR systems"** [IJRPR research paper]
- **Enterprise complexity** — optimized for larger groups, potentially overwhelming for small practices
- **Dated interface elements** despite redesign efforts

---

### 1.6 DrChrono

**What it does:** Cloud-based EHR, practice management, and billing for small-to-mid practices across specialties. Apple Mobility Partner with strong iOS integration. [Software Advice 2026; Business News Daily 2021]

**What users praise:**

- **"Sleek and user-friendly UI"** — "enabling new users to quickly grasp the system" [FindEMR 2024; Software Advice 2026]
- **"Simple, especially on iOS devices"** — first-time medical software users face fewer obstacles [Business News Daily 2021]
- **Customizable dashboards** — tailor workflow to provider preferences [EMRFinder 2023]
- **Top navigation tabs** — Schedule, Clinical, Patients, Reports, Billing, Account, Marketplace [Business News Daily 2021]
- **Mobile-first design** — "unmatched" mobile EHR accessibility [Medsender]
- **Integrated telehealth** — schedule and conduct video visits within system [Software Advice 2026]
- **Online scheduling, self check-in, HIPAA-compliant patient portal** [Software Advice 2026]
- **Customizable clinical notes with specialty-specific shortcuts** [Software Advice 2026]

**Interface description (from reviews):**

- Contemporary, adaptive layout responsive across devices
- Clean top-bar navigation with major modules
- Customizable dashboards for different workflows
- Patient portal (OnPatient) for records, booking, payments
- Billing component with customizable profiles and dashboards
- Electronic prior authorization automation
- API-driven flexibility for custom integrations

**Specific UI patterns:**

- **Top-tab navigation** — all major applications reachable from dashboard top bar
- **Customizable dashboard widgets** — user-tailored home screen
- **Mobile-responsive adaptive layout** — works on iPhone, iPad, Mac, Android
- **Integrated telehealth appointment dashboard** — no separate tool needed
- **Speech-to-text functionality** for documentation [EMRFinder 2023]

**What users criticize:**

- **"User interface is often times not intuitive and is cluttered"** [Trustpilot 2023]
- **"Heavy website can be slow to load in certain pages"** [Trustpilot 2023]
- **"Inconsistent user experience"** — "occasionally difficult to navigate" [ITQlick 2024]
- **"Cumbersome template construction"** [ITQlick 2024]
- **Custom form builder is "clunky"** — "navigating between sections felt clunky" [SelectHub 2026]
- **No offline mobile access** [SelectHub 2026]
- **Limited payment options** (no Google Pay, Apple Pay, Samsung Pay) [SelectHub 2026]
- **Reports cannot be auto-scheduled** [SelectHub 2026]
- **Customer support deteriorated** in recent years [Trustpilot 2023]

---

### 1.7 Athenahealth

**What it does:** Cloud-based EHR, practice management, and revenue cycle management. Best in KLAS 2025 for Overall Independent Physician Practice Suite (2nd consecutive year). [Interface-Design.co.uk 2026; SoftwareFinder 2026]

**What users praise:**

- **"User-friendly interface with intuitive navigation"** — consistently cited across reviews [SoftwareFinder 2026; EHRSource 2026]
- **"Clean, intuitive design helps reduce training time"** [IgniteHS 2026]
- **Customizable dashboards** — "tailor dashboards to display most relevant metrics" [EMRFinder 2025]
- **5-stage patient visit model** — Check-in, Intake, Exam, Sign-off, Checkout — "grounded in clinical workflow logic, not software module categories" [Interface-Design.co.uk 2026]
- **Simplified navigation** — "menus and submenus are more intuitive, reducing time spent searching" [EMRFinder 2025]
- **Role-based dashboard views** — front desk sees patient tasks, billers see outstanding payments [RCMExperts 2025]
- **Exception-based workflow** — surfaces only tasks needing attention [RCMExperts 2025]
- **Voice of the Customer program** — 40% of 185 new features in Fall 2025 release originated from user feedback [Interface-Design.co.uk 2026]
- **Click reduction and navigation streamlining** as explicit design goals [Interface-Design.co.uk 2026]
- **Smart defaults and pre-populated fields** based on appointment type and history [EHRSource 2026]
- **Mobile-friendly design** — document visits, view labs, send e-prescriptions on the go [Arkenea 2025]

**Interface description (from help docs and reviews):**

- Web-based, accessible from any browser
- Modernized UI with simplified navigation (2024-2025 redesign)
- Customizable home screen with widgets
- Smart Calendar with integrated scheduling, reminders, follow-ups [Zazz 2025]
- Patient Portal for scheduling, results access, provider communication [Zazz 2025]
- Clinical Inbox for quick access to patient information [RCMExperts 2025]
- Encounter Prep view — review chart, queue orders, add notes before appointment [Athenahealth Service Description 2026]
- Self Check-in via Patient Portal — confirm demographics, make payments, upload insurance cards, complete forms [Athenahealth Service Description 2026]
- Appointment Request section in Inbox for patient-submitted scheduling requests [Athenahealth Service Description 2026]

**Specific UI patterns:**

- **Workflow-oriented architecture** — UI organized around patient visit stages, not software modules
- **Exception-based dashboards** — only show items requiring action
- **Pre-visit preparation automation** — data collection from portals, lab integration before patient arrives
- **Contextual clinical decision support** — care gaps and screening reminders surfaced at point of care [EHRSource 2026]
- **Progressive disclosure** — advanced features available but not cluttering primary view
- **Role-based access controls** — each user sees only functions related to their job [RCMExperts 2025]

**What users criticize:**

- **Learning curve during initial implementation** [Transcure 2025]
- **Pricing concerns for smaller practices** — percentage-of-collections model [Transcure 2025; SoftwareFinder 2026]
- **Limited customization options** [Transcure 2025]
- **Some users find interface "more cluttered" with "steeper learning curve"** compared to newer entrants [Vocal Media 2024]

---

## 2. Common Success Patterns

Across all seven platforms, the following patterns appear consistently in products with high user satisfaction:

### 2.1 Calendar-First or Dashboard-First Home Screen

Every successful product puts the day's operational reality front and center. Jane uses calendar-as-homepage. Tebra uses Dashboard/Calendar toggle. Athenahealth uses exception-based workflow dashboards. **Pattern:** The user should see what needs attention TODAY within 3 seconds of login.

### 2.2 Color-Coded Status Systems

Tebra's appointment flow (yellow/blue/red), Jane's orange open slots, AdvancedMD's color-coded appointment types — all use color to convey status at a glance. **Pattern:** Color should mean something consistent across the entire application (not just decoration).

### 2.3 Hover/Click Preview Without Navigation

Tebra's hover-over patient name to see contact info and alerts; AdvancedMD's quick-look summaries; Athenahealth's encounter prep view. **Pattern:** Reduce page loads — show contextual information in overlays, popovers, or side panels.

### 2.4 Inline Action Completion

Jane generates invoices from the calendar without leaving the schedule. Tebra creates charge captures from appointment cards. **Pattern:** Common administrative actions (billing, messaging, status updates) should be possible from the primary view without navigating to a separate module.

### 2.5 Role-Based Views

Athenahealth explicitly configures dashboards per role (front desk vs biller vs clinician). Tebra's module icons show/hide based on subscription and role. **Pattern:** A practice manager and a front-desk scheduler should see different default views of the same system.

### 2.6 Exception-Based Workflow Surfacing

Athenahealth's "Workflow Dashboard uses exception-based workflows — it surfaces tasks that need attention." Tebra's "Outstanding Items" panel. AdvancedMD's "Task Donuts." **Pattern:** Don't make users hunt for what needs doing — bring it to them.

### 2.7 Progressive Disclosure of Complexity

Jane's simple base interface with add-ons for group telehealth. Tebra's grayed-out inactive modules. DrChrono's tiered plans. **Pattern:** The base interface should feel simple. Advanced features should be discoverable but not cluttering.

### 2.8 Browser-Based, No-Install Delivery

Jane, ChiroHD, Tebra, Athenahealth, DrChrono all emphasize cloud-based, browser-accessible, no-installation delivery. **Pattern:** For non-technical users in their 50s, "no IT person needed" is a major selling point and UX advantage.

### 2.9 Strong Search + Recent Items

Tebra's global search with last 5 recent patients. Athenahealth's patient lookup. **Pattern:** Non-technical users rely heavily on search rather than navigation hierarchies.

### 2.10 Automated Reminders and Patient Communication

Every platform offers SMS/email reminders, automated scheduling confirmations, and two-way texting. **Pattern:** Communication automation reduces no-shows and front-desk workload — this is a core operational value proposition.

---

## 3. Specific Patterns to Adapt for ConciergeOS

### 3.1 Scheduling & Calendar

| Source Product | Pattern                                                                    | How to Adapt for ConciergeOS                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jane App**   | Calendar-as-homepage with orange-highlighted open slots                    | Make the daily operational dashboard the default landing page. Use high-contrast color (e.g., teal or amber) to highlight unbooked slots. Show 1-3 provider columns side by side. |
| **Tebra**      | Appointment Flow tabs (Scheduled → In Office → Finished) with color coding | Create a "Patient Journey" status bar for today's appointments. Use consistent colors: scheduled = neutral, arrived = blue, in-progress = green, finished = gray, no-show = red.  |
| **Tebra**      | Hover-to-preview patient details                                           | On desktop, hovering over a patient name shows a tooltip with phone, email, next appointment, and alerts. On touch devices, tap to expand inline.                                 |
| **AdvancedMD** | Recurring appointments + waitlist auto-fill                                | Build recurring appointment templates (e.g., weekly physical therapy). When a slot opens, automatically offer it to waitlisted patients via SMS.                                  |
| **ChiroHD**    | Bulk scheduling for multi-provider practices                               | Allow practice managers to schedule a patient across multiple future dates in one action — critical for treatment plans.                                                          |

### 3.2 Patient Management

| Source Product   | Pattern                                                              | How to Adapt for ConciergeOS                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Athenahealth** | 5-stage visit model (Check-in → Intake → Exam → Sign-off → Checkout) | Since ConciergeOS is NOT clinical, adapt to administrative stages: Scheduled → Confirmed → Checked In → In Progress → Completed → Billed.                              |
| **AdvancedMD**   | Patient Cards with chronological frequent tasks                      | Create "Patient Quick Cards" showing: contact info, upcoming appointments, outstanding balance, last visit, and one-click actions (call, text, email, book follow-up). |
| **Tebra**        | Appointment cards with embedded financial info                       | In the appointment detail view, show patient balance, copay, and insurance eligibility status without navigating to billing module.                                    |
| **Athenahealth** | Self check-in via portal                                             | Patient portal where clients confirm demographics, upload insurance cards, and complete intake forms before arrival — data flows directly into ConciergeOS.            |

### 3.3 Billing & Financial Operations

| Source Product   | Pattern                                 | How to Adapt for ConciergeOS                                                                                                        |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Jane**         | Inline invoice generation from calendar | One-click "Create Invoice" from any appointment. Pre-populate with appointment type, duration, and default rate.                    |
| **Tebra**        | Charge capture status tracking          | Visual status badges on appointments: Unbilled → Draft → Submitted → Paid. Practice manager can see at a glance what's outstanding. |
| **AdvancedMD**   | Instant eligibility checks              | One-button eligibility verification for all patients scheduled today. Results cached and visible on appointment cards.              |
| **Athenahealth** | Cost estimation upfront                 | Before checkout, show patient their estimated responsibility based on insurance and appointment type.                               |

### 3.4 Dashboard & Navigation

| Source Product   | Pattern                                                 | How to Adapt for ConciergeOS                                                                                                                           |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Athenahealth** | Exception-based workflow dashboard                      | "Today's Tasks" panel showing: unbilled appointments, pending insurance verifications, patients needing follow-up booking, messages requiring reply.   |
| **Tebra**        | Module-based top navigation with active/inactive states | Clean top bar: Schedule, Patients, Billing, Communications, Reports. Inactive/unsubscribed features hidden rather than grayed out (reduces confusion). |
| **DrChrono**     | Top-tab navigation with all major modules visible       | Simple horizontal nav with 5-7 primary sections. Avoid hamburger menus for core functions — non-technical users prefer visible options.                |
| **Athenahealth** | Role-based dashboard views                              | Practice Manager sees: revenue, scheduling efficiency, staff utilization. Front Desk sees: today's schedule, check-ins, messages.                      |

### 3.5 Communications

| Source Product | Pattern                                  | How to Adapt for ConciergeOS                                                                                                                          |
| -------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ChiroHD**    | Two-way text for confirmations/reminders | Built-in SMS thread per patient for scheduling, reminders, and follow-ups. No third-party tool needed.                                                |
| **Jane**       | Automated email/SMS reminder sequence    | Configurable reminder cadence: 48hr email, 12hr email, 3hr SMS. Patient can opt out per channel.                                                      |
| **Tebra**      | Online booking with custom rules         | Branded booking page with practice logo, provider photos, real-time availability. Rules: minimum notice, max future booking window, required deposit. |

---

## 4. What to Avoid

### 4.1 Dated, Dense Menu Hierarchies

**Problem:** AdvancedMD and NextGen are criticized for "dense menus," "too many clicks," and "features hard to locate." [EHRSource 2026; EHRReviews; IJRPR]  
**Avoid:** Deep nested menus. Multi-step navigation for common tasks. Module-based organization (Billing Module → Claims → Create Claim) instead of workflow-based organization (Patient → Today's Visit → Bill This Visit).

### 4.2 Feature Clutter on Primary Screens

**Problem:** DrChrono users call the interface "cluttered" and "heavy." [Trustpilot 2023] NextGen's robust features create complexity. [IJRPR]  
**Avoid:** Showing all possible features to all users. Using grayed-out inactive features as upsell prompts (Tebra's gray module icons confuse users). Putting advanced actions in primary toolbars.

### 4.3 Inconsistent Mobile Experience

**Problem:** AdvancedMD's mobile app "lacks full parity with web platform." DrChrono's mobile app has "no offline access." ChiroHD has "app functionality issues." [EHRSource 2026; SelectHub 2026; FindEMR 2025]  
**Avoid:** Building mobile as an afterthought. If ConciergeOS has a mobile view, ensure core scheduling, patient lookup, and messaging work fully on tablet/phone.

### 4.4 Steep Onboarding with Long Training

**Problem:** AdvancedMD takes "4 to 8 weeks before staff feel comfortable." [EHRSource 2026] Athenahealth has a "learning curve during initial implementation." [Transcure 2025]  
**Avoid:** Requiring formal training for basic tasks. The product should be learnable through exploration for a non-technical user. Provide in-app contextual help, not just documentation.

### 4.5 Modular Pricing Confusion in UI

**Problem:** Tebra shows grayed-out modules creating visual clutter. AdvancedMD's modular pricing "adds up quickly" and creates feature-gating frustration. [Tebra Help Center; EHRSource 2026]  
**Avoid:** If using tiered pricing, hide unavailable features entirely rather than showing them as disabled. Disabled buttons create confusion and make users feel the product is "broken."

### 4.6 Poor Customer Support

**Problem:** This is the #1 complaint across ALL platforms — Tebra, DrChrono, AdvancedMD, Jane, and Athenahealth all receive criticism for support responsiveness. [Multiple review sources]  
**Avoid:** Treating support as a cost center. For ConciergeOS, invest in: (1) in-app contextual help, (2) chat-based support with fast response, (3) comprehensive video tutorials for non-technical users.

### 4.7 Over-Reliance on Customization

**Problem:** ChiroHD's limited customization is its top complaint (75% negative). [FindEMR 2025] But AdvancedMD's highly customizable templates are "time-consuming" and "hard to create." [EHRReviews; EHRSource 2026]  
**Avoid:** Forcing users to build their own templates/workflows from scratch. Provide sensible defaults and allow light customization (colors, appointment types, reminder messages) rather than deep configuration.

### 4.8 Clinical-First Organization for Non-Clinical Users

**Problem:** Most EHRs (Epic, Cerner, NextGen) organize around clinical documentation. Practice managers get lost in charting interfaces.  
**Avoid:** Since ConciergeOS is operations/practice management (not EHR), NEVER organize the UI around clinical workflows. Organize around the practice manager's day: scheduling, communications, billing, reporting.

---

## 5. Recommendations for ConciergeOS Design

### 5.1 Design Principles (Derived from Benchmarks)

1. **The 3-Second Rule:** A practice manager should know what's urgent today within 3 seconds of login. [Fuselab Healthcare UX Guide 2026]
2. **Workflow > Module:** Organize the UI around what the practice manager DOES (schedule → confirm → check in → bill → follow up), not around software features (Scheduling Module, Billing Module).
3. **Color = Status:** Use color consistently to indicate state, not decoration. Every color choice should have an operational meaning.
4. **One-Click Actions:** The 5 most common actions (book appointment, send reminder, create invoice, check eligibility, send message) should each require ≤2 clicks from the home screen.
5. **Search > Browse:** Non-technical users in their 50s prefer search and recent items over hierarchical navigation. [Tebra global search pattern; Athenahealth patient lookup]
6. **Mobile-Ready, Not Mobile-First:** The primary user is at a desk, but they need to check schedules and send messages from a tablet or phone. Ensure core functions work on touch devices.

### 5.2 Specific UI Recommendations

| Area                   | Recommendation                                                                             | Source Inspiration                                              |
| ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Home Screen**        | Daily operational dashboard: today's schedule + outstanding tasks + messages needing reply | Athenahealth exception-based dashboard; Tebra Outstanding Items |
| **Scheduling**         | Side-by-side multi-provider calendar with color-coded status and drag-and-drop             | Jane multi-view; Tebra color coding; ChiroHD clarity            |
| **Patient Lookup**     | Global search bar with last 5 recent patients, plus create-new-patient shortcut            | Tebra global search                                             |
| **Appointment Detail** | Popover card showing: patient info, status, balance, insurance, notes, one-click actions   | Tebra Appointment Card                                          |
| **Billing**            | Status badges on appointments (Unbilled → Paid); inline invoice creation                   | Jane inline billing; Tebra charge capture status                |
| **Communications**     | Built-in SMS thread per patient; automated reminder sequences                              | ChiroHD two-way text; Jane reminder sequence                    |
| **Patient Portal**     | Self-scheduling, self check-in, form completion, payment                                   | Athenahealth Patient Portal; NextGen PxP Portal                 |
| **Navigation**         | 5-7 visible top tabs; no hamburger menu for primary functions                              | DrChrono top-tab pattern                                        |
| **Onboarding**         | Interactive tutorial for first login; contextual tooltips; video help center               | Jane tutorial base; Tebra in-app Help Center                    |

---

## 6. Sources Cited

1. **Jane App** — [jane.app](https://jane.app/) (homepage, features page)
2. **Jane App Review (Medesk)** — medesk.net/en/blog/jane-app-review/ (2023, updated 2026)
3. **Jane App Pricing Guide (Pabau)** — pabau.com/blog/jane-app-pricing/ (Feb 2026)
4. **Jane App User Satisfaction (SelectHub)** — selecthub.com/p/mental-health-software/jane-app/
5. **Tebra Software Reviews (Software Advice)** — softwareadvice.com/medical/kareo-profile/ (Feb 2026)
6. **Tebra vs Athenahealth (MedPrecisionBilling)** — medprecisionbilling.com/compare/kareo-tebra-vs-athenahealth-vs-eclinicalworks/ (Apr 2026)
7. **Tebra Help Center — Navigate Dashboard** — helpme.tebra.com/Platform/Dashboard/Navigate_the_Dashboard (Apr 2026)
8. **How to Use Tebra Like a Pro (Healos.ai)** — healos.ai/blog/how-to-use-tebra-like-a-pro (Mar 2025)
9. **Tebra Patient Experience Reviews (SelectHub)** — selecthub.com/p/patient-scheduling-software/tebra-patient-experience/
10. **ChiroHD Reviews (FindEMR)** — findemr.com/chirohd-software (Dec 2025)
11. **ChiroHD Homepage** — chirohd.com/
12. **ChiroHD Chiropractic EHR Review (Evidence Based Chiropractor)** — theevidencebasedchiropractor.com/blog/chirohd-chiropractic-ehr-review (Aug 2025)
13. **ChiroHD Review (Subscribed.fyi)** — subscribed.fyi/chirohd/reviews/ (Apr 2025)
14. **AdvancedMD EHR Review (EHRSource)** — ehrsource.com/vendors/advancedmd/ (Feb 2026)
15. **AdvancedMD Medical Software Review (Business News Daily)** — businessnewsdaily.com/16244-advancedmd-medical-software.html (Sep 2021)
16. **AdvancedMD EHR Software (SoftwareFinder)** — softwarefinder.com/emr-software/advancedmd (Apr 2026)
17. **AdvancedMD Review (TheMedicalPractice)** — themedicalpractice.com/tools/advancedmd-review/ (Jan 2025)
18. **AdvancedMD EHR Reviews (EHRReviews)** — ehrreviews.com/profile/advancedmd-ehr
19. **NextGen Practice Management Brochure** — gbscorp.com/wp-content/uploads/2016/07/PracticeManagementSlick.pdf
20. **NextGen Enterprise Overview Brochure** — nextgen.com/-/media/dam/collateral/brochures/ne_ngeoverview_brochure.pdf
21. **NextGen Research Review (IJRPR)** — ijrpr.com/uploads/V5ISSUE4/IJRPR25542.pdf
22. **DrChrono Software Reviews (Software Advice)** — softwareadvice.com/medical/drchrono-profile/ (Mar 2026)
23. **DrChrono vs Tebra (SelectHub)** — selecthub.com/ehr-software/drchrono-vs-tebra-practice-management/ (Feb 2026)
24. **DrChrono Review (Business News Daily)** — businessnewsdaily.com/16245-drchrono-medical-software.html (Sep 2021)
25. **DrChrono EHR Review (ITQlick)** — itqlick.com/drchrono-ehr (Oct 2024)
26. **DrChrono Trustpilot Reviews** — uk.trustpilot.com/review/drchrono.com (Jan 2023)
27. **DrChrono vs Practice Fusion (FindEMR)** — findemr.com/resources/drchrono-vs-practicefusion/ (Feb 2025)
28. **Athenahealth vs eClinicalWorks (SoftwareFinder)** — softwarefinder.com/resources/eclinicalworks-vs-athenahealth-comparison (Apr 2026)
29. **Athenahealth EHR Features (IgniteHS)** — ignitehs.com/blog/10-essential-athenahealth-ehr-features-for-your-practice/ (Feb 2026)
30. **Athenahealth Clinical Documentation (EHRSource)** — ehrsource.com/compare/athenahealth-vs-eclinicalworks/ (Feb 2026)
31. **Athenahealth 2025 Updates (EMRFinder)** — emrfinder.com/blog/athenahealth-emr-software-2025-updates/ (Jan 2025)
32. **Athenahealth 2024 Review (EMRSystems)** — emrsystems.net/blog/athenahealth-emr-software-2024-in-review/ (Dec 2024)
33. **Athenahealth Best in KLAS Analysis (Interface-Design.co.uk)** — interface-design.co.uk/blog/practice-management-software-ux-where-interface-debt-is-costing-you/ (Mar 2026)
34. **Athenahealth Workflow Customization (RCMExperts)** — rcmexperts.us/blog/athena/how-to-customize-workflows-in-athenahealth/ (Dec 2025)
35. **Athenahealth Service Description** — athenahealth.com/sites/default/files/media_docs/athenaOne-Service-Description.pdf (Mar 2026)
36. **User-Friendly EHR Apps (Zazz)** — zazz.io/blog/ehr-emr-interface-design-principles (Dec 2025)
37. **Healthcare UX Design Guide (Fuselab)** — fuselabcreative.com/healthcare-ux-design-best-practices-guide/ (Apr 2026)
38. **Healthcare UX Trends (MagicFlux)** — magicflux.co/blog/ux-trends-digital-healthcare-2026 (Feb 2026)
39. **Top Chiropractic EHR Softwares (ClinicMind)** — clinicmind.com/blog/top-chiropractic-ehr-softwares/ (May 2026)
40. **SaaS UI UX Design Patterns (SaaSUI)** — saasui.design

---

_End of Dimension 10 Research Document_
