"""MIPS submission router for Medicare quality reporting automation."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.clinical_quality_measures import CQMEngine
from app.services.mips_submission_service import MIPSMeasureResult, MIPSSubmissionService

router = APIRouter(prefix="/mips", tags=["MIPS"])


@router.get("/timeline/{performance_year}")
async def get_mips_timeline(
    performance_year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get key dates for MIPS submission timeline."""
    service = MIPSSubmissionService()
    return service.get_submission_timeline(performance_year)


@router.post("/calculate")
async def calculate_mips_score(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculate MIPS score from measure results."""
    service = MIPSSubmissionService()

    measure_results = []
    for m in data.get("measures", []):
        points, available, decile = service.calculate_measure_points(
            m["measure_id"],
            m["performance_rate"],
        )
        measure_results.append(
            MIPSMeasureResult(
                measure_id=m["measure_id"],
                measure_name=m.get("measure_name", ""),
                denominator=m["denominator"],
                numerator=m["numerator"],
                exclusions=m.get("exclusions", 0),
                performance_rate=m["performance_rate"],
                benchmark_decile=decile,
                points_earned=points,
                points_available=available,
            )
        )

    return service.calculate_mips_score(
        measure_results=measure_results,
        pi_score=data.get("pi_score", 0),
        ia_score=data.get("ia_score", 0),
        cost_score=data.get("cost_score", 0),
    )


@router.post("/preview")
async def preview_submission(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Preview what will be submitted to CMS without actually submitting."""
    service = MIPSSubmissionService()

    measure_results = []
    for m in data.get("measures", []):
        points, available, decile = service.calculate_measure_points(
            m["measure_id"],
            m["performance_rate"],
        )
        measure_results.append(
            MIPSMeasureResult(
                measure_id=m["measure_id"],
                measure_name=m.get("measure_name", ""),
                denominator=m["denominator"],
                numerator=m["numerator"],
                exclusions=m.get("exclusions", 0),
                performance_rate=m["performance_rate"],
                benchmark_decile=decile,
                points_earned=points,
                points_available=available,
            )
        )

    return service.generate_submission_preview(
        measure_results=measure_results,
        performance_year=data.get("performance_year", 2026),
    )


@router.post("/submit")
async def submit_mips_data(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Submit MIPS quality data to registry."""
    service = MIPSSubmissionService()

    measure_results = []
    for m in data.get("measures", []):
        points, available, decile = service.calculate_measure_points(
            m["measure_id"],
            m["performance_rate"],
        )
        measure_results.append(
            MIPSMeasureResult(
                measure_id=m["measure_id"],
                measure_name=m.get("measure_name", ""),
                denominator=m["denominator"],
                numerator=m["numerator"],
                exclusions=m.get("exclusions", 0),
                performance_rate=m["performance_rate"],
                benchmark_decile=decile,
                points_earned=points,
                points_available=available,
            )
        )

    return await service.submit_to_registry(
        measure_results=measure_results,
        performance_year=data.get("performance_year", 2026),
        submission_method=data.get("submission_method", "registry"),
    )


@router.post("/auto-calculate/{performance_year}")
async def auto_calculate_from_ehr(
    performance_year: int,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Auto-calculate MIPS measures from EHR patient data."""
    patients = data.get("patients", [])
    measure_ids = data.get("measure_ids", ["cms122", "cms165", "cms125", "cms130", "cms138"])

    service = MIPSSubmissionService()
    measure_results = []

    for measure_id in measure_ids:
        result = CQMEngine.calculate_measure(
            measure_id=measure_id,
            patients=patients,
            measurement_period_start=f"{performance_year}-01-01",
            measurement_period_end=f"{performance_year}-12-31",
        )

        if "error" in result:
            continue

        points, available, decile = service.calculate_measure_points(
            measure_id,
            result["performance_rate"],
        )

        measure_results.append(
            MIPSMeasureResult(
                measure_id=measure_id,
                measure_name=result["measure_name"],
                denominator=result["denominator"],
                numerator=result["numerator"],
                exclusions=result["exclusions"],
                performance_rate=result["performance_rate"],
                benchmark_decile=decile,
                points_earned=points,
                points_available=available,
            )
        )

    mips_score = service.calculate_mips_score(measure_results)
    preview = service.generate_submission_preview(measure_results, performance_year)

    return {
        "auto_calculated": True,
        "performance_year": performance_year,
        "measures_calculated": len(measure_results),
        "mips_score": mips_score,
        "submission_preview": preview,
    }
