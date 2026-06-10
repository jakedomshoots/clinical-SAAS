# Medicare Billing vs ONC Certification — What Your Wife Actually Needs

## The Short Answer

**Your wife can bill Medicare WITHOUT ONC certification.**

ONC certification is only required for one specific Medicare program — the EHR Incentive Program (now called "Promoting Interoperability"). It's a bonus payment program, not a requirement to bill Medicare normally.

## What Your Wife Needs to Bill Medicare

| Requirement                  | Does Concierge OS Have It?           |
| ---------------------------- | ------------------------------------ |
| NPI for provider             | Yes (your wife has this)             |
| Practice NPI                 | Yes (your wife has this)             |
| Medicare enrollment (PECOS)  | Yes (your wife did this)             |
| HIPAA-compliant EHR          | Yes (built)                          |
| ICD-10 coding                | Yes (built)                          |
| CPT coding                   | Yes (built)                          |
| Claim submission to Medicare | Yes (Availity clearinghouse adapter) |
| ERA/EOB receipt              | Yes (Availity adapter)               |
| Audit logging                | Yes (built)                          |

**She can bill Medicare today with what we built.**

## What ONC Certification Gets You (That She Doesn't Have Now)

| Benefit                                   | Value                                                  |
| ----------------------------------------- | ------------------------------------------------------ |
| Promoting Interoperability bonus payments | $3,000-$9,000/year per provider (declining every year) |
| Medicaid EHR incentives                   | Varies by state, up to $63,750 over 6 years            |
| Participation in some ACOs                | Some ACO contracts require certified EHR               |
| Hospital affiliation agreements           | Some hospitals require it for admitting privileges     |
| State HIE participation                   | Some state exchanges require it                        |

## The Math

| Scenario                             | Cost                   | Benefit                     |
| ------------------------------------ | ---------------------- | --------------------------- |
| **Bill Medicare without ONC cert**   | $0 extra               | Full Medicare reimbursement |
| **Get ONC certified for PI bonuses** | $105K-$230K first year | $3K-$9K/year per provider   |

**Payback period: 12-77 years.**

The Promoting Interoperability program is being phased out. CMS has reduced payments every year since 2017. By 2026, the maximum bonus for a single provider is roughly $3,000-$4,000. It is not worth spending six figures to collect a few thousand dollars.

## What Actually Matters for Medicare Billing

### 1. MIPS (Merit-Based Incentive Payment System)

This affects Medicare reimbursement rates. Your wife reports quality measures and gets a payment adjustment (bonus or penalty).

- **Requires**: Quality data reporting
- **Concierge OS has**: CQM engine with 10 measures, QRDA export
- **What she needs to do**: Submit QRDA files to CMS via registry or directly
- **Cost**: Registry submission ~$300-$500/year
- **Potential impact**: +/- 9% on Medicare payments

### 2. EPCS (Electronic Prescribing of Controlled Substances)

Required for prescribing controlled substances electronically.

- **Requires**: Two-factor authentication + identity proofing
- **Concierge OS has**: DoseSpot eRx adapter (supports EPCS)
- **What she needs to do**: Complete DoseSpot EPCS enrollment
- **Cost**: Included in DoseSpot subscription (~$50-$150/month)

### 3. PDMP Check Before Prescribing

Most states require checking the prescription drug monitoring program before prescribing Schedule II-V drugs.

- **Concierge OS has**: PDMP query adapter
- **What she needs to do**: Register with state PDMP
- **Cost**: Usually free

## Bottom Line

Your wife can:

- Bill Medicare today without ONC certification
- Collect full Medicare reimbursement rates
- Use all the features we built (eRx, labs, billing, charting)
- Report MIPS quality measures using our CQM engine

ONC certification is a nice-to-have for a small practice. It makes sense for large multi-provider groups or hospital systems. For a single-provider family practice, the cost far exceeds the benefit.

## Recommendation

1. **Launch without ONC certification**
2. **Enroll in MIPS** using our CQM engine (submit via a registry like Mingle or Clinigence)
3. **Complete EPCS with DoseSpot** for controlled substance prescribing
4. **Register with state PDMP**
5. **Revisit ONC certification in 2-3 years** if the practice grows to 3+ providers or joins an ACO

The only "certification" your wife needs is her medical license, DEA number, and Medicare enrollment. Everything else is optional.
