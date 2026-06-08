"""Claim scrubbing and denial management router.

Pre-submission validation of claims against payer rules,
CPT/ICD-10 crosswalks, and NCCI edits.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/claims", tags=["Claim Scrubbing"])


# ---------------------------------------------------------------------------
# Scrubbing rules database (simplified — real implementation uses
# licensed payer rule databases like ClaimCheck or CodeCorrect)
# ---------------------------------------------------------------------------

COMMON_SCRUB_RULES: list[dict[str, Any]] = [
    {
        "id": "missing_dob",
        "severity": "error",
        "category": "patient",
        "message": "Patient date of birth is required",
        "check": lambda claim: bool(claim.get("patient_dob")),
    },
    {
        "id": "missing_insurance",
        "severity": "error",
        "category": "insurance",
        "message": "Primary insurance information is required",
        "check": lambda claim: bool(claim.get("insurance_primary")),
    },
    {
        "id": "invalid_icd10",
        "severity": "error",
        "category": "diagnosis",
        "message": "Diagnosis code must be valid ICD-10-CM format",
        "check": lambda claim: all(
            len(dx.get("code", "")) >= 3 and dx.get("code", "")[0].isalpha()
            for dx in claim.get("diagnoses", [])
        ),
    },
    {
        "id": "missing_cpt",
        "severity": "error",
        "category": "procedure",
        "message": "At least one CPT code is required",
        "check": lambda claim: len(claim.get("procedures", [])) > 0,
    },
    {
        "id": "invalid_cpt",
        "severity": "error",
        "category": "procedure",
        "message": "CPT code must be 5 digits",
        "check": lambda claim: all(
            len(proc.get("code", "")) == 5 and proc.get("code", "").isdigit()
            for proc in claim.get("procedures", [])
        ),
    },
    {
        "id": "missing_provider_npi",
        "severity": "error",
        "category": "provider",
        "message": "Rendering provider NPI is required",
        "check": lambda claim: bool(claim.get("rendering_provider_npi")),
    },
    {
        "id": "invalid_npi",
        "severity": "error",
        "category": "provider",
        "message": "NPI must be 10 digits",
        "check": lambda claim: len(claim.get("rendering_provider_npi", "")) == 10,
    },
    {
        "id": "missing_place_of_service",
        "severity": "error",
        "category": "claim",
        "message": "Place of service code is required",
        "check": lambda claim: bool(claim.get("place_of_service")),
    },
    {
        "id": "dx_pointer_mismatch",
        "severity": "warning",
        "category": "procedure",
        "message": "Procedure diagnosis pointers should reference valid diagnoses",
        "check": lambda claim: all(
            1 <= int(ptr) <= len(claim.get("diagnoses", []))
            for proc in claim.get("procedures", [])
            for ptr in proc.get("diagnosis_pointers", [])
        ),
    },
    {
        "id": "missing_modifiers",
        "severity": "warning",
        "category": "procedure",
        "message": "Bilateral procedures may require modifier 50",
        "check": lambda claim: True,  # Would need bilateral CPT list
    },
    {
        "id": "units_vs_duration",
        "severity": "warning",
        "category": "procedure",
        "message": "Verify units match time-based CPT requirements",
        "check": lambda claim: True,  # Would need time-based CPT list
    },
    {
        "id": "missing_prior_auth",
        "severity": "warning",
        "category": "authorization",
        "message": "Selected procedures may require prior authorization",
        "check": lambda claim: True,  # Would need prior auth CPT list
    },
]


# CPT codes that commonly require prior authorization
PRIOR_AUTH_CPTS: set[str] = {
    "29827",  # Arthroscopy, shoulder
    "23472",  # Shoulder repair
    "29828",  # Rotator cuff repair
    "27447",  # Knee replacement
    "27130",  # Hip replacement
    "45378",  # Colonoscopy
    "43239",  # EGD with biopsy
    "93306",  # Echocardiogram
    "78452",  # Myocardial perfusion imaging
    "72148",  # MRI lumbar spine
    "73721",  # MRI knee
}


# NCCI column 1 / column 2 pairs (simplified subset)
NCCI_EDITS: set[tuple[str, str]] = {
    ("99212", "99213"),  # E/M levels
    ("99213", "99214"),
    ("99214", "99215"),
    ("99381", "99382"),  # Preventive visits
    ("80053", "80048"),  # CMP vs BMP
    ("80053", "80051"),
    ("84443", "84439"),  # Thyroid panels
}


def _check_ncci(procedures: list[dict]) -> list[dict]:
    """Check for NCCI column 1/column 2 bundling conflicts."""
    issues = []
    cpt_list = [p["code"] for p in procedures]
    for i, cpt1 in enumerate(cpt_list):
        for j, cpt2 in enumerate(cpt_list):
            if i != j and (cpt1, cpt2) in NCCI_EDITS:
                issues.append({
                    "severity": "error",
                    "category": "ncci",
                    "message": f"NCCI edit: {cpt1} bundles with {cpt2}",
                    "suggestion": f"Consider modifier 59 on {cpt2} if distinct session",
                })
    return issues


def _check_prior_auth(procedures: list[dict]) -> list[dict]:
    """Check if any procedures require prior authorization."""
    issues = []
    for proc in procedures:
        if proc["code"] in PRIOR_AUTH_CPTS:
            issues.append({
                "severity": "warning",
                "category": "authorization",
                "message": f"CPT {proc['code']} may require prior authorization",
                "suggestion": "Verify prior auth obtained or submit without",
            })
    return issues


def scrub_claim(claim: dict[str, Any]) -> dict[str, Any]:
    """Run full claim scrub and return report."""
    errors = []
    warnings = []
    info = []

    for rule in COMMON_SCRUB_RULES:
        try:
            passed = rule["check"](claim)
        except Exception:
            passed = False

        if not passed:
            issue = {
                "rule_id": rule["id"],
                "severity": rule["severity"],
                "category": rule["category"],
                "message": rule["message"],
            }
            if rule["severity"] == "error":
                errors.append(issue)
            elif rule["severity"] == "warning":
                warnings.append(issue)
            else:
                info.append(issue)

    # NCCI edits
    ncci_issues = _check_ncci(claim.get("procedures", []))
    for issue in ncci_issues:
        if issue["severity"] == "error":
            errors.append(issue)
        else:
            warnings.append(issue)

    # Prior auth checks
    auth_issues = _check_prior_auth(claim.get("procedures", []))
    warnings.extend(auth_issues)

    clean = len(errors) == 0
    return {
        "clean": clean,
        "total_errors": len(errors),
        "total_warnings": len(warnings),
        "total_info": len(info),
        "errors": errors,
        "warnings": warnings,
        "info": info,
        "estimated_clean_claim_rate": 95.0 if clean else max(0, 95 - len(errors) * 15 - len(warnings) * 5),
    }


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.post("/scrub")
async def scrub_claim_endpoint(
    claim: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Scrub a claim before submission."""
    return scrub_claim(claim)


