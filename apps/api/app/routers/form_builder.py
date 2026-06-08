"""Form builder router for creating, managing, and submitting clinical forms."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.form_builder import FormSubmission, FormTemplate, FormTemplateLibrary
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/forms", tags=["Form Builder"])


# ---------------------------------------------------------------------------
# Specialty template library
# ---------------------------------------------------------------------------

SPECIALTY_TEMPLATES: dict[str, list[dict]] = {
    "family_medicine": [
        {
            "name": "Annual Wellness Visit",
            "category": "assessment",
            "fields": [
                {"id": "smoking", "type": "select", "label": "Smoking status", "options": ["Never", "Former", "Current"], "required": True},
                {"id": "exercise", "type": "select", "label": "Exercise frequency", "options": ["None", "1-2x/week", "3-4x/week", "5+ times/week"], "required": True},
                {"id": "depression_screen", "type": "scale_1_10", "label": "Over the past 2 weeks, how often have you felt down?", "required": True},
                {"id": "fall_risk", "type": "yes_no", "label": "Have you fallen in the past year?", "required": True},
            ],
            "scoring_rules": {
                "depression_screen": {"gte": 5, "flag": "depression_risk", "message": "Consider PHQ-9 screening"},
                "fall_risk": {"eq": True, "flag": "fall_risk", "message": "Fall risk assessment indicated"},
            },
        },
    ],
    "pediatrics": [
        {
            "name": "Pediatric Intake",
            "category": "intake",
            "fields": [
                {"id": "birth_history", "type": "textarea", "label": "Birth history / complications", "required": False},
                {"id": "developmental_milestones", "type": "multiselect", "label": "Developmental milestones met", "options": ["Rolling over", "Sitting", "Crawling", "Walking", "First words", "Sentences"], "required": False},
                {"id": "immunizations_up_to_date", "type": "yes_no", "label": "Immunizations up to date?", "required": True},
                {"id": "school_performance", "type": "select", "label": "School performance", "options": ["Excellent", "Good", "Fair", "Poor", "N/A"], "required": False},
            ],
        },
    ],
    "cardiology": [
        {
            "name": "Cardiac Risk Assessment",
            "category": "assessment",
            "fields": [
                {"id": "chest_pain", "type": "yes_no", "label": "Chest pain or discomfort?", "required": True},
                {"id": "chest_pain_details", "type": "textarea", "label": "Describe chest pain", "required": False, "show_if": {"field": "chest_pain", "eq": True}},
                {"id": "shortness_of_breath", "type": "yes_no", "label": "Shortness of breath?", "required": True},
                {"id": "family_history_heart", "type": "yes_no", "label": "Family history of heart disease?", "required": True},
                {"id": "bp_readings", "type": "textarea", "label": "Recent blood pressure readings", "required": False},
            ],
        },
    ],
    "dermatology": [
        {
            "name": "Skin Lesion Assessment",
            "category": "assessment",
            "fields": [
                {"id": "lesion_location", "type": "text", "label": "Location of lesion", "required": True},
                {"id": "lesion_size", "type": "text", "label": "Size (approximate)", "required": True},
                {"id": "lesion_duration", "type": "text", "label": "How long present?", "required": True},
                {"id": "changes_noted", "type": "multiselect", "label": "Changes noted", "options": ["Size increase", "Color change", "Bleeding", "Itching", "Pain"], "required": False},
                {"id": "lesion_photo", "type": "file_upload", "label": "Photo of lesion", "required": False},
                {"id": "drawing", "type": "drawing", "label": "Mark location on body diagram", "required": False},
            ],
        },
    ],
    "orthopedics": [
        {
            "name": "Musculoskeletal Exam",
            "category": "assessment",
            "fields": [
                {"id": "pain_location", "type": "text", "label": "Pain location", "required": True},
                {"id": "pain_scale", "type": "scale_1_10", "label": "Pain level (0-10)", "required": True},
                {"id": "onset", "type": "select", "label": "Onset", "options": ["Sudden", "Gradual"], "required": True},
                {"id": "mechanism", "type": "textarea", "label": "Mechanism of injury", "required": False},
                {"id": "previous_injury", "type": "yes_no", "label": "Previous injury to same area?", "required": True},
            ],
            "scoring_rules": {
                "pain_scale": {"gte": 7, "flag": "severe_pain", "message": "Consider urgent imaging"},
            },
        },
    ],
    "mental_health": [
        {
            "name": "PHQ-9 Depression Screening",
            "category": "assessment",
            "fields": [
                {"id": "q1", "type": "select", "label": "Little interest or pleasure in doing things", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q2", "type": "select", "label": "Feeling down, depressed, or hopeless", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q3", "type": "select", "label": "Trouble falling or staying asleep", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q4", "type": "select", "label": "Feeling tired or having little energy", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q5", "type": "select", "label": "Poor appetite or overeating", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q6", "type": "select", "label": "Feeling bad about yourself", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q7", "type": "select", "label": "Trouble concentrating", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q8", "type": "select", "label": "Moving or speaking slowly OR being fidgety/restless", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
                {"id": "q9", "type": "select", "label": "Thoughts of hurting yourself", "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"], "required": True, "score_map": [0, 1, 2, 3]},
            ],
            "scoring_rules": {
                "_total": [
                    {"gte": 20, "flag": "severe_depression", "message": "Severe depression - consider immediate referral"},
                    {"gte": 15, "flag": "moderately_severe", "message": "Moderately severe depression"},
                    {"gte": 10, "flag": "moderate", "message": "Moderate depression"},
                    {"gte": 5, "flag": "mild", "message": "Mild depression"},
                ],
                "q9": {"gte": 1, "flag": "suicidal_ideation", "message": "URGENT: Suicidal ideation reported"},
            },
        },
    ],
}


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("/templates")
async def list_templates(
    specialty: str | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List custom form templates."""
    query = db.query(FormTemplate).filter(FormTemplate.organization_id == current_user.organization_id)
    if specialty:
        query = query.filter(FormTemplate.specialty == specialty)
    if category:
        query = query.filter(FormTemplate.category == category)
    templates = query.filter(FormTemplate.is_active == True).order_by(FormTemplate.name).all()
    return [{"id": t.id, "name": t.name, "specialty": t.specialty, "category": t.category, "version": t.version} for t in templates]


