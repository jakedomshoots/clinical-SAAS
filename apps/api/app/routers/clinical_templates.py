from fastapi import APIRouter

router = APIRouter(prefix="/api/clinical", tags=["clinical"])

ENCOUNTER_TEMPLATES = [
    {
        "id": "office_visit",
        "name": "Office Visit SOAP",
        "encounter_type": "office_visit",
        "subjective": "Chief concern:\nHistory of present illness:\nReview of systems:",
        "objective": "Vitals reviewed.\nExam:",
        "assessment": "Assessment:",
        "plan": "Plan:\nFollow-up:",
    },
    {
        "id": "annual_wellness",
        "name": "Annual Wellness",
        "encounter_type": "annual_wellness",
        "subjective": "Interval history:\nPreventive concerns:",
        "objective": "Vitals reviewed.\nScreenings reviewed:",
        "assessment": "Preventive care assessment:",
        "plan": "Preventive plan:\nOrders/referrals:",
    },
]


@router.get("/encounter-templates")
async def encounter_templates():
    return {"data": ENCOUNTER_TEMPLATES, "total": len(ENCOUNTER_TEMPLATES)}
