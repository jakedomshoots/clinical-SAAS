"""Clinical Quality Measures router for ONC criteria (c)(1)-(c)(3)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.clinical_quality_measures import CQMEngine

router = APIRouter(prefix="/cqm", tags=["Clinical Quality Measures"])


@router.get("/measures")
async def list_cqm_measures(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all available clinical quality measures."""
    return CQMEngine.list_measures()


@router.post("/calculate/{measure_id}")
async def calculate_measure(
    measure_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculate a CQM for a population of patients."""
    return CQMEngine.calculate_measure(
        measure_id=measure_id,
        patients=data.get("patients", []),
        measurement_period_start=data.get("measurement_period_start", ""),
        measurement_period_end=data.get("measurement_period_end", ""),
    )


@router.post("/qrda/category1/{measure_id}")
async def generate_qrda_category1(
    measure_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate QRDA Category I (individual patient) XML."""
    xml = CQMEngine.generate_qrda_category1(
        patient=data.get("patient", {}),
        measure_id=measure_id,
    )
    return {
        "measure_id": measure_id,
        "format": "QRDA Category I",
        "xml": xml,
    }


@router.post("/qrda/category3")
async def generate_qrda_category3(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate QRDA Category III (aggregate) XML for CMS submission."""
    xml = CQMEngine.generate_qrda_category3(
        measure_results=data.get("measure_results", []),
    )
    return {
        "format": "QRDA Category III",
        "xml": xml,
    }
