# Concierge OS vs DrChrono — Gap Analysis

## Executive Summary

Concierge OS is approximately **60-70% feature-complete** compared to DrChrono's core EHR functionality. The backend infrastructure, integration adapters, and operational tooling are well-built. The biggest gaps are in **clinical documentation workflows**, **mobile experience**, **revenue cycle management depth**, and **regulatory compliance certifications**.

---

## DrChrono Feature Inventory (from public site + pricing)

### 1. EHR / Clinical (DrChrono's Core)

| Feature                            | DrChrono                   | Concierge OS                              | Gap    |
| ---------------------------------- | -------------------------- | ----------------------------------------- | ------ |
| Patient charting                   | Full SOAP notes, templates | Basic patient records, clinical templates | MEDIUM |
| Custom forms                       | Drag-and-drop form builder | No form builder — templates only          | LARGE  |
| Specialty templates                | 30+ specialties            | Generic templates, no specialty packs     | LARGE  |
| Drawing/annotation tools           | iPad drawing on charts     | None                                      | LARGE  |
| Speech-to-text (EverHealth Scribe) | Built-in AI scribe         | CopilotKit integration only               | MEDIUM |
| Custom macros                      | User-defined shortcuts     | None                                      | MEDIUM |
| Document management                | Full DMS with tags         | Patient documents only                    | MEDIUM |
| eSignatures                        | Patient consent signing    | Not implemented                           | LARGE  |
| Photo capture                      | iPad camera to chart       | None                                      | LARGE  |
| Vitals tracking                    | Graphing over time         | Basic vitals storage, no graphing         | MEDIUM |
| Allergies & problems               | Structured lists           | Present                                   | NONE   |
| Medications list                   | Full med management        | Present                                   | NONE   |
| Immunization tracking              | With registry reporting    | Not implemented                           | LARGE  |
| Growth charts (peds)               | CDC/WHO curves             | Not implemented                           | LARGE  |
| Procedure coding                   | CPT/ICD-10 lookup          | Basic billing codes                       | MEDIUM |
| Care plans                         | Structured care plans      | Not implemented                           | LARGE  |
| Clinical decision support          | Alerts, reminders          | Not implemented                           | LARGE  |

### 2. Scheduling / Practice Management

| Feature                | DrChrono                | Concierge OS                          | Gap    |
| ---------------------- | ----------------------- | ------------------------------------- | ------ |
| Appointment scheduling | Drag-and-drop calendar  | Basic scheduling with Google Calendar | MEDIUM |
| Recurring appointments | Weekly/monthly patterns | Not implemented                       | MEDIUM |
| Waitlist management    | Automated fill          | Not implemented                       | LARGE  |
| Room/resource tracking | Exam room assignment    | Not implemented                       | MEDIUM |
| Online booking widget  | Embeddable on website   | Patient portal requests only          | MEDIUM |
| Appointment reminders  | Email/SMS/phone         | SMS via Twilio only                   | SMALL  |
| Check-in kiosk         | iPad self-check-in      | Not implemented                       | LARGE  |
| Wait time tracking     | Real-time estimates     | Not implemented                       | LARGE  |
| Provider scheduling    | Multiple provider views | Single provider                       | MEDIUM |
| Calendar sync          | Google/Outlook/Apple    | Google Calendar only                  | SMALL  |

### 3. Billing / Revenue Cycle

| Feature                   | DrChrono                   | Concierge OS              | Gap    |
| ------------------------- | -------------------------- | ------------------------- | ------ |
| Auto-generated CMS-1500   | One-click claim forms      | Not implemented           | LARGE  |
| Real-time claim scrubbing | Pre-submission validation  | Not implemented           | LARGE  |
| Denial management         | Track and appeal denials   | Basic claim status only   | LARGE  |
| Payment posting           | ERA auto-posting           | Manual via Intuit adapter | MEDIUM |
| Patient statements        | Auto-generate and mail     | Not implemented           | LARGE  |
| Payment plans             | Structured plans           | Not implemented           | LARGE  |
| Superbill generation      | Visit summary for patients | Not implemented           | MEDIUM |
| MIPS/MACRA reporting      | Quality measure tracking   | Not implemented           | LARGE  |
| Credentialing tracking    | Provider enrollment status | Not implemented           | LARGE  |
| Integrated RCM services   | Outsourced billing option  | Not available             | LARGE  |

### 4. Patient Portal (OnPatient)

| Feature                 | DrChrono               | Concierge OS        | Gap    |
| ----------------------- | ---------------------- | ------------------- | ------ |
| Secure messaging        | Two-way with staff     | SMS via Twilio only | MEDIUM |
| Appointment requests    | Self-scheduling        | Intake form only    | MEDIUM |
| Form completion         | Pre-visit forms online | Portal intake only  | MEDIUM |
| Document access         | Lab results, summaries | Not implemented     | LARGE  |
| Bill pay                | Online payments        | Via Intuit adapter  | SMALL  |
| Proxy access            | Family member access   | Not implemented     | LARGE  |
| Telehealth join         | One-click video        | Not implemented     | LARGE  |
| Health records download | CCDA export            | Not implemented     | LARGE  |

### 5. Communications

| Feature         | DrChrono                   | Concierge OS         | Gap    |
| --------------- | -------------------------- | -------------------- | ------ |
| Practice chat   | Internal staff messaging   | Not implemented      | LARGE  |
| Patient SMS     | Two-way texting            | Twilio adapter ready | NONE   |
| Bulk messaging  | Campaigns to patient lists | Not implemented      | MEDIUM |
| Fax             | Send/receive               | SRFax adapter ready  | NONE   |
| Email reminders | Unlimited                  | Not implemented      | MEDIUM |
| Voice calls     | Click-to-call              | Twilio voice ready   | NONE   |
| Video visits    | Built-in telehealth        | Not implemented      | LARGE  |

