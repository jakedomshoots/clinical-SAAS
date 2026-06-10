"""Patient education resource service for ONC criteria (a)(5) and (a)(13).

Provides patient-specific education materials based on diagnoses,
medications, and procedures. Integrates with MedlinePlus, UpToDate
patient education, and custom clinic content.
"""

from __future__ import annotations

from typing import Any


class PatientEducationService:
    """Service for retrieving and matching patient education resources."""

    # Built-in education library (simplified — real implementation fetches from MedlinePlus API)
    EDUCATION_LIBRARY: dict[str, dict[str, Any]] = {
        "diabetes": {
            "title": "Understanding Diabetes",
            "content": "Diabetes is a chronic condition that affects how your body...",
            "source": "MedlinePlus",
            "source_url": "https://medlineplus.gov/diabetes.html",
            "language": "en",
            "reading_level": "6th grade",
            "format": "html",
            "topics": ["overview", "management", "diet", "exercise", "complications"],
        },
        "hypertension": {
            "title": "High Blood Pressure (Hypertension)",
            "content": "High blood pressure is a common condition...",
            "source": "MedlinePlus",
            "source_url": "https://medlineplus.gov/highbloodpressure.html",
            "language": "en",
            "reading_level": "6th grade",
            "format": "html",
            "topics": ["overview", "management", "diet", "exercise", "medications"],
        },
        "depression": {
            "title": "Depression",
            "content": "Depression is a mood disorder that causes persistent sadness...",
            "source": "MedlinePlus",
            "source_url": "https://medlineplus.gov/depression.html",
            "language": "en",
            "reading_level": "6th grade",
            "format": "html",
            "topics": ["overview", "treatment", "therapy", "medications", "self-care"],
        },
        "asthma": {
            "title": "Asthma",
            "content": "Asthma is a chronic lung disease that inflames and narrows airways...",
            "source": "MedlinePlus",
            "source_url": "https://medlineplus.gov/asthma.html",
            "language": "en",
            "reading_level": "6th grade",
            "format": "html",
            "topics": ["overview", "triggers", "inhalers", "action_plan", "emergency"],
        },
        "cholesterol": {
            "title": "High Cholesterol",
            "content": "Cholesterol is a waxy substance found in your blood...",
            "source": "MedlinePlus",
            "source_url": "https://medlineplus.gov/cholesterol.html",
            "language": "en",
            "reading_level": "6th grade",
            "format": "html",
            "topics": ["overview", "diet", "exercise", "medications", "testing"],
        },
        "colonoscopy_prep": {
            "title": "Preparing for Your Colonoscopy",
            "content": "Follow these steps to prepare for your colonoscopy...",
            "source": "Custom",
            "source_url": None,
            "language": "en",
            "reading_level": "6th grade",
            "format": "pdf",
            "topics": ["preparation", "diet", "what_to_expect"],
        },
        "mammogram": {
            "title": "What to Expect During a Mammogram",
            "content": "A mammogram is an X-ray of the breast used to detect breast cancer...",
            "source": "Custom",
            "source_url": None,
            "language": "en",
            "reading_level": "6th grade",
            "format": "html",
            "topics": ["overview", "what_to_expect", "results"],
        },
        "vaccine_info": {
            "title": "Vaccine Information Statements",
            "content": "Vaccines help protect against serious diseases...",
            "source": "CDC",
            "source_url": "https://www.cdc.gov/vaccines/hcp/vis/index.html",
            "language": "en",
            "reading_level": "6th grade",
            "format": "pdf",
            "topics": ["safety", "side_effects", "schedule"],
        },
    }

    # Diagnosis-to-education mapping
    DIAGNOSIS_EDUCATION_MAP: dict[str, list[str]] = {
        "e11": ["diabetes"],
        "e10": ["diabetes"],
        "i10": ["hypertension"],
        "f32": ["depression"],
        "f33": ["depression"],
        "j45": ["asthma"],
        "e78": ["cholesterol"],
    }

    # Procedure-to-education mapping
    PROCEDURE_EDUCATION_MAP: dict[str, list[str]] = {
        "45378": ["colonoscopy_prep"],
        "45385": ["colonoscopy_prep"],
        "77067": ["mammogram"],
    }

    @classmethod
    def get_education_for_diagnosis(cls, icd10_code: str) -> list[dict]:
        """Get education resources for a diagnosis code."""
        code_prefix = icd10_code[:3].lower()
        keys = cls.DIAGNOSIS_EDUCATION_MAP.get(code_prefix, [])
        return [cls.EDUCATION_LIBRARY[k] for k in keys if k in cls.EDUCATION_LIBRARY]

    @classmethod
    def get_education_for_procedure(cls, cpt_code: str) -> list[dict]:
        """Get education resources for a procedure code."""
        keys = cls.PROCEDURE_EDUCATION_MAP.get(cpt_code, [])
        return [cls.EDUCATION_LIBRARY[k] for k in keys if k in cls.EDUCATION_LIBRARY]

    @classmethod
    def get_patient_education_bundle(cls, patient: dict) -> dict[str, Any]:
        """Generate a complete education bundle for a patient."""
        resources = []
        seen_keys = set()

        # Diagnosis-based
        for dx in patient.get("diagnoses", []):
            for resource in cls.get_education_for_diagnosis(dx.get("code", "")):
                key = resource["title"]
                if key not in seen_keys:
                    resources.append(resource)
                    seen_keys.add(key)

        # Procedure-based
        for proc in patient.get("procedures", []):
            for resource in cls.get_education_for_procedure(proc.get("code", "")):
                key = resource["title"]
                if key not in seen_keys:
                    resources.append(resource)
                    seen_keys.add(key)

        # Medication-based (simplified)
        med_education = {
            "metformin": "diabetes",
            "lisinopril": "hypertension",
            "atorvastatin": "cholesterol",
            "albuterol": "asthma",
        }
        for med in patient.get("medications", []):
            med_name = med.get("name", "").lower()
            for key, edu_key in med_education.items():
                if key in med_name and edu_key not in seen_keys:
                    resource = cls.EDUCATION_LIBRARY.get(edu_key)
                    if resource:
                        resources.append(resource)
                        seen_keys.add(edu_key)

        return {
            "patient_id": patient.get("id"),
            "generated_at": __import__("datetime")
            .datetime.now(__import__("datetime").timezone.utc)
            .isoformat(),
            "total_resources": len(resources),
            "resources": resources,
        }

    @classmethod
    def list_all_resources(cls) -> list[dict]:
        """List all available education resources."""
        return [
            {"key": k, "title": v["title"], "source": v["source"], "topics": v["topics"]}
            for k, v in cls.EDUCATION_LIBRARY.items()
        ]
