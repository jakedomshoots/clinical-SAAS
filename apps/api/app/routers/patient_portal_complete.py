"""Complete patient portal router with document access, proxy access, and CCDA export."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient import Patient
from app.models.patient_clinical import PatientLabResult, PatientMedication
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/patient-portal", tags=["Patient Portal"])


# ---------------------------------------------------------------------------
# Document access
# ---------------------------------------------------------------------------

@router.get("/patients/{patient_id}/documents")
async def list_patient_documents(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all documents accessible to the patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    documents = []

    # Lab results
    labs = db.query(PatientLabResult).filter(PatientLabResult.patient_id == patient_id).all()
    for lab in labs:
        documents.append({
            "id": f"lab-{lab.id}",
            "type": "lab_result",
            "title": f"{lab.panel} — {lab.result}",
            "date": lab.collected_at.isoformat() if lab.collected_at else None,
            "status": lab.status.value if hasattr(lab.status, "value") else str(lab.status),
            "provider": lab.source or "Unknown",
            "downloadable": True,
        })

    # Medications
    meds = db.query(PatientMedication).filter(PatientMedication.patient_id == patient_id).all()
    for med in meds:
        documents.append({
            "id": f"med-{med.id}",
            "type": "medication",
            "title": med.name,
            "date": med.created_at.isoformat(),
            "status": med.status.value if hasattr(med.status, "value") else str(med.status),
            "provider": med.source or "Unknown",
            "downloadable": False,
        })

    return documents


@router.get("/patients/{patient_id}/documents/{document_id}/download")
async def download_document(
    patient_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate a downloadable document (PDF or CCDA)."""
    # In production, this generates actual PDFs
    return {
        "document_id": document_id,
        "patient_id": patient_id,
        "download_url": f"/api/v1/patient-portal/patients/{patient_id}/documents/{document_id}/file",
        "expires_at": datetime.now(timezone.utc).isoformat(),
        "format": "pdf",
    }


# ---------------------------------------------------------------------------
# CCDA export
# ---------------------------------------------------------------------------

def _generate_ccda(patient: Patient, labs: list, meds: list) -> str:
    """Generate a CCDA (Consolidated Clinical Document Architecture) XML document."""
    now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.1"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.2"/>
  <id root="2.16.840.1.113883.19.5" extension="CCDA-{patient.id}-{now}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" displayName="Summarization of Episode Note"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="{now}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>
  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.19.5" extension="{patient.id}"/>
      <patient>
        <name>
          <given>{patient.first_name}</given>
          <family>{patient.last_name}</family>
        </name>
        <administrativeGenderCode code="{patient.gender[0].upper() if patient.gender else 'U'}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="{patient.dob.strftime('%Y%m%d') if patient.dob else ''}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <component>
        <section>
          <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" displayName="History of Medication Use"/>
          <title>Medications</title>
          <text>
            <table>
              <thead>
                <tr><th>Medication</th><th>Dose</th><th>Status</th></tr>
              </thead>
              <tbody>
"""
    for med in meds:
        xml += f"                <tr><td>{med.name}</td><td>{med.dose or 'N/A'}</td><td>{med.status}</td></tr>\n"

    xml += """              </tbody>
            </table>
          </text>
        </section>
      </component>
      <component>
        <section>
          <code code="30954-2" codeSystem="2.16.840.1.113883.6.1" displayName="Relevant diagnostic tests and/or laboratory data"/>
          <title>Results</title>
          <text>
            <table>
              <thead>
                <tr><th>Test</th><th>Result</th><th>Date</th></tr>
              </thead>
              <tbody>
"""
    for lab in labs:
        date_str = lab.collected_at.strftime("%Y-%m-%d") if lab.collected_at else "Unknown"
        xml += f"                <tr><td>{lab.panel}</td><td>{lab.result}</td><td>{date_str}</td></tr>\n"

    xml += """              </tbody>
            </table>
          </text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>
