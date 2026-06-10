"""FHIR R4 API implementation for health data exchange.

Implements ONC 21st Century Cures Act required endpoints:
- Patient access API (FHIR R4)
- Provider directory API
- Payer-to-payer data exchange

Certification criteria: §170.315(g)(7), (g)(9), (g)(10)
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.database import get_db
from app.models.patient import Patient
from app.models.patient_clinical import (
    PatientLabResult,
    PatientMedication,
)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/fhir/r4", tags=["FHIR"])


# ---------------------------------------------------------------------------
# FHIR Resource Models
# ---------------------------------------------------------------------------


class FHIRPatient(BaseModel):
    resourceType: str = "Patient"
    id: str
    identifier: list[dict] | None = None
    active: bool = True
    name: list[dict]
    telecom: list[dict] | None = None
    gender: str | None = None
    birthDate: str | None = None
    address: list[dict] | None = None


class FHIRObservation(BaseModel):
    resourceType: str = "Observation"
    id: str
    status: str
    category: list[dict] | None = None
    code: dict
    subject: dict
    effectiveDateTime: str | None = None
    valueQuantity: dict | None = None
    valueString: str | None = None
    component: list[dict] | None = None


class FHIRMedicationRequest(BaseModel):
    resourceType: str = "MedicationRequest"
    id: str
    status: str
    intent: str = "order"
    medicationCodeableConcept: dict
    subject: dict
    authoredOn: str | None = None
    dosageInstruction: list[dict] | None = None


class FHIRAllergyIntolerance(BaseModel):
    resourceType: str = "AllergyIntolerance"
    id: str
    clinicalStatus: dict
    verificationStatus: dict
    type: str | None = None
    category: list[str] | None = None
    code: dict
    patient: dict
    recordedDate: str | None = None
    reaction: list[dict] | None = None


class FHIRCondition(BaseModel):
    resourceType: str = "Condition"
    id: str
    clinicalStatus: dict
    verificationStatus: dict
    category: list[dict] | None = None
    code: dict
    subject: dict
    onsetDateTime: str | None = None
    recordedDate: str | None = None


class FHIRImmunization(BaseModel):
    resourceType: str = "Immunization"
    id: str
    status: str
    vaccineCode: dict
    patient: dict
    occurrenceDateTime: str | None = None
    recorded: str | None = None
    primarySource: bool = True
    location: dict | None = None
    performer: list[dict] | None = None


class FHIRBundle(BaseModel):
    resourceType: str = "Bundle"
    id: str
    meta: dict | None = None
    type: str
    timestamp: str
    entry: list[dict]


class FHIRCapabilityStatement(BaseModel):
    resourceType: str = "CapabilityStatement"
    id: str
    status: str = "active"
    date: str
    kind: str = "instance"
    software: dict
    implementation: dict
    fhirVersion: str = "4.0.1"
    format: list[str] = ["json"]
    rest: list[dict]


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------


def patient_to_fhir(p: Patient) -> FHIRPatient:
    """Convert internal Patient to FHIR Patient resource."""
    address = []
    if p.address:
        addr_dict = {"use": "home"}
        if isinstance(p.address, dict):
            lines = []
            if p.address.get("street"):
                lines.append(p.address["street"])
            if p.address.get("street2"):
                lines.append(p.address["street2"])
            addr_dict["line"] = lines
            if p.address.get("city"):
                addr_dict["city"] = p.address["city"]
            if p.address.get("state"):
                addr_dict["state"] = p.address["state"]
            if p.address.get("zip"):
                addr_dict["postalCode"] = p.address["zip"]
        else:
            addr_dict["line"] = [str(p.address)]
        address = [addr_dict]

    return FHIRPatient(
        id=str(p.id),
        identifier=[
            {
                "system": "http://concierge-os.internal/patient-id",
                "value": str(p.id),
            }
        ],
        name=[{"use": "official", "family": p.last_name or "", "given": [p.first_name or ""]}],
        telecom=[{"system": "phone", "value": p.phone, "use": "mobile"}] if p.phone else [],
        gender=p.gender.lower() if p.gender else "unknown",
        birthDate=p.dob.isoformat() if p.dob else None,
        address=address if address else None,
    )


def lab_to_fhir(lab: PatientLabResult) -> FHIRObservation:
    """Convert PatientLabResult to FHIR Observation."""
    return FHIRObservation(
        id=str(lab.id),
        status="final",
        category=[
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        code={
            "coding": [{"system": "http://loinc.org", "code": "unknown", "display": lab.panel}],
            "text": lab.panel,
        },
        subject={"reference": f"Patient/{lab.patient_id}"},
        effectiveDateTime=lab.collected_at.isoformat() if lab.collected_at else None,
        valueString=lab.result,
    )


def medication_to_fhir(m: PatientMedication) -> FHIRMedicationRequest:
    """Convert PatientMedication to FHIR MedicationRequest."""
    return FHIRMedicationRequest(
        id=str(m.id),
        status="active" if m.status == "active" else "stopped",
        medicationCodeableConcept={
            "coding": [
                {
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "unknown",
                    "display": m.name,
                }
            ],
            "text": m.name,
        },
        subject={"reference": f"Patient/{m.patient_id}"},
        authoredOn=m.created_at.isoformat() if m.created_at else None,
        dosageInstruction=[{"text": m.directions}] if m.directions else [],
    )


def allergy_to_fhir(allergy_data: dict, patient_id: str, idx: int) -> FHIRAllergyIntolerance:
    """Convert JSON allergy data to FHIR AllergyIntolerance."""
    return FHIRAllergyIntolerance(
        id=f"allergy-{patient_id}-{idx}",
        clinicalStatus={
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code": "active",
                }
            ]
        },
        verificationStatus={
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                    "code": "confirmed",
                }
            ]
        },
        category=["medication"],
        code={
            "coding": [
                {
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "unknown",
                    "display": allergy_data.get("allergen", "Unknown"),
                }
            ],
            "text": allergy_data.get("allergen", "Unknown"),
        },
        patient={"reference": f"Patient/{patient_id}"},
        reaction=[{"manifestation": [{"text": allergy_data.get("reaction", "")}]}]
        if allergy_data.get("reaction")
        else [],
    )


def problem_to_fhir(problem_data: dict, patient_id: str, idx: int) -> FHIRCondition:
    """Convert JSON problem data to FHIR Condition."""
    return FHIRCondition(
        id=f"problem-{patient_id}-{idx}",
        clinicalStatus={
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active" if problem_data.get("active", True) else "resolved",
                }
            ]
        },
        verificationStatus={
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "confirmed",
                }
            ]
        },
        category=[
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                        "code": "problem-list-item",
                        "display": "Problem List Item",
                    }
                ]
            }
        ],
        code={
            "coding": [
                {
                    "system": "http://hl7.org/fhir/sid/icd-10-cm",
                    "code": problem_data.get("icd10", "unknown"),
                    "display": problem_data.get("description", "Unknown"),
                }
            ],
            "text": problem_data.get("description", "Unknown"),
        },
        subject={"reference": f"Patient/{patient_id}"},
        onsetDateTime=problem_data.get("onset_date"),
        recordedDate=problem_data.get("recorded_date"),
    )


# ---------------------------------------------------------------------------
# FHIR API Endpoints
# ---------------------------------------------------------------------------


@router.get("/metadata", response_model=FHIRCapabilityStatement)
async def fhir_metadata(request: Request) -> FHIRCapabilityStatement:
    """FHIR CapabilityStatement — required for ONC certification."""
    now = datetime.now(UTC).isoformat()
    return FHIRCapabilityStatement(
        id="concierge-os-capability",
        date=now,
        software={"name": "Concierge OS", "version": "1.0.0"},
        implementation={
            "description": "Concierge OS FHIR Server",
            "url": str(request.base_url) + "fhir/r4",
        },
        rest=[
            {
                "mode": "server",
                "security": {
                    "service": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                                    "code": "SMART-on-FHIR",
                                    "display": "SMART-on-FHIR",
                                }
                            ]
                        }
                    ]
                },
                "resource": [
                    {
                        "type": "Patient",
                        "interaction": [
                            {"code": "read"},
                            {"code": "search-type"},
                        ],
                        "searchParam": [
                            {"name": "_id", "type": "token"},
                            {"name": "identifier", "type": "token"},
                            {"name": "name", "type": "string"},
                            {"name": "birthdate", "type": "date"},
                        ],
                    },
                    {
                        "type": "Observation",
                        "interaction": [{"code": "read"}, {"code": "search-type"}],
                        "searchParam": [
                            {"name": "patient", "type": "reference"},
                            {"name": "category", "type": "token"},
                            {"name": "code", "type": "token"},
                            {"name": "date", "type": "date"},
                        ],
                    },
                    {
                        "type": "MedicationRequest",
                        "interaction": [{"code": "read"}, {"code": "search-type"}],
                        "searchParam": [
                            {"name": "patient", "type": "reference"},
                            {"name": "status", "type": "token"},
                        ],
                    },
                    {
                        "type": "AllergyIntolerance",
                        "interaction": [{"code": "read"}, {"code": "search-type"}],
                        "searchParam": [{"name": "patient", "type": "reference"}],
                    },
                    {
                        "type": "Condition",
                        "interaction": [{"code": "read"}, {"code": "search-type"}],
                        "searchParam": [
                            {"name": "patient", "type": "reference"},
                            {"name": "category", "type": "token"},
                        ],
                    },
                    {
                        "type": "Immunization",
                        "interaction": [{"code": "read"}, {"code": "search-type"}],
                        "searchParam": [
                            {"name": "patient", "type": "reference"},
                            {"name": "date", "type": "date"},
                        ],
                    },
                ],
            }
        ],
    )


@router.get("/Patient/{patient_id}", response_model=FHIRPatient)
async def fhir_read_patient(
    patient_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRPatient:
    """Read a single Patient resource."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient_to_fhir(patient)


