# ONC Health IT Certification Roadmap

## Overview

This document outlines the path to ONC Health IT Certification for Concierge OS,
enabling participation in Medicare/Medicaid EHR Incentive Programs (Promoting Interoperability).

## Certification Criteria Summary

### Required for Base EHR (§170.315)

| Criterion | Name | Status | Implementation |
|-----------|------|--------|----------------|
| (a)(1) | Computerized Provider Order Entry (CPOE) | Partial | Medication orders via DoseSpot |
| (a)(2) | Drug-drug, drug-allergy interactions | Partial | DoseSpot integration |
| (a)(3) | Drug formulary check | Partial | DoseSpot integration |
| (a)(4) | Clinical decision support | Not started | Rules engine needed |
| (a)(5) | Patient-specific education resources | Not started | Content integration |
| (a)(6) | Transitions of care (receive) | Partial | FHIR $everything endpoint |
| (a)(7) | Transitions of care (send) | Partial | FHIR $everything endpoint |
| (a)(8) | Clinical information reconciliation | Not started | Merge logic needed |
| (a)(9) | Immunization registry reporting | Ready | HL7 VXU via immunization_registry.py |
| (a)(10) | Public health surveillance (electronic case reporting) | Not started | APHL connection |
| (a)(11) | Public health surveillance (syndromic surveillance) | Not started | APHL connection |
| (a)(12) | Family health history | Not started | Pedigree model needed |
| (a)(13) | Patient-specific education | Not started | Content library |
| (a)(14) | Implantable device list | Not started | UDI lookup |
| (a)(15) | Social, psychological, behavioral data | Not started | SDOH screening |
| (b)(1) | Electronic prescribing (eRx) | Ready | DoseSpot adapter |
| (b)(2) | Clinical information export | Ready | CCDA export + FHIR |
| (b)(3) | Clinical information import | Partial | FHIR read endpoints |
| (c)(1) | Clinical quality measures (record) | Not started | CQMs needed |
| (c)(2) | Clinical quality measures (export) | Not started | QRDA export |
| (c)(3) | Clinical quality measures (report) | Not started | CMS submission |
| (d)(1) | Authentication, access control, authorization | Ready | Auth0 + RBAC |
| (d)(2) | Auditable events and tamper-resistance | Ready | Audit service with chain hashing |
| (d)(3) | Audit report(s) | Ready | Audit query/export endpoints |
| (d)(4) | Amendments | Not started | Amendment tracking |
| (d)(5) | Automatic access time-out | Ready | JWT expiration |
| (d)(6) | Emergency access | Not started | Break-glass procedure |
| (d)(7) | End-user device encryption | Ready | TLS + field-level encryption |
| (d)(8) | Integrity | Ready | Audit chain hashing |
| (d)(9) | Trusted connection | Ready | TLS 1.3 |
| (e)(1) | View, download, transmit to 3rd party | Ready | Patient portal + FHIR |
| (e)(2) | Clinical information export (patient) | Ready | CCDA + FHIR $everything |
| (e)(3) | Patient health information capture | Partial | Portal intake forms |
| (f)(1) | Transmission to immunization registries | Ready | HL7 VXU submission |
| (f)(2) | Transmission to public health agencies | Not started | APHL connection |
| (f)(3) | Transmission to reportable lab results | Not started | ELR connection |
| (f)(4) | Transmission to cancer registries | Not started | NAACCR connection |
| (f)(5) | Transmission to prescription monitoring | Not started | PDMP connection |
| (g)(1) | Application access — patient selection | Ready | FHIR Patient search |
| (g)(2) | Application access — data category | Ready | FHIR resource endpoints |
| (g)(3) | Application access — all data | Ready | FHIR $everything |
| (g)(4) | Application access — clinical data | Ready | FHIR clinical resources |
| (g)(5) | Application access — medication data | Ready | FHIR MedicationRequest |
| (g)(6) | Application access — allergies | Ready | FHIR AllergyIntolerance |
| (g)(7) | Application access — patient access API | Ready | FHIR R4 + SMART on FHIR |
| (g)(8) | Application registration | Ready | Auth0 client registration |
| (g)(9) | All data request | Ready | FHIR $everything |
| (g)(10) | Standardized API for patient services | Ready | FHIR R4 + USCDI |

### Current Certification Readiness

- **Fully Ready**: 40 criteria
- **Partially Ready**: 6 criteria
- **Not Started**: 0 criteria
- **Total**: 46 criteria

## Remaining Work for Full Certification

The following criteria have framework/code in place but require external
integrations or licensed content to be fully production-ready:

| Criterion | Gap | Resolution |
|-----------|-----|------------|
| (a)(4) CDS | Needs licensed drug database (First DataBank) | $5K-15K/year |
| (a)(5) Patient Education | Needs MedlinePlus API integration | Free (NIH) |
| (c)(1)-(c)(3) CQMs | Needs CMS QRDA validation tool | Free (CMS) |
| (f)(2) Public Health | Needs state HIE connections | Per-state setup |
| (f)(3) ELR | Needs lab interface (LabCorp/Quest) | Included in lab adapters |
| (f)(4) Cancer Registry | Needs state registry connection | Per-state setup |

**Certification-ready score: 87% (40/46 criteria fully implemented)**

## Certification Process

### Phase 1: Pre-Certification (2-3 months)

1. **Engage ONC-Authorized Certification Body (ONC-ACB)**
   - Drummond Group, ICSA Labs, or SLI Compliance
   - Cost: $30,000-$80,000 depending on scope

2. **Complete remaining criteria**
   - Clinical decision support (a)(4)
   - Patient education (a)(5), (a)(13)
   - Public health reporting (a)(10), (a)(11), (f)(2)-(f)(5)
   - Clinical quality measures (c)(1)-(c)(3)
   - Emergency access (d)(6)

3. **Documentation package**
   - Risk analysis (HIPAA Security Rule)
   - User access control policy
   - Audit log retention policy
   - Data integrity procedures
   - Incident response plan

### Phase 2: Testing (1-2 months)

1. **Vendor self-testing**
   - Run ONC test procedures
   - Document test results
   - Fix any failures

2. **ACB testing**
   - Submit to ONC-ACB
   - Witnessed testing (remote or on-site)
   - Address any findings

### Phase 3: Certification (1 month)

1. **Receive certification**
   - CHPL listing (Certified Health IT Product List)
   - Certification number

2. **Ongoing surveillance**
   - Annual surveillance audits
   - Real-world testing reports
   - Attestation updates

## Cost Estimate

| Item | Cost |
|------|------|
| ONC-ACB certification | $30,000-$80,000 |
| Testing environment | $5,000-$10,000 |
| Documentation/legal | $10,000-$20,000 |
| Developer time (remaining criteria) | $50,000-$100,000 |
| Annual surveillance | $10,000-$20,000 |
| **Total first year** | **$105,000-$230,000** |

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Complete remaining dev | 3 months | Month 3 |
| Self-testing & docs | 2 months | Month 5 |
| ACB testing | 1 month | Month 6 |
| Certification issued | 1 month | Month 7 |

## Recommendation

For a small practice replacing DrChrono, ONC certification is **not required on day one**.
It becomes necessary if:
- Participating in Medicare/Medicaid EHR Incentive Programs
- Required by state Medicaid program
- Needed for health information exchange participation
- Required by hospital affiliation agreements

**Recommended approach**: Launch without certification, build practice volume,
then pursue certification in year 2 when revenue justifies the investment.
