"""SDOH screening router for ONC criterion (a)(15)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sdoh_screening import SDOHDomain, SDOHReferral, SDOHScreeningResponse
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/sdoh", tags=["Social Determinants of Health"])


# PRAPARE screening questions (simplified subset)
PRAPARE_QUESTIONS: list[dict] = [
    {
        "code": "housing_status",
        "domain": SDOHDomain.housing,
        "question": "What is your housing situation today?",
        "options": [
            {"value": "i_have_housing", "label": "I have housing", "risk": False},
            {"value": "i_do_not_have_housing", "label": "I do not have housing", "risk": True},
            {
                "value": "unstable_housing",
                "label": "Unstable housing (staying with others, temp housing)",
                "risk": True,
            },
        ],
    },
    {
        "code": "food_security",
        "domain": SDOHDomain.food_security,
        "question": "Within the past 12 months, you worried that your food would run out before you got money to buy more.",
        "options": [
            {"value": "often_true", "label": "Often true", "risk": True},
            {"value": "sometimes_true", "label": "Sometimes true", "risk": True},
            {"value": "never_true", "label": "Never true", "risk": False},
        ],
    },
    {
        "code": "transportation",
        "domain": SDOHDomain.transportation,
        "question": "In the past 12 months, has lack of transportation kept you from medical appointments or medications?",
        "options": [
            {"value": "yes", "label": "Yes", "risk": True},
            {"value": "no", "label": "No", "risk": False},
        ],
    },
    {
        "code": "utilities",
        "domain": SDOHDomain.utilities,
        "question": "In the past 12 months, has the electric, gas, oil, or water company threatened to shut off services?",
        "options": [
            {"value": "yes", "label": "Yes", "risk": True},
            {"value": "no", "label": "No", "risk": False},
            {"value": "already_shut_off", "label": "Already shut off", "risk": True},
        ],
    },
    {
        "code": "interpersonal_safety",
        "domain": SDOHDomain.interpersonal_safety,
        "question": "How often does anyone, including family, physically hurt you?",
        "options": [
            {"value": "never", "label": "Never", "risk": False},
            {"value": "rarely", "label": "Rarely", "risk": True},
            {"value": "sometimes", "label": "Sometimes", "risk": True},
            {"value": "fairly_often", "label": "Fairly often", "risk": True},
            {"value": "frequently", "label": "Frequently", "risk": True},
        ],
    },
    {
        "code": "employment",
        "domain": SDOHDomain.employment,
        "question": "What is your current work situation?",
        "options": [
            {"value": "employed_full_time", "label": "Employed full-time", "risk": False},
            {"value": "employed_part_time", "label": "Employed part-time", "risk": False},
            {"value": "unemployed", "label": "Unemployed", "risk": True},
            {"value": "unable_to_work", "label": "Unable to work", "risk": True},
            {"value": "retired", "label": "Retired", "risk": False},
        ],
    },
    {
        "code": "education",
        "domain": SDOHDomain.education,
        "question": "What is the highest level of school you have finished?",
        "options": [
            {"value": "less_than_high_school", "label": "Less than high school", "risk": True},
            {"value": "high_school_ged", "label": "High school or GED", "risk": False},
            {"value": "some_college", "label": "Some college", "risk": False},
            {"value": "college_degree", "label": "College degree or higher", "risk": False},
        ],
    },
]


@router.get("/screening-tools")
async def list_screening_tools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List available SDOH screening tools."""
    return [
        {
            "id": "PRAPARE",
            "name": "Protocol for Responding to and Assessing Patients' Assets, Risks, and Experiences",
            "questions": len(PRAPARE_QUESTIONS),
        },
        {
            "id": "AHC-HRSN",
            "name": "Accountable Health Communities Health-Related Social Needs",
            "questions": 10,
        },
    ]


@router.get("/screening-tools/{tool_id}/questions")
async def get_screening_questions(
    tool_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get questions for a screening tool."""
    if tool_id == "PRAPARE":
        return PRAPARE_QUESTIONS
    raise HTTPException(status_code=404, detail="Screening tool not found")


@router.post("/patients/{patient_id}/screen")
async def submit_sdoh_screening(
    patient_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Submit SDOH screening responses for a patient."""
    responses = data.get("responses", [])
    screening_tool = data.get("tool", "PRAPARE")

    risk_domains = []
    referrals_needed = []

    for resp in responses:
        question = next(
            (q for q in PRAPARE_QUESTIONS if q["code"] == resp.get("question_code")),
            None,
        )
        if not question:
            continue

        option = next(
            (o for o in question["options"] if o["value"] == resp.get("response_value")),
            None,
        )
        is_risk = option["risk"] if option else False

        response = SDOHScreeningResponse(
            patient_id=patient_id,
            screening_tool=screening_tool,
            domain=question["domain"],
            question_code=question["code"],
            question_text=question["question"],
            response_value=resp.get("response_value", ""),
            response_code=resp.get("response_code"),
            risk_flag=is_risk,
            referral_needed=is_risk,
            referral_type=_get_referral_type(question["domain"]) if is_risk else None,
            screened_by=current_user.id,
        )
        db.add(response)

        if is_risk:
            domain_name = question["domain"].value
            if domain_name not in risk_domains:
                risk_domains.append(domain_name)
            referral = _get_referral_type(question["domain"])
            if referral and referral not in referrals_needed:
                referrals_needed.append(referral)

    db.commit()

    return {
        "patient_id": patient_id,
        "screening_tool": screening_tool,
        "total_questions": len(responses),
        "risk_domains": risk_domains,
        "referrals_needed": referrals_needed,
        "status": "completed",
    }


def _get_referral_type(domain: SDOHDomain) -> str | None:
    """Map SDOH domain to referral type."""
    mapping = {
        SDOHDomain.housing: "housing_assistance",
        SDOHDomain.food_security: "food_bank_snap",
        SDOHDomain.transportation: "medical_transportation",
        SDOHDomain.utilities: "utility_assistance",
        SDOHDomain.interpersonal_safety: "domestic_violence_support",
        SDOHDomain.employment: "workforce_development",
        SDOHDomain.education: "adult_education",
        SDOHDomain.social_isolation: "social_services",
        SDOHDomain.stress: "mental_health_counseling",
    }
    return mapping.get(domain)


@router.get("/patients/{patient_id}/screening-history")
async def get_screening_history(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get SDOH screening history for a patient."""
    responses = (
        db.query(SDOHScreeningResponse)
        .filter(SDOHScreeningResponse.patient_id == patient_id)
        .order_by(SDOHScreeningResponse.screened_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "domain": r.domain.value,
            "question": r.question_text,
            "response": r.response_value,
            "risk_flag": r.risk_flag,
            "referral_needed": r.referral_needed,
            "screened_at": r.screened_at.isoformat(),
        }
        for r in responses
    ]


@router.post("/patients/{patient_id}/referrals")
async def create_referral(
    patient_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create an SDOH referral."""
    referral = SDOHReferral(
        patient_id=patient_id,
        domain=data["domain"],
        referral_type=data["referral_type"],
        organization_name=data.get("organization_name"),
        organization_phone=data.get("organization_phone"),
        organization_address=data.get("organization_address"),
        notes=data.get("notes"),
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)
    return {"id": referral.id, "status": "created"}