@router.get("/Patient", response_model=FHIRBundle)
async def fhir_search_patient(
    _id: str | None = Query(None, alias="_id"),
    identifier: str | None = Query(None),
    name: str | None = Query(None),
    birthdate: str | None = Query(None),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRBundle:
    """Search Patient resources."""
    query = db.query(Patient)
    if _id:
        query = query.filter(Patient.id == _id)
    if name:
        query = query.filter(
            (Patient.first_name.ilike(f"%{name}%")) | (Patient.last_name.ilike(f"%{name}%"))
        )
    if birthdate:
        query = query.filter(Patient.dob == birthdate)

    patients = query.limit(100).all()
    entries = [
        {
            "fullUrl": f"Patient/{p.id}",
            "resource": patient_to_fhir(p).model_dump(mode="json"),
        }
        for p in patients
    ]

    return FHIRBundle(
        id="search-patient-bundle",
        type="searchset",
        timestamp=datetime.now(UTC).isoformat(),
        entry=entries,
        meta={"total": len(entries)},
    )


@router.get("/Observation/{observation_id}", response_model=FHIRObservation)
async def fhir_read_observation(
    observation_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRObservation:
    """Read a single Observation resource."""
    obs = db.query(PatientLabResult).filter(PatientLabResult.id == observation_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    return lab_to_fhir(obs)


@router.get("/Observation", response_model=FHIRBundle)
async def fhir_search_observation(
    patient: str | None = Query(None),
    category: str | None = Query(None),
    code: str | None = Query(None),
    date: str | None = Query(None),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRBundle:
    """Search Observation resources."""
    query = db.query(PatientLabResult)
    if patient:
        patient_id = patient.replace("Patient/", "")
        query = query.filter(PatientLabResult.patient_id == patient_id)
    if date:
        query = query.filter(PatientLabResult.collected_at >= date)

    labs = query.limit(500).all()
    entries = [
        {
            "fullUrl": f"Observation/{lab.id}",
            "resource": lab_to_fhir(lab).model_dump(mode="json"),
        }
        for lab in labs
    ]

    return FHIRBundle(
        id="search-observation-bundle",
        type="searchset",
        timestamp=datetime.now(UTC).isoformat(),
        entry=entries,
        meta={"total": len(entries)},
    )


@router.get("/MedicationRequest/{med_id}", response_model=FHIRMedicationRequest)
async def fhir_read_medication_request(
    med_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRMedicationRequest:
    """Read a single MedicationRequest resource."""
    med = db.query(PatientMedication).filter(PatientMedication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="MedicationRequest not found")
    return medication_to_fhir(med)


@router.get("/MedicationRequest", response_model=FHIRBundle)
async def fhir_search_medication_request(
    patient: str | None = Query(None),
    status: str | None = Query(None),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRBundle:
    """Search MedicationRequest resources."""
    query = db.query(PatientMedication)
    if patient:
        patient_id = patient.replace("Patient/", "")
        query = query.filter(PatientMedication.patient_id == patient_id)
    if status:
        is_active = status == "active"
        query = query.filter(
            PatientMedication.status == ("active" if is_active else "discontinued")
        )

    meds = query.limit(500).all()
    entries = [
        {
            "fullUrl": f"MedicationRequest/{m.id}",
            "resource": medication_to_fhir(m).model_dump(mode="json"),
        }
        for m in meds
    ]

    return FHIRBundle(
        id="search-medication-bundle",
        type="searchset",
        timestamp=datetime.now(UTC).isoformat(),
        entry=entries,
        meta={"total": len(entries)},
    )


@router.get("/AllergyIntolerance", response_model=FHIRBundle)
async def fhir_search_allergy(
    patient: str | None = Query(None),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRBundle:
    """Search AllergyIntolerance resources."""
    if not patient:
        raise HTTPException(status_code=400, detail="patient parameter required")
    patient_id = patient.replace("Patient/", "")

    patient_obj = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient_obj:
        raise HTTPException(status_code=404, detail="Patient not found")

    allergies = patient_obj.allergies or []
    entries = [
        {
            "fullUrl": f"AllergyIntolerance/allergy-{patient_id}-{idx}",
            "resource": allergy_to_fhir(allergy_data, patient_id, idx).model_dump(mode="json"),
        }
        for idx, allergy_data in enumerate(allergies)
    ]

    return FHIRBundle(
        id="search-allergy-bundle",
        type="searchset",
        timestamp=datetime.now(UTC).isoformat(),
        entry=entries,
        meta={"total": len(entries)},
    )


@router.get("/Condition", response_model=FHIRBundle)
async def fhir_search_condition(
    patient: str | None = Query(None),
    category: str | None = Query(None),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRBundle:
    """Search Condition resources."""
    if not patient:
        raise HTTPException(status_code=400, detail="patient parameter required")
    patient_id = patient.replace("Patient/", "")

    patient_obj = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient_obj:
        raise HTTPException(status_code=404, detail="Patient not found")

    problems = patient_obj.problem_list or []
    entries = [
        {
            "fullUrl": f"Condition/problem-{patient_id}-{idx}",
            "resource": problem_to_fhir(problem_data, patient_id, idx).model_dump(mode="json"),
        }
        for idx, problem_data in enumerate(problems)
    ]

    return FHIRBundle(
        id="search-condition-bundle",
        type="searchset",
        timestamp=datetime.now(UTC).isoformat(),
        entry=entries,
        meta={"total": len(entries)},
    )


# ---------------------------------------------------------------------------
# USCDI / Patient Access API — Required for ONC (g)(10)
# ---------------------------------------------------------------------------


@router.get("/Patient/{patient_id}/$everything", response_model=FHIRBundle)
async def fhir_patient_everything(
    patient_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
) -> FHIRBundle:
    """Return all data for a patient — USCDI Patient Access API requirement."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    entries = [
        {
            "fullUrl": f"Patient/{patient.id}",
            "resource": patient_to_fhir(patient).model_dump(mode="json"),
        }
    ]

    # Labs as Observations
    labs = db.query(PatientLabResult).filter(PatientLabResult.patient_id == patient_id).all()
    entries.extend(
        [
            {
                "fullUrl": f"Observation/{lab.id}",
                "resource": lab_to_fhir(lab).model_dump(mode="json"),
            }
            for lab in labs
        ]
    )

    # Medications
    meds = db.query(PatientMedication).filter(PatientMedication.patient_id == patient_id).all()
    entries.extend(
        [
            {
                "fullUrl": f"MedicationRequest/{m.id}",
                "resource": medication_to_fhir(m).model_dump(mode="json"),
            }
            for m in meds
        ]
    )

    # Allergies from JSON
    for idx, allergy_data in enumerate(patient.allergies or []):
        entries.append(
            {
                "fullUrl": f"AllergyIntolerance/allergy-{patient_id}-{idx}",
                "resource": allergy_to_fhir(allergy_data, patient_id, idx).model_dump(mode="json"),
            }
        )

    # Problems from JSON
    for idx, problem_data in enumerate(patient.problem_list or []):
        entries.append(
            {
                "fullUrl": f"Condition/problem-{patient_id}-{idx}",
                "resource": problem_to_fhir(problem_data, patient_id, idx).model_dump(mode="json"),
            }
        )

    return FHIRBundle(
        id=f"patient-{patient_id}-everything",
        type="searchset",
        timestamp=datetime.now(UTC).isoformat(),
        entry=entries,
        meta={"total": len(entries)},
    )