@router.post("/batch-scrub")
async def batch_scrub_claims(
    claims: list[dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Scrub multiple claims."""
    results = []
    for claim in claims:
        result = scrub_claim(claim)
        result["claim_id"] = claim.get("id", "unknown")
        results.append(result)

    total = len(results)
    clean_count = sum(1 for r in results if r["clean"])
    return {
        "total_claims": total,
        "clean_claims": clean_count,
        "clean_rate": round(clean_count / total * 100, 1) if total else 0,
        "results": results,
    }


# ---------------------------------------------------------------------------
# Denial management
# ---------------------------------------------------------------------------

DENIAL_CATEGORIES: dict[str, dict] = {
    "CO": {"name": "Contractual Obligation", "action": "Review contract / write off"},
    "CR": {"name": "Correction/Reversal", "action": "Review and resubmit if needed"},
    "OA": {"name": "Other Adjustment", "action": "Investigate and appeal if appropriate"},
    "PI": {"name": "Payer Initiated", "action": "Contact payer for details"},
    "PR": {"name": "Patient Responsibility", "action": "Bill patient"},
}

COMMON_DENIAL_REASONS: dict[str, dict] = {
    "CO-16": {"reason": "Claim/service lacks information", "action": "Add missing info and resubmit"},
    "CO-18": {"reason": "Duplicate claim/service", "action": "Verify not already paid"},
    "CO-22": {"reason": "Coordination of benefits", "action": "Verify primary/secondary insurance"},
    "CO-29": {"reason": "Time limit for filing expired", "action": "Appeal with documentation"},
    "CO-45": {"reason": "Charge exceeds fee schedule", "action": "Write off or adjust charge"},
    "CO-50": {"reason": "Non-covered service", "action": "Bill patient or appeal"},
    "CO-96": {"reason": "Non-covered charge", "action": "Verify coding / bill patient"},
    "CO-97": {"reason": "Benefit for service included in another payment", "action": "Review bundling / appeal"},
    "CO-109": {"reason": "Claim not covered by this payer", "action": "Verify insurance / COB"},
    "CO-197": {"reason": "Precertification/authorization missing", "action": "Obtain retro auth or appeal"},
    "PR-2": {"reason": "Deductible not met", "action": "Bill patient"},
    "PR-3": {"reason": "Co-insurance", "action": "Bill patient"},
    "PR-96": {"reason": "Non-covered charge", "action": "Bill patient"},
    "OA-18": {"reason": "Exact duplicate claim", "action": "Verify status with payer"},
    "OA-23": {"reason": "Impact of prior payer(s) adjudication", "action": "Review COB"},
    "OA-94": {"reason": "Processed as primary when secondary expected", "action": "Resubmit with correct COB"},
}


@router.post("/denials/analyze")
async def analyze_denial(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyze a denial and recommend action."""
    denial_code = data.get("denial_code", "").upper()
    reason = data.get("reason", "")

    # Try exact match first
    match = COMMON_DENIAL_REASONS.get(denial_code)
    if not match:
        # Try partial match
        for code, info in COMMON_DENIAL_REASONS.items():
            if code.split("-")[-1] == denial_code.split("-")[-1]:
                match = info
                break

    category_code = denial_code.split("-")[0] if "-" in denial_code else "OA"
    category = DENIAL_CATEGORIES.get(category_code, {"name": "Unknown", "action": "Contact payer"})

    return {
        "denial_code": denial_code,
        "category": category["name"],
        "reason": match["reason"] if match else reason or "Unknown denial reason",
        "recommended_action": match["action"] if match else category["action"],
        "appealable": category_code in ("CO", "OA"),
        "bill_patient": category_code == "PR",
        "time_sensitive": denial_code in ("CO-29", "CO-197"),
    }


@router.get("/denials/common-reasons")
async def list_common_denials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List common denial codes and actions."""
    return {
        "categories": DENIAL_CATEGORIES,
        "common_reasons": COMMON_DENIAL_REASONS,
    }
