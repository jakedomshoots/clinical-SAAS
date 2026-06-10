"""Public health reporting integrations for ONC criteria (a)(10), (a)(11), (f)(2)-(f)(5).

Supports:
- Electronic Case Reporting (eCR) via APHL AIMS
- Syndromic Surveillance via NSSP
- Reportable Lab Results (ELR)
- Cancer Registry reporting (NAACCR)
- Prescription Drug Monitoring Program (PDMP)
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import settings


class PublicHealthClient:
    """Client for public health reporting to state and federal agencies."""

    def __init__(self) -> None:
        self._ecr_url = settings.public_health_ecr_url
        self._syndromic_url = settings.public_health_syndromic_url
        self._elr_url = settings.public_health_elr_url
        self._cancer_registry_url = settings.public_health_cancer_registry_url
        self._pdmp_url = settings.public_health_pdmp_url
        self._api_key = settings.public_health_api_key

    def _client(self, base_url: str) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/fhir+json",
            },
            timeout=60.0,
        )

    # ------------------------------------------------------------------
    # Electronic Case Reporting (eCR) — ONC (a)(10)
    # ------------------------------------------------------------------

    async def submit_case_report(
        self,
        patient_id: str,
        condition_code: str,
        condition_name: str,
        onset_date: str,
        provider_npi: str,
        facility_id: str,
        trigger_reason: str,
    ) -> dict[str, Any]:
        """Submit an electronic case report for a reportable condition.

        Conditions: COVID-19, influenza, TB, hepatitis, STIs, foodborne illness, etc.
        """
        report = {
            "resourceType": "Bundle",
            "id": f"ecr-{patient_id}-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}",
            "type": "document",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Composition",
                        "status": "final",
                        "type": {
                            "coding": [
                                {
                                    "system": "http://loinc.org",
                                    "code": "55751-2",
                                    "display": "Initial Public Health Case Report",
                                }
                            ]
                        },
                        "date": datetime.now(UTC).isoformat(),
                        "author": [{"reference": f"Practitioner/{provider_npi}"}],
                        "title": f"Case Report: {condition_name}",
                    }
                },
                {
                    "resource": {
                        "resourceType": "Condition",
                        "code": {
                            "coding": [
                                {
                                    "system": "http://snomed.info/sct",
                                    "code": condition_code,
                                    "display": condition_name,
                                }
                            ]
                        },
                        "onsetDateTime": onset_date,
                    }
                },
            ],
        }

        if not self._ecr_url:
            return {"status": "demo", "message": "eCR not configured", "condition": condition_name}

        async with self._client(self._ecr_url) as client:
            resp = await client.post("/fhir/Bundle", json=report)
            resp.raise_for_status()
            return {"status": "submitted", "response": resp.json()}

    # ------------------------------------------------------------------
    # Syndromic Surveillance — ONC (a)(11)
    # ------------------------------------------------------------------

    async def submit_syndromic_surveillance(
        self,
        patient_id: str,
        visit_date: str,
        chief_complaint: str,
        diagnosis_codes: list[str],
        facility_id: str,
    ) -> dict[str, Any]:
        """Submit emergency department visit data for syndromic surveillance.

        Sent to CDC NSSP (National Syndromic Surveillance Program) via BioSense.
        """
        message = {
            "resourceType": "Bundle",
            "type": "message",
            "entry": [
                {
                    "resource": {
                        "resourceType": "MessageHeader",
                        "eventCoding": {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0003",
                            "code": "A08",
                            "display": "Update patient information",
                        },
                        "source": {"name": facility_id},
                    }
                },
                {
                    "resource": {
                        "resourceType": "Encounter",
                        "status": "finished",
                        "class": {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                            "code": "EMER",
                        },
                        "period": {"start": visit_date},
                        "reasonCode": [{"text": chief_complaint}],
                    }
                },
            ],
        }

        if not self._syndromic_url:
            return {"status": "demo", "message": "Syndromic surveillance not configured"}

        async with self._client(self._syndromic_url) as client:
            resp = await client.post("/fhir", json=message)
            resp.raise_for_status()
            return {"status": "submitted", "response": resp.json()}

    # ------------------------------------------------------------------
    # Electronic Lab Reporting (ELR) — ONC (f)(3)
    # ------------------------------------------------------------------

    async def submit_reportable_lab_result(
        self,
        patient_id: str,
        test_code: str,
        test_name: str,
        result_value: str,
        result_date: str,
        ordering_provider_npi: str,
        performing_lab_id: str,
    ) -> dict[str, Any]:
        """Submit a reportable lab result to public health.

        Reportable results: positive cultures, STI tests, TB tests, etc.
        """
        observation = {
            "resourceType": "Observation",
            "status": "final",
            "code": {
                "coding": [{"system": "http://loinc.org", "code": test_code, "display": test_name}]
            },
            "valueString": result_value,
            "effectiveDateTime": result_date,
            "performer": [{"reference": f"Organization/{performing_lab_id}"}],
        }

        if not self._elr_url:
            return {"status": "demo", "message": "ELR not configured", "test": test_name}

        async with self._client(self._elr_url) as client:
            resp = await client.post("/fhir/Observation", json=observation)
            resp.raise_for_status()
            return {"status": "submitted", "response": resp.json()}

    # ------------------------------------------------------------------
    # Cancer Registry — ONC (f)(4)
    # ------------------------------------------------------------------

    async def submit_cancer_case(
        self,
        patient_id: str,
        tumor_site: str,
        histology_code: str,
        behavior_code: str,
        diagnosis_date: str,
        staging: dict[str, Any] | None,
        treating_provider_npi: str,
    ) -> dict[str, Any]:
        """Submit cancer case report to state cancer registry.

        Uses NAACCR format via FHIR or HL7 v2.
        """
        report = {
            "resourceType": "Condition",
            "code": {"coding": [{"system": "http://snomed.info/sct", "code": tumor_site}]},
            "onsetDateTime": diagnosis_date,
            "extension": [
                {
                    "url": "http://hl7.org/fhir/us/mcode/StructureDefinition/mcode-histology-morphology-behavior",
                    "valueCodeableConcept": {
                        "coding": [{"system": "http://snomed.info/sct", "code": histology_code}]
                    },
                }
            ],
        }

        if not self._cancer_registry_url:
            return {"status": "demo", "message": "Cancer registry not configured"}

        async with self._client(self._cancer_registry_url) as client:
            resp = await client.post("/fhir/Condition", json=report)
            resp.raise_for_status()
            return {"status": "submitted", "response": resp.json()}

    # ------------------------------------------------------------------
    # Prescription Drug Monitoring Program (PDMP) — ONC (f)(5)
    # ------------------------------------------------------------------

    async def query_pdmp(
        self,
        patient_first_name: str,
        patient_last_name: str,
        patient_dob: str,
        patient_gender: str,
        requesting_provider_npi: str,
        purpose: str = "TREATMENT",
    ) -> dict[str, Any]:
        """Query state PDMP for controlled substance prescription history.

        Required before prescribing Schedule II-V medications in most states.
        """
        query = {
            "resourceType": "Parameters",
            "parameter": [
                {"name": "patientFirstName", "valueString": patient_first_name},
                {"name": "patientLastName", "valueString": patient_last_name},
                {"name": "patientBirthDate", "valueDate": patient_dob},
                {"name": "patientGender", "valueString": patient_gender},
                {"name": "requestingProviderNPI", "valueString": requesting_provider_npi},
                {"name": "purpose", "valueString": purpose},
            ],
        }

        if not self._pdmp_url:
            return {
                "status": "demo",
                "message": "PDMP not configured",
                "recommendation": "Query state PDMP portal directly",
            }

        async with self._client(self._pdmp_url) as client:
            resp = await client.post("/fhir/Parameters/$pdmp-query", json=query)
            resp.raise_for_status()
            return {"status": "queried", "response": resp.json()}

    async def report_pdmp_dispense(
        self,
        patient_id: str,
        medication_code: str,
        medication_name: str,
        quantity: float,
        days_supply: int,
        dispensing_date: str,
        dispensing_provider_npi: str,
        dea_number: str,
    ) -> dict[str, Any]:
        """Report controlled substance dispensation to PDMP.

        Pharmacies do this automatically; prescribers may need to report
        in-office dispensing.
        """
        dispense = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": medication_code,
                        "display": medication_name,
                    }
                ]
            },
            "quantity": {"value": quantity},
            "daysSupply": {"value": days_supply},
            "whenHandedOver": dispensing_date,
            "performer": [{"actor": {"reference": f"Practitioner/{dispensing_provider_npi}"}}],
        }

        if not self._pdmp_url:
            return {"status": "demo", "message": "PDMP not configured"}

        async with self._client(self._pdmp_url) as client:
            resp = await client.post("/fhir/MedicationDispense", json=dispense)
            resp.raise_for_status()
            return {"status": "submitted", "response": resp.json()}