@router.post("/templates")
async def create_template(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a new form template."""
    template = FormTemplate(
        organization_id=current_user.organization_id,
        name=data["name"],
        description=data.get("description"),
        specialty=data.get("specialty"),
        category=data.get("category", "general"),
        fields=data.get("fields", []),
        conditional_logic=data.get("conditional_logic"),
        scoring_rules=data.get("scoring_rules"),
        created_by_id=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"id": template.id, "name": template.name}


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get a single form template with full field definitions."""
    template = db.query(FormTemplate).filter(
        FormTemplate.id == template_id,
        FormTemplate.organization_id == current_user.organization_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "specialty": template.specialty,
        "category": template.category,
        "fields": template.fields,
        "conditional_logic": template.conditional_logic,
        "scoring_rules": template.scoring_rules,
        "version": template.version,
    }


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Update a form template (creates new version)."""
    template = db.query(FormTemplate).filter(
        FormTemplate.id == template_id,
        FormTemplate.organization_id == current_user.organization_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.name = data.get("name", template.name)
    template.description = data.get("description", template.description)
    template.fields = data.get("fields", template.fields)
    template.conditional_logic = data.get("conditional_logic", template.conditional_logic)
    template.scoring_rules = data.get("scoring_rules", template.scoring_rules)
    template.version += 1
    db.commit()
    return {"id": template.id, "version": template.version}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Soft-delete a form template."""
    template = db.query(FormTemplate).filter(
        FormTemplate.id == template_id,
        FormTemplate.organization_id == current_user.organization_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.is_active = False
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Specialty library
# ---------------------------------------------------------------------------

@router.get("/library/specialties")
async def list_specialties() -> list[str]:
    """List available specialty template categories."""
    return list(SPECIALTY_TEMPLATES.keys())


@router.get("/library/{specialty}")
async def get_specialty_templates(specialty: str) -> list[dict]:
    """Get pre-built templates for a specialty."""
    if specialty not in SPECIALTY_TEMPLATES:
        raise HTTPException(status_code=404, detail="Specialty not found")
    return SPECIALTY_TEMPLATES[specialty]


@router.post("/library/{specialty}/import")
async def import_specialty_template(
    specialty: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Import a pre-built specialty template into the organization's templates."""
    if specialty not in SPECIALTY_TEMPLATES:
        raise HTTPException(status_code=404, detail="Specialty not found")

    template_name = data.get("template_name")
    matching = [t for t in SPECIALTY_TEMPLATES[specialty] if t["name"] == template_name]
    if not matching:
        raise HTTPException(status_code=404, detail="Template not found in library")

    source = matching[0]
    template = FormTemplate(
        organization_id=current_user.organization_id,
        name=source["name"],
        specialty=specialty,
        category=source["category"],
        fields=source["fields"],
        conditional_logic=source.get("conditional_logic"),
        scoring_rules=source.get("scoring_rules"),
        is_system_template=True,
        created_by_id=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"id": template.id, "name": template.name}


# ---------------------------------------------------------------------------
# Form submissions
# ---------------------------------------------------------------------------

def _calculate_scores(fields: list[dict], responses: dict, scoring_rules: dict | None) -> tuple[float | None, list[dict]]:
    """Calculate form scores and risk flags."""
    if not scoring_rules:
        return None, []

    total_score = 0
    flags = []
    score_map: dict[str, int] = {}

    # Build score map from fields with score_map
    for field in fields:
        fid = field["id"]
        if "score_map" in field and fid in responses:
            try:
                idx = field["options"].index(responses[fid])
                score_map[fid] = field["score_map"][idx]
                total_score += score_map[fid]
            except (ValueError, IndexError):
                pass

    # Apply scoring rules
    for field_id, rule in (scoring_rules or {}).items():
        if field_id == "_total":
            # Total score rules (list of thresholds)
            for threshold_rule in rule:
                if "gte" in threshold_rule and total_score >= threshold_rule["gte"]:
                    flags.append({"flag": threshold_rule["flag"], "message": threshold_rule["message"], "score": total_score})
                    break
            continue

        if field_id not in responses:
            continue

        value = responses[field_id]
        if "eq" in rule and value == rule["eq"]:
            flags.append({"flag": rule["flag"], "message": rule["message"]})
        elif "gte" in rule:
            # Handle both direct values and score-mapped values
            check_value = score_map.get(field_id, value)
            try:
                if float(check_value) >= rule["gte"]:
                    flags.append({"flag": rule["flag"], "message": rule["message"], "value": check_value})
            except (TypeError, ValueError):
                pass

    return total_score if score_map else None, flags


@router.post("/submissions")
async def create_submission(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a new form submission."""
    template = db.query(FormTemplate).filter(
        FormTemplate.id == data["template_id"],
        FormTemplate.organization_id == current_user.organization_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    responses = data.get("responses", {})
    score, flags = _calculate_scores(template.fields, responses, template.scoring_rules)

    submission = FormSubmission(
        organization_id=current_user.organization_id,
        template_id=template.id,
        patient_id=data["patient_id"],
        appointment_id=data.get("appointment_id"),
        submitted_by_id=current_user.id,
        submitted_by_patient=data.get("submitted_by_patient", False),
        responses=responses,
        calculated_score=score,
        risk_flags=flags,
        is_complete=data.get("is_complete", True),
        signature_data=data.get("signature_data"),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return {
        "id": submission.id,
        "template_id": submission.template_id,
        "patient_id": submission.patient_id,
        "calculated_score": submission.calculated_score,
        "risk_flags": submission.risk_flags,
        "is_complete": submission.is_complete,
    }


@router.get("/submissions/{submission_id}")
async def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get a form submission."""
    sub = db.query(FormSubmission).filter(
        FormSubmission.id == submission_id,
        FormSubmission.organization_id == current_user.organization_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {
        "id": sub.id,
        "template_id": sub.template_id,
        "patient_id": sub.patient_id,
        "responses": sub.responses,
        "calculated_score": sub.calculated_score,
        "risk_flags": sub.risk_flags,
        "is_complete": sub.is_complete,
        "signed_at": sub.signed_at.isoformat() if sub.signed_at else None,
        "created_at": sub.created_at.isoformat(),
    }


@router.get("/patients/{patient_id}/submissions")
async def list_patient_submissions(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all form submissions for a patient."""
    subs = db.query(FormSubmission).filter(
        FormSubmission.patient_id == patient_id,
        FormSubmission.organization_id == current_user.organization_id,
    ).order_by(FormSubmission.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "template_id": s.template_id,
            "calculated_score": s.calculated_score,
            "risk_flags": s.risk_flags,
            "is_complete": s.is_complete,
            "created_at": s.created_at.isoformat(),
        }
        for s in subs
    ]


@router.post("/submissions/{submission_id}/sign")
async def sign_submission(
    submission_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Add e-signature to a form submission."""
    sub = db.query(FormSubmission).filter(
        FormSubmission.id == submission_id,
        FormSubmission.organization_id == current_user.organization_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    from datetime import datetime, timezone
    sub.signature_data = data.get("signature_data")
    sub.signed_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": sub.id, "signed_at": sub.signed_at.isoformat()}
