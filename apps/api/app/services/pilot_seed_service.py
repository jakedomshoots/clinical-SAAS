from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingCase
from app.models.fax import Fax, FaxDirection, FaxStatus
from app.models.integration_event import IntegrationEvent, IntegrationEventStatus
from app.models.patient import Patient
from app.models.patient_document import PatientDocument, PatientDocumentStatus
from app.models.portal_intake import PortalIntakeSubmission
from app.models.schedule import Appointment, AppointmentStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.services.auth_service import create_user, generate_temporary_password


async def seed_pilot_workspace(db: AsyncSession, user: User) -> dict:
    org = user.organization_id
    created: list[str] = []

    async def count(model) -> int:
        result = await db.execute(select(func.count(model.id)).where(model.organization_id == org))
        return result.scalar() or 0

    users = await count(User)
    if users < 4:
        existing_emails = {row[0] for row in (await db.execute(select(User.email).where(User.organization_id == org))).all()}
        for email, display_name, role in [
            ("pilot.provider@clinic.example.com", "Pilot Provider", "provider"),
            ("pilot.ma@clinic.example.com", "Pilot MA", "ma"),
            ("pilot.frontdesk@clinic.example.com", "Pilot Front Desk", "front_desk"),
            ("pilot.manager@clinic.example.com", "Pilot Manager", "manager"),
        ]:
            if email not in existing_emails:
                await create_user(
                    db,
                    email,
                    generate_temporary_password(),
                    display_name,
                    role,
                    organization_id=org,
                )
                created.append(f"user:{role}")

    provider = (
        await db.execute(select(User).where(User.organization_id == org, User.role == UserRole.provider).limit(1))
    ).scalar_one_or_none() or user

    patient = (
        await db.execute(select(Patient).where(Patient.organization_id == org).limit(1))
    ).scalar_one_or_none()
    if not patient:
        patient = Patient(
            organization_id=org,
            mrn="MRN-PILOT-001",
            first_name="Pilot",
            last_name="Patient",
            dob=date(1975, 6, 5),
            gender="Unknown",
            phone="555-0100",
            email="pilot.patient@example.com",
            insurance={"provider": "Aetna", "plan": "PPO", "member_id": "PILOT-1"},
            allergies=[],
            problem_list=["Hypertension"],
        )
        db.add(patient)
        await db.commit()
        await db.refresh(patient)
        created.append("patient")

    if await count(Appointment) == 0:
        db.add(Appointment(
            organization_id=org,
            patient_id=patient.id,
            provider_id=provider.id,
            start_time=datetime(2026, 6, 5, 9, 0),
            end_time=datetime(2026, 6, 5, 9, 30),
            type="Pilot visit",
            status=AppointmentStatus.scheduled,
            notes="Seeded pilot appointment.",
        ))
        created.append("appointment")

    if await count(Task) == 0:
        db.add(Task(
            organization_id=org,
            title="Pilot follow-up task",
            description="Confirm pilot workspace workflows are ready.",
            priority=TaskPriority.high,
            status=TaskStatus.open,
            due_date=datetime.now() + timedelta(days=1),
            patient_id=patient.id,
            creator_id=user.id,
        ))
        created.append("task")

    if await count(PatientDocument) == 0:
        db.add(PatientDocument(
            organization_id=org,
            patient_id=patient.id,
            title="Pilot outside note",
            source="Pilot Specialty Clinic",
            document_type="Consult note",
            status=PatientDocumentStatus.needs_review,
            matched_by="pilot seed",
            pages=3,
            file_url="s3://concierge-os/pilot/outside-note.pdf",
            upload_status="uploaded",
            ocr_status="queued",
            summary="Seeded pilot document for review.",
        ))
        created.append("document")

    if await count(Fax) == 0:
        db.add(Fax(
            organization_id=org,
            direction=FaxDirection.inbound,
            status=FaxStatus.received,
            from_number="+13125550100",
            to_number="+13125550999",
            pages=3,
            patient_id=patient.id,
            matched_by="pilot seed",
            ocr_text="Pilot inbound fax.",
        ))
        created.append("fax")

    if await count(PortalIntakeSubmission) == 0:
        db.add(PortalIntakeSubmission(
            organization_id=org,
            patient_id=patient.id,
            source="patient_portal",
            request_type="intake_form",
            submitted_payload={"reason": "Seeded pilot intake update"},
        ))
        created.append("intake")

    if await count(BillingCase) == 0:
        db.add(BillingCase(
            organization_id=org,
            patient_id=patient.id,
            payer="Aetna",
            cpt_codes=["99213"],
            diagnosis_codes=["I10"],
            notes="Seeded pilot billing case.",
        ))
        created.append("billing")

    if await count(IntegrationEvent) == 0:
        db.add(IntegrationEvent(
            organization_id=org,
            integration="calendar",
            direction="outbound",
            action="appointment.create",
            status=IntegrationEventStatus.pending,
            entity_type="appointment",
            entity_id=None,
            idempotency_key="pilot:appointment:create",
            attempts=1,
            payload={"source": "pilot_seed"},
        ))
        created.append("integration_event")

    await db.commit()
    return {"created": created, "created_count": len(created)}