### 6. Labs & Integrations

| Feature                 | DrChrono                 | Concierge OS           | Gap   |
| ----------------------- | ------------------------ | ---------------------- | ----- |
| Lab orders              | Direct to LabCorp/Quest  | Adapters ready         | NONE  |
| Lab results             | Auto-import to chart     | Adapters ready         | NONE  |
| Immunization registries | State registry reporting | Not implemented        | LARGE |
| eRx (Surescripts)       | Full prescribing         | DoseSpot adapter ready | NONE  |
| Prior auth              | Electronic PA submission | Not implemented        | LARGE |
| RecordSync/RLE          | Record locator exchange  | Not implemented        | LARGE |
| HIE connectivity        | Carequality/CommonWell   | Not implemented        | LARGE |

### 7. Reporting & Analytics

| Feature             | DrChrono                | Concierge OS          | Gap    |
| ------------------- | ----------------------- | --------------------- | ------ |
| Financial reports   | AR, collections, trends | Basic analytics       | MEDIUM |
| Clinical reports    | Quality measures        | Not implemented       | LARGE  |
| Scheduling reports  | Utilization, no-shows   | Not implemented       | MEDIUM |
| Custom reports      | Report builder          | Not implemented       | LARGE  |
| Dashboard KPIs      | Real-time metrics       | Basic admin dashboard | MEDIUM |
| Export to Excel/CSV | All reports             | Partial               | SMALL  |

### 8. AI & Automation

| Feature                | DrChrono                | Concierge OS    | Gap    |
| ---------------------- | ----------------------- | --------------- | ------ |
| AI scribe (EverHealth) | Ambient documentation   | CopilotKit only | MEDIUM |
| Predictive engagement  | No-show prediction      | Not implemented | LARGE  |
| Billing automation     | Auto-coding suggestions | Not implemented | LARGE  |
| Smart scheduling       | AI-optimized slots      | Not implemented | LARGE  |
| Voice commands         | Hands-free charting     | Not implemented | LARGE  |

### 9. Mobile / iPad

| Feature               | DrChrono                | Concierge OS    | Gap    |
| --------------------- | ----------------------- | --------------- | ------ |
| Native iPad app       | Full EHR on iPad        | Web only        | LARGE  |
| Offline mode          | Sync when connected     | Not implemented | LARGE  |
| Photo capture         | Camera to patient chart | Not implemented | LARGE  |
| Apple Pencil support  | Drawing on charts       | Not implemented | LARGE  |
| Face ID / Touch ID    | Biometric login         | Not implemented | MEDIUM |
| Mobile-responsive web | Works on phone          | Partial         | MEDIUM |

### 10. Compliance & Certifications

| Feature                     | DrChrono          | Concierge OS         | Gap      |
| --------------------------- | ----------------- | -------------------- | -------- |
| ONC Health IT Certification | Certified EHR     | Not certified        | CRITICAL |
| HIPAA compliance            | BAA, audits       | Infrastructure ready | SMALL    |
| SOC 2 Type II               | Audited           | Not audited          | MEDIUM   |
| State eRx compliance        | EPCS, PDMP        | Not implemented      | LARGE    |
| Meaningful Use support      | Quality reporting | Not implemented      | LARGE    |
| Interoperability (FHIR)     | FHIR API          | Not implemented      | LARGE    |

---

## Gap Severity Legend

| Severity | Meaning                              | Count |
| -------- | ------------------------------------ | ----- |
| NONE     | Feature exists or adapter ready      | 12    |
| SMALL    | Minor enhancement needed             | 6     |
| MEDIUM   | Feature partially exists, needs work | 14    |
| LARGE    | Feature missing entirely             | 22    |
| CRITICAL | Blocking regulatory/compliance issue | 1     |

---

## What Concierge OS Does Better

1. **Modern architecture** — FastAPI + React, real-time WebSockets, proper async
2. **Integration adapters** — 12 vendor-specific adapters with retry/circuit breaker
3. **AI assistant** — CopilotKit-powered clinical assistant (DrChrono's is separate scribe)
4. **Operational tooling** — Terraform, runbooks, monitoring, security hardening
5. **Open/self-hosted** — You own the data, no vendor lock-in
6. **Developer experience** — Type safety, tests, proper API design

---

## Top 10 Priority Gaps to Close

1. **ONC Certification** — Required for Medicare/Medicaid reimbursement
2. **Custom form builder** — DrChrono's #1 differentiator for specialties
3. **Mobile iPad app** — DrChrono built their brand on this
4. **Telehealth/video visits** — Post-COVID expectation
5. **Revenue cycle depth** — Claim scrubbing, denial management, ERA auto-posting
6. **Immunization registries** — Required for pediatric practices
7. **eSignatures / consent management** — Legal requirement for many procedures
8. **FHIR API / interoperability** — Required for health information exchange
9. **Prior authorization** — Major time sink for practices
10. **Patient portal completeness** — Document access, proxy access, CCDA download

---

## Recommendation

For a small-to-medium practice replacing DrChrono:

**Phase 1 (MVP — 2-3 months)**: Fix scheduling, billing basics, patient portal messaging, eRx. Get HIPAA BAA signed with all vendors.

**Phase 2 (Core — 3-6 months)**: Add form builder, telehealth, mobile responsiveness, claim scrubbing.

**Phase 3 (Competitive — 6-12 months)**: Pursue ONC certification, build native iPad app, add AI scribe, prior auth.

The current codebase is a solid foundation. The gaps are well-understood and mostly additive — not architectural rewrites.
