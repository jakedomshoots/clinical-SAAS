"""Public health reporting router for ONC criteria (a)(10), (a)(11), (f)(2)-(f)(5)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.integrations.public_health import PublicHealthClient
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/public-health", tags=["Public Health Reporting"])


@router.post("/case-report")
async def submit_case_report(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Submit electronic case report for reportable condition."""
    client = PublicHealthClient()
    return await client.submit_case_report(
        patient_id=data["patient_id"],
        condition_code=data["condition_code"],
        condition_name=data["condition_name"],
        onset_date=data["onset_date"],
        provider_npi=data.get("provider_npi", getattr(current_user, "npi", "")),
        facility_id=data.get("facility_id", "default"),
        trigger_reason=data.get("trigger_reason", "diagnosis"),
    )


@router.post("/syndromic-surveillance")
async def submit_syndromic_surveillance(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Submit emergency department data for syndromic surveillance."""
    client = PublicHealthClient()
    return await client.submit_syndromic_surveillance(
        patient_id=data["patient_id"],
        visit_date=data["visit_date"],
        chief_complaint=data["chief_complaint"],
        diagnosis_codes=data.get("diagnosis_codes", []),
        facility_id=data.get("facility_id", "default"),
    )


@router.post("/lab-report")
async def submit_reportable_lab(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Submit reportable lab result to public health."""
    client = PublicHealthClient()
    return await client.submit_reportable_lab_result(
        patient_id=data["patient_id"],
        test_code=data["test_code"],
        test_name=data["test_name"],
        result_value=data["result_value"],
        result_date=data["result_date"],
        ordering_provider_npi=data.get("ordering_provider_npi", getattr(current_user, "npi", "")),
        performing_lab_id=data.get("performing_lab_id", "default"),
    )


@router.post("/cancer-registry")
async def submit_cancer_case(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Submit cancer case to state registry."""
    client = PublicHealthClient()
    return await client.submit_cancer_case(
        patient_id=data["patient_id"],
        tumor_site=data["tumor_site"],
        histology_code=data["histology_code"],
        behavior_code=data["behavior_code"],
        diagnosis_date=data["diagnosis_date"],
        staging=data.get("staging"),
        treating_provider_npi=data.get("treating_provider_npi", getattr(current_user, "npi", "")),
    )


@router.post("/pdmp/query")
async def query_pdmp(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Query state PDMP for controlled substance history."""
    client = PublicHealthClient()
    return await client.query_pdmp(
        patient_first_name=data["patient_first_name"],
        patient_last_name=data["patient_last_name"],
        patient_dob=data["patient_dob"],
        patient_gender=data["patient_gender"],
        requesting_provider_npi=data.get("requesting_provider_npi", getattr(current_user, "npi", "")),
        purpose=data.get("purpose", "TREATMENT"),
    )
