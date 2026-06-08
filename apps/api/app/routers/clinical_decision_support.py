"""Clinical Decision Support router for ONC criterion (a)(4)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.clinical_decision_support import CDSEngine

router = APIRouter(prefix="/cds", tags=["Clinical Decision Support"])


@router.get("/rules")
async def list_cds_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all available clinical decision support rules."""
    engine = CDSEngine()
    return engine.list_rules()


@router.post("/evaluate")
async def evaluate_patient(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Evaluate CDS rules for a patient."""
    engine = CDSEngine()
    return engine.evaluate_patient(
        patient=data.get("patient", {}),
        history=data.get("history", []),
    )


@router.get("/rules/{rule_id}")
async def get_cds_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict | None:
    """Get a specific CDS rule."""
    engine = CDSEngine()
    rule = engine.get_rule(rule_id)
    if not rule:
        return None
    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "severity": rule.severity.value,
        "action_type": rule.action_type.value,
        "condition": rule.condition,
        "message": rule.message,
        "suggested_action": rule.suggested_action,
        "reference_url": rule.reference_url,
        "reference_guideline": rule.reference_guideline,
    }
