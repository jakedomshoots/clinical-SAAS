from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.billing import BillingCase, BillingStatus
from app.models.integration_event import IntegrationEvent
from app.models.patient import Patient
from app.models.patient_clinical import EncounterStatus, PatientEncounter
from app.models.user import User
from app.services.audit_service import log_event
from app.services.integration_event_service import record_event


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def list_cases(db: AsyncSession, user: User) -> tuple[list[BillingCase], int]:
    query = select(BillingCase).where(BillingCase.organization_id == user.organization_id)
    countq = select(func.count(BillingCase.id)).where(
        BillingCase.organization_id == user.organization_id
    )
    total = (await db.execute(countq)).scalar() or 0
    result = await db.execute(query.order_by(BillingCase.created_at.desc()).limit(100))
    return list(result.scalars().all()), total


async def work_queue(db: AsyncSession, user: User) -> dict:
    rows = list(
        (
            await db.execute(
                select(BillingCase).where(BillingCase.organization_id == user.organization_id)
            )
        )
        .scalars()
        .all()
    )
    readiness = [_claim_readiness(case) for case in rows]
    return {
        "draft_count": sum(1 for case in rows if case.status == BillingStatus.draft),
        "ready_count": sum(1 for case in rows if case.status == BillingStatus.ready),
        "submitted_count": sum(1 for case in rows if case.status == BillingStatus.submitted),
        "denied_count": sum(1 for case in rows if case.status == BillingStatus.denied),
        "paid_count": sum(1 for case in rows if case.status == BillingStatus.paid),
        "missing_coding_count": sum(
            1
            for item in readiness
            if "CPT codes are required." in item["blockers"]
            or "Diagnosis codes are required." in item["blockers"]
        ),
        "eligibility_needed_count": sum(
            1
            for item in readiness
            if "Eligibility must be checked and eligible." in item["blockers"]
        ),
        "denial_rework_count": sum(
            1 for case in rows if case.status == BillingStatus.denied and not case.denial_worked_at
        ),
        "remittance_pending_count": sum(
            1
            for case in rows
            if case.status == BillingStatus.submitted and case.remittance_status == "not_received"
        ),
        "total": len(rows),
    }


async def list_charge_review(db: AsyncSession, user: User) -> tuple[list[dict], int]:
    billed_encounters = select(BillingCase.appointment_id).where(
        BillingCase.organization_id == user.organization_id,
        BillingCase.appointment_id.is_not(None),
    )
    result = await db.execute(
        select(PatientEncounter, Patient)
        .join(Patient, Patient.id == PatientEncounter.patient_id)
        .where(
            PatientEncounter.organization_id == user.organization_id,
            PatientEncounter.status == EncounterStatus.signed,
            PatientEncounter.appointment_id.not_in(billed_encounters),
        )
        .order_by(
            PatientEncounter.signed_at.desc().nulls_last(), PatientEncounter.updated_at.desc()
        )
        .limit(100)
    )
    rows = []
    for encounter, patient in result.all():
        rows.append(
            {
                "encounter_id": encounter.id,
                "patient_id": encounter.patient_id,
                "patient_name": f"{patient.first_name} {patient.last_name}",
                "appointment_id": encounter.appointment_id,
                "encounter_type": encounter.encounter_type,
                "signed_at": encounter.signed_at,
                "summary": encounter.summary,
                "recommended_cpt_codes": ["99213"],
                "recommended_diagnosis_codes": [],
            }
        )
    return rows, len(rows)


