"""Training router for staff training management.

Provides endpoints for training modules, progress tracking,
and compliance reporting.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.services.training_service import (
    CompetencyLevel,
    Role,
    TrainingModule,
    TrainingService,
)

router = APIRouter(prefix="/training", tags=["training"])


def get_training_service() -> TrainingService:
    """Dependency to get training service."""
    return TrainingService()


@router.get("/items")
async def list_training_items(
    role: Role | None = None,
    module: TrainingModule | None = None,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """List available training items."""
    items = service.get_training_items(role=role, module=module)

    return {
        "data": [
            {
                "id": item.id,
                "module": item.module.value,
                "role": item.role.value,
                "title": item.title,
                "description": item.description,
                "required": item.required,
                "estimated_minutes": item.estimated_minutes,
                "prerequisites": item.prerequisites,
                "validation_steps": item.validation_steps,
            }
            for item in items
        ],
        "total": len(items),
    }


@router.get("/items/{item_id}")
async def get_training_item(
    item_id: str,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Get a specific training item."""
    item = service.get_training_item(item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Training item not found")

    return {
        "id": item.id,
        "module": item.module.value,
        "role": item.role.value,
        "title": item.title,
        "description": item.description,
        "required": item.required,
        "estimated_minutes": item.estimated_minutes,
        "prerequisites": item.prerequisites,
        "validation_steps": item.validation_steps,
        "resources": item.resources,
    }


@router.get("/requirements/{role}")
async def get_role_requirements(
    role: Role,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Get training requirements for a role."""
    return service.get_role_requirements(role)


@router.post("/start")
async def start_training(
    user_id: str,
    user_name: str,
    role: Role,
    module: TrainingModule,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Start a training module."""
    record = service.start_training(user_id, user_name, role, module)
    return record.to_dict()


@router.post("/complete")
async def complete_training(
    user_id: str,
    module: TrainingModule,
    score: float | None = None,
    notes: str = "",
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Mark training as completed."""
    record = service.complete_training(user_id, module, score, notes)

    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")

    return record.to_dict()


@router.post("/validate")
async def validate_competency(
    user_id: str,
    module: TrainingModule,
    validated_by: str,
    level: CompetencyLevel = CompetencyLevel.PROFICIENT,
    evidence: list[str] | None = None,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Validate staff competency."""
    record = service.validate_competency(user_id, module, validated_by, level, evidence)

    if not record:
        raise HTTPException(status_code=404, detail="Training record not found")

    return record.to_dict()


@router.get("/staff/{user_id}/record")
async def get_staff_record(
    user_id: str,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Get training record for a staff member."""
    return service.get_staff_record(user_id)


@router.get("/compliance/report")
async def get_compliance_report(
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Get compliance report for all staff."""
    return service.get_compliance_report()


@router.get("/staff/{user_id}/export")
async def export_training_evidence(
    user_id: str,
    service: TrainingService = Depends(get_training_service),
) -> dict[str, Any]:
    """Export training evidence for compliance."""
    return service.export_training_evidence(user_id)