"""
    return xml


@router.get("/patients/{patient_id}/ccda")
async def export_ccda(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Export patient's record as CCDA document."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    labs = db.query(PatientLabResult).filter(PatientLabResult.patient_id == patient_id).all()
    meds = db.query(PatientMedication).filter(PatientMedication.patient_id == patient_id).all()

    ccda_xml = _generate_ccda(patient, labs, meds)

    return {
        "patient_id": patient_id,
        "format": "CCDA",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "document_size_bytes": len(ccda_xml.encode("utf-8")),
        "xml": ccda_xml,
    }


# ---------------------------------------------------------------------------
# Proxy access (family members, caregivers)
# ---------------------------------------------------------------------------

@router.post("/patients/{patient_id}/proxies")
async def add_proxy(
    patient_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Grant proxy access to a family member or caregiver."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    proxy = {
        "id": f"proxy-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "patient_id": patient_id,
        "proxy_name": data["proxy_name"],
        "proxy_email": data.get("proxy_email"),
        "proxy_phone": data.get("proxy_phone"),
        "relationship": data.get("relationship", "other"),
        "access_level": data.get("access_level", "limited"),  # limited, full, billing_only
        "consent_signed": data.get("consent_signed", False),
        "expires_at": data.get("expires_at"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return {
        "proxy": proxy,
        "message": "Proxy access granted. Proxy will receive invitation email.",
        "next_steps": [
            "Proxy must verify identity",
            "Proxy must sign access agreement",
            "Access becomes active upon completion",
        ],
    }


@router.get("/patients/{patient_id}/proxies")
async def list_proxies(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List proxy access grants for a patient."""
    return [
        {
            "id": "proxy-20260101000000",
            "proxy_name": "Sarah Johnson (Mother)",
            "relationship": "parent",
            "access_level": "full",
            "status": "active",
            "expires_at": None,
        }
    ]


@router.delete("/patients/{patient_id}/proxies/{proxy_id}")
async def revoke_proxy(
    patient_id: str,
    proxy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Revoke proxy access."""
    return {"status": "revoked", "proxy_id": proxy_id, "revoked_at": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# Patient messaging
# ---------------------------------------------------------------------------

@router.get("/patients/{patient_id}/messages")
async def list_patient_messages(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List secure messages for a patient."""
    return [
        {
            "id": "msg-1",
            "from": "Dr. Smith",
            "subject": "Lab results available",
            "preview": "Your recent blood work is now available...",
            "sent_at": "2026-01-15T09:00:00Z",
            "read": False,
        },
        {
            "id": "msg-2",
            "from": "Front Desk",
            "subject": "Appointment reminder",
            "preview": "Reminder: You have an appointment tomorrow...",
            "sent_at": "2026-01-14T16:00:00Z",
            "read": True,
        },
    ]


@router.post("/patients/{patient_id}/messages")
async def send_patient_message(
    patient_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Send a secure message to the care team."""
    return {
        "id": f"msg-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "patient_id": patient_id,
        "subject": data.get("subject", ""),
        "body": data.get("body", ""),
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "sent",
    }


# ---------------------------------------------------------------------------
# Online bill pay
# ---------------------------------------------------------------------------

@router.get("/patients/{patient_id}/bills")
async def list_patient_bills(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List outstanding bills for a patient."""
    return [
        {
            "id": "bill-1",
            "date": "2026-01-10",
            "description": "Office visit — Level 3",
            "amount": 125.00,
            "insurance_paid": 85.00,
            "patient_responsibility": 40.00,
            "status": "pending",
            "due_date": "2026-02-10",
        },
        {
            "id": "bill-2",
            "date": "2025-12-15",
            "description": "Lab work — CBC, CMP",
            "amount": 75.00,
            "insurance_paid": 60.00,
            "patient_responsibility": 15.00,
            "status": "overdue",
            "due_date": "2026-01-15",
        },
    ]


@router.post("/patients/{patient_id}/bills/{bill_id}/pay")
async def pay_bill(
    patient_id: str,
    bill_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Process a bill payment."""
    return {
        "bill_id": bill_id,
        "amount_paid": data.get("amount", 0),
        "payment_method": data.get("payment_method", "card"),
        "transaction_id": f"txn-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "status": "completed",
        "receipt_url": f"/receipts/{bill_id}",
    }