async def create_case(db: AsyncSession, user: User, data: dict) -> BillingCase | None:
    patient = (
        await db.execute(
            select(Patient.id).where(
                Patient.id == data["patient_id"], Patient.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not patient:
        return None
    case = BillingCase(organization_id=user.organization_id, **data)
    if not case.payer:
        patient_row = (
            await db.execute(select(Patient).where(Patient.id == data["patient_id"]))
        ).scalar_one()
        case.payer = (patient_row.insurance or {}).get("provider")
    db.add(case)
    await db.commit()
    await db.refresh(case)
    await log_event(
        db,
        "billing.case_created",
        "billing_case",
        case.id,
        actor_id=user.id,
        payload={"patient_id": case.patient_id},
    )
    return case


async def create_case_from_encounter(
    db: AsyncSession, user: User, encounter_id: str
) -> BillingCase | None:
    encounter = (
        await db.execute(
            select(PatientEncounter).where(
                PatientEncounter.id == encounter_id,
                PatientEncounter.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not encounter:
        return None
    existing = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.organization_id == user.organization_id,
                BillingCase.patient_id == encounter.patient_id,
                BillingCase.appointment_id == encounter.appointment_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    return await create_case(
        db,
        user,
        {
            "patient_id": encounter.patient_id,
            "appointment_id": encounter.appointment_id,
            "cpt_codes": ["99213"],
            "diagnosis_codes": [],
            "notes": f"Charge capture from {encounter.encounter_type} encounter.",
        },
    )


async def check_eligibility(db: AsyncSession, user: User, patient_id: str) -> dict | None:
    patient = (
        await db.execute(
            select(Patient).where(
                Patient.id == patient_id, Patient.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not patient:
        return None
    payer = (patient.insurance or {}).get("provider")
    status = "eligible" if payer else "missing_insurance"
    result = await db.execute(
        select(BillingCase).where(
            BillingCase.organization_id == user.organization_id,
            BillingCase.patient_id == patient.id,
            BillingCase.status == BillingStatus.draft,
        )
    )
    for case in result.scalars().all():
        case.eligibility_status = status
    await db.commit()
    await log_event(
        db,
        "billing.eligibility_checked",
        "patient",
        patient.id,
        actor_id=user.id,
        payload={"payer": payer, "status": status},
    )
    return {
        "patient_id": patient.id,
        "payer": payer,
        "status": status,
        "reference_id": f"demo-elig-{patient.id[-6:]}",
        "message": "Demo eligibility staged. Configure a payer clearinghouse before live use."
        if payer
        else "Insurance is missing from chart.",
    }


async def eligibility_history(
    db: AsyncSession, user: User, patient_id: str
) -> tuple[list[AuditLog], int]:
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.event_type == "billing.eligibility_checked",
            AuditLog.entity_type == "patient",
            AuditLog.entity_id == patient_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    rows = list(result.scalars().all())
    return rows, len(rows)


async def update_case(db: AsyncSession, user: User, case_id: str, data: dict) -> BillingCase | None:
    case = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not case:
        return None
    for field, value in data.items():
        if hasattr(case, field) and value is not None:
            setattr(case, field, BillingStatus(value) if field == "status" else value)
    readiness = _claim_readiness(case)
    if readiness["ready"] and case.status in {BillingStatus.draft, BillingStatus.ready}:
        case.status = BillingStatus.ready
        case.submission_ready_at = case.submission_ready_at or _utcnow()
    await db.commit()
    await db.refresh(case)
    await log_event(
        db,
        "billing.case_updated",
        "billing_case",
        case.id,
        actor_id=user.id,
        payload={"updated_fields": list(data.keys())},
    )
    return case


async def claim_readiness(db: AsyncSession, user: User, case_id: str) -> dict | None:
    case = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not case:
        return None
    return _claim_readiness(case)


async def case_timeline(
    db: AsyncSession, user: User, case_id: str
) -> tuple[list[dict], int] | None:
    exists = (
        await db.execute(
            select(BillingCase.id).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not exists:
        return None
    audit_result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.organization_id == user.organization_id,
            AuditLog.entity_type == "billing_case",
            AuditLog.entity_id == case_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    integration_result = await db.execute(
        select(IntegrationEvent)
        .where(
            IntegrationEvent.organization_id == user.organization_id,
            IntegrationEvent.entity_type == "billing_case",
            IntegrationEvent.entity_id == case_id,
        )
        .order_by(IntegrationEvent.created_at.desc())
        .limit(100)
    )
    rows = [
        {
            "id": item.id,
            "source": "audit",
            "event_type": item.event_type,
            "entity_type": item.entity_type,
            "entity_id": item.entity_id,
            "actor_id": item.actor_id,
            "payload": item.payload,
            "created_at": item.created_at,
            "status": None,
        }
        for item in audit_result.scalars().all()
    ]
    rows.extend(
        {
            "id": item.id,
            "source": "integration",
            "event_type": f"{item.integration}.{item.action}",
            "entity_type": item.entity_type or "integration_event",
            "entity_id": item.entity_id or item.id,
            "actor_id": None,
            "payload": item.payload,
            "created_at": item.created_at,
            "status": item.status.value,
        }
        for item in integration_result.scalars().all()
    )
    rows.sort(key=lambda item: item["created_at"], reverse=True)
    return rows, len(rows)


async def submit_case(db: AsyncSession, user: User, case_id: str) -> BillingCase | None:
    case = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not case:
        return None
    readiness = _claim_readiness(case)
    if not readiness["ready"]:
        raise ValueError(f"Claim is not ready for submission: {'; '.join(readiness['blockers'])}")
    case.status = BillingStatus.submitted
    case.submission_ready_at = case.submission_ready_at or _utcnow()
    case.submitted_at = _utcnow()
    case.claim_control_number = case.claim_control_number or f"DEMO-CLM-{case.id[-8:].upper()}"
    case.remittance_status = "not_received"
    case.notes = "\n".join(filter(None, [case.notes, "Claim staged for clearinghouse submission."]))
    await db.commit()
    await db.refresh(case)
    await log_event(
        db,
        "billing.claim_submitted",
        "billing_case",
        case.id,
        actor_id=user.id,
        payload={
            "patient_id": case.patient_id,
            "payer": case.payer,
            "claim_control_number": case.claim_control_number,
        },
    )
    await record_event(
        db,
        user,
        integration="clearinghouse",
        direction="outbound",
        action="claim.submit",
        status="pending",
        entity_type="billing_case",
        entity_id=case.id,
        idempotency_key=f"claim:submit:{case.id}",
        payload={
            "patient_id": case.patient_id,
            "payer": case.payer,
            "cpt_codes": case.cpt_codes,
            "claim_control_number": case.claim_control_number,
        },
    )
    return case


async def record_payment(
    db: AsyncSession, user: User, case_id: str, data: dict | None = None
) -> BillingCase | None:
    case = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not case:
        return None
    data = data or {}
    case.status = BillingStatus.paid
    case.remittance_status = data.get("remittance_status") or "received"
    case.allowed_amount = data.get("allowed_amount", case.allowed_amount)
    case.paid_amount = data.get("paid_amount", case.paid_amount)
    case.paid_at = _utcnow()
    case.notes = "\n".join(filter(None, [case.notes, data.get("notes") or "Payment recorded."]))
    await db.commit()
    await db.refresh(case)
    await log_event(
        db,
        "billing.payment_recorded",
        "billing_case",
        case.id,
        actor_id=user.id,
        payload={
            "patient_id": case.patient_id,
            "paid_amount": case.paid_amount,
            "remittance_status": case.remittance_status,
        },
    )
    return case


async def deny_case(
    db: AsyncSession, user: User, case_id: str, reason: str | None = None
) -> BillingCase | None:
    case = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not case:
        return None
    case.status = BillingStatus.denied
    case.denied_at = _utcnow()
    case.denial_reason = reason or "Denial received and queued for follow-up."
    case.notes = "\n".join(filter(None, [case.notes, case.denial_reason]))
    await db.commit()
    await db.refresh(case)
    await log_event(
        db,
        "billing.claim_denied",
        "billing_case",
        case.id,
        actor_id=user.id,
        payload={"patient_id": case.patient_id, "reason": reason},
    )
    return case


async def rework_denial(
    db: AsyncSession, user: User, case_id: str, notes: str | None = None
) -> BillingCase | None:
    case = (
        await db.execute(
            select(BillingCase).where(
                BillingCase.id == case_id, BillingCase.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if not case:
        return None
    case.denial_worked_at = _utcnow()
    case.notes = "\n".join(
        filter(None, [case.notes, notes or "Denial worked and ready to resubmit."])
    )
    readiness = _claim_readiness(case)
    case.status = BillingStatus.ready if readiness["ready"] else BillingStatus.draft
    if readiness["ready"]:
        case.submission_ready_at = _utcnow()
    await db.commit()
    await db.refresh(case)
    await log_event(
        db,
        "billing.denial_reworked",
        "billing_case",
        case.id,
        actor_id=user.id,
        payload={"patient_id": case.patient_id, "ready": readiness["ready"]},
    )
    return case


def _claim_readiness(case: BillingCase) -> dict:
    blockers: list[str] = []
    warnings: list[str] = []
    if not case.payer:
        blockers.append("Payer is required.")
    if not case.cpt_codes:
        blockers.append("CPT codes are required.")
    if not case.diagnosis_codes:
        blockers.append("Diagnosis codes are required.")
    if case.eligibility_status != "eligible":
        blockers.append("Eligibility must be checked and eligible.")
    if case.status == BillingStatus.denied and not case.denial_worked_at:
        blockers.append("Denied claim must be reworked before resubmission.")
    if not case.appointment_id:
        warnings.append("No appointment is linked to this case.")

    ready = len(blockers) == 0
    if ready:
        next_step = "Submit claim to the configured clearinghouse."
    elif "Eligibility must be checked and eligible." in blockers:
        next_step = "Run eligibility check before submission."
    elif "Denied claim must be reworked before resubmission." in blockers:
        next_step = "Work the denial and document rework notes."
    else:
        next_step = "Complete payer and coding fields."
    return {
        "case_id": case.id,
        "ready": ready,
        "blockers": blockers,
        "warnings": warnings,
        "recommended_next_step": next_step,
    }
