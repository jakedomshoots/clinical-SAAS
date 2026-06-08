"""Clinical Quality Measures (CQM) engine for ONC criteria (c)(1)-(c)(3).

Implements eCQM (electronic Clinical Quality Measures) calculation
using FHIR-based logic. Supports QRDA Category I (individual patient)
and Category III (aggregate) export for CMS reporting.

Common CQMs: HbA1c control, BP control, breast cancer screening,
colon cancer screening, tobacco cessation, etc.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any


class CQMStatus(str, Enum):
    numerator = "numerator"      # Met the measure
    denominator = "denominator"  # Eligible but not met
    exclusion = "exclusion"      # Excluded from denominator
    not_eligible = "not_eligible"


@dataclass
class CQMeasure:
    id: str
    name: str
    description: str
    nqf_number: str | None
    cms_number: str | None
    category: str  # preventive, chronic, acute, etc.
    denominator_criteria: str
    numerator_criteria: str
    exclusion_criteria: str | None
    time_period_months: int


class CQMEngine:
    """Engine for calculating clinical quality measures."""

    MEASURES: list[CQMeasure] = [
        CQMeasure(
            id="cms122",
            name="Diabetes: Hemoglobin A1c (HbA1c) Poor Control (>9%)",
            description="Percentage of patients 18-75 with diabetes whose HbA1c > 9.0%",
            nqf_number="0059",
            cms_number="CMS122v12",
            category="chronic",
            denominator_criteria="Age 18-75, diabetes diagnosis, 2+ visits in measurement period",
            numerator_criteria="Most recent HbA1c > 9.0% in measurement period",
            exclusion_criteria="Hospice, pregnancy, advanced CKD stage 5",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms165",
            name="Controlling High Blood Pressure",
            description="Percentage of patients 18-85 with hypertension whose BP < 140/90",
            nqf_number="0018",
            cms_number="CMS165v12",
            category="chronic",
            denominator_criteria="Age 18-85, hypertension diagnosis, 2+ visits in measurement period",
            numerator_criteria="Most recent BP < 140/90 mmHg",
            exclusion_criteria="Hospice, ESRD, pregnancy",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms125",
            name="Breast Cancer Screening",
            description="Percentage of women 50-74 who had mammogram in past 2 years",
            nqf_number="2372",
            cms_number="CMS125v12",
            category="preventive",
            denominator_criteria="Women age 50-74, not bilateral mastectomy",
            numerator_criteria="Mammogram in past 2 years",
            exclusion_criteria="Bilateral mastectomy, hospice",
            time_period_months=24,
        ),
        CQMeasure(
            id="cms130",
            name="Colorectal Cancer Screening",
            description="Percentage of adults 45-75 with appropriate screening",
            nqf_number="0034",
            cms_number="CMS130v12",
            category="preventive",
            denominator_criteria="Adults age 45-75",
            numerator_criteria="Colonoscopy in 10 years, FIT in 1 year, or sigmoidoscopy in 5 years",
            exclusion_criteria="Hospice, total colectomy",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms138",
            name="Preventive Care and Screening: Tobacco Use",
            description="Percentage of patients screened for tobacco use and cessation intervention",
            nqf_number="0028",
            cms_number="CMS138v12",
            category="preventive",
            denominator_criteria="Patients age >= 12",
            numerator_criteria="Tobacco use screened AND cessation intervention if user",
            exclusion_criteria=None,
            time_period_months=24,
        ),
        CQMeasure(
            id="cms147",
            name="Preventive Care and Screening: Influenza Immunization",
            description="Percentage of patients >= 6 months who received flu vaccine",
            nqf_number="0041",
            cms_number="CMS147v13",
            category="preventive",
            denominator_criteria="Patients age >= 6 months, visit during flu season",
            numerator_criteria="Influenza vaccination during flu season",
            exclusion_criteria="Allergy to vaccine, medical contraindication",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms127",
            name="Pneumococcal Vaccination",
            description="Percentage of adults >= 65 who received pneumococcal vaccine",
            nqf_number="0043",
            cms_number="CMS127v13",
            category="preventive",
            denominator_criteria="Adults age >= 65",
            numerator_criteria="Pneumococcal vaccination (PCV20 or PCV15 + PPSV23)",
            exclusion_criteria="Allergy, medical contraindication",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms117",
            name="Childhood Immunization Status",
            description="Percentage of children 2 years with recommended vaccines",
            nqf_number="0038",
            cms_number="CMS117v12",
            category="preventive",
            denominator_criteria="Children who turn 2 during measurement period",
            numerator_criteria="DTaP, IPV, MMR, HiB, HepB, VZV, PCV, HepA, RV, flu vaccines",
            exclusion_criteria="Medical contraindication",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms131",
            name="Diabetes: Eye Exam",
            description="Percentage of diabetic patients with retinal eye exam",
            nqf_number="0055",
            cms_number="CMS131v12",
            category="chronic",
            denominator_criteria="Patients 18-75 with diabetes",
            numerator_criteria="Dilated eye exam or retinal imaging in past 12 months",
            exclusion_criteria="Hospice, pregnancy",
            time_period_months=12,
        ),
        CQMeasure(
            id="cms134",
            name="Diabetes: Medical Attention for Nephropathy",
            description="Percentage of diabetic patients with nephropathy screening",
            nqf_number="0062",
            cms_number="CMS134v12",
            category="chronic",
            denominator_criteria="Patients 18-75 with diabetes",
            numerator_criteria="Urine albumin test or ACE/ARB therapy in past 12 months",
            exclusion_criteria="Hospice, ESRD, pregnancy",
            time_period_months=12,
        ),
    ]

    @classmethod
    def list_measures(cls) -> list[dict]:
        """List all available CQMs."""
        return [
            {
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "nqf_number": m.nqf_number,
                "cms_number": m.cms_number,
                "category": m.category,
                "time_period_months": m.time_period_months,
            }
            for m in cls.MEASURES
        ]

    @classmethod
    def get_measure(cls, measure_id: str) -> CQMeasure | None:
        """Get a specific measure by ID."""
        for m in cls.MEASURES:
            if m.id == measure_id:
                return m
        return None

    @classmethod
    def calculate_measure(
        cls,
        measure_id: str,
        patients: list[dict],
        measurement_period_start: str,
        measurement_period_end: str,
    ) -> dict[str, Any]:
        """Calculate a CQM for a population of patients."""
        measure = cls.get_measure(measure_id)
        if not measure:
            return {"error": f"Measure {measure_id} not found"}

        denominator = 0
        numerator = 0
        exclusions = 0
        patient_results = []

        for patient in patients:
            result = cls._evaluate_patient_for_measure(
                patient, measure, measurement_period_start, measurement_period_end
            )
            patient_results.append(result)

            if result["status"] == CQMStatus.exclusion:
                exclusions += 1
            elif result["status"] == CQMStatus.denominator:
                denominator += 1
            elif result["status"] == CQMStatus.numerator:
                denominator += 1
                numerator += 1

        performance_rate = round(numerator / denominator * 100, 1) if denominator > 0 else 0

        return {
            "measure_id": measure_id,
            "measure_name": measure.name,
            "measurement_period": {
                "start": measurement_period_start,
                "end": measurement_period_end,
            },
            "total_patients": len(patients),
            "denominator": denominator,
            "numerator": numerator,
            "exclusions": exclusions,
            "performance_rate": performance_rate,
            "patient_results": patient_results,
        }

    @classmethod
    def _evaluate_patient_for_measure(
        cls,
        patient: dict,
        measure: CQMeasure,
        period_start: str,
        period_end: str,
    ) -> dict[str, Any]:
        """Evaluate a single patient against a measure."""
        # Simplified logic — real implementation uses FHIR queries
        age = cls._calculate_age(patient.get("dob"))
        gender = patient.get("gender", "").lower()

        # Check exclusions first
        if cls._is_excluded(patient, measure):
            return {"patient_id": patient.get("id"), "status": CQMStatus.exclusion.value}

        # Check denominator eligibility
        in_denominator = cls._in_denominator(patient, measure, age, gender)
        if not in_denominator:
            return {"patient_id": patient.get("id"), "status": CQMStatus.not_eligible.value}

        # Check numerator
        in_numerator = cls._in_numerator(patient, measure)
        if in_numerator:
            return {"patient_id": patient.get("id"), "status": CQMStatus.numerator.value}

        return {"patient_id": patient.get("id"), "status": CQMStatus.denominator.value}

    @staticmethod
    def _calculate_age(dob: str | datetime | None) -> int:
        if dob is None:
            return 0
        if isinstance(dob, str):
            dob = datetime.fromisoformat(dob.replace("Z", "+00:00"))
        today = datetime.now(UTC)
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    @classmethod
    def _is_excluded(cls, patient: dict, measure: CQMeasure) -> bool:
        """Check if patient is excluded from the measure."""
        exclusions = patient.get("exclusions", [])
        if "hospice" in exclusions:
            return True
        if measure.id == "cms122" and "pregnancy" in exclusions:
            return True
        if measure.id == "cms165" and ("esrd" in exclusions or "pregnancy" in exclusions):
            return True
        return False

    @classmethod
    def _in_denominator(cls, patient: dict, measure: CQMeasure, age: int, gender: str) -> bool:
        """Check if patient is in the denominator."""
        if measure.id == "cms122":
            return 18 <= age <= 75 and any("diabetes" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        elif measure.id == "cms165":
            return 18 <= age <= 85 and any("hypertension" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        elif measure.id == "cms125":
            return 50 <= age <= 74 and gender == "female"
        elif measure.id == "cms130":
            return 45 <= age <= 75
        elif measure.id == "cms138":
            return age >= 12
        elif measure.id == "cms147":
            return age >= 0.5
        elif measure.id == "cms127":
            return age >= 65
        elif measure.id == "cms117":
            return 2 <= age < 3
        elif measure.id == "cms131":
            return 18 <= age <= 75 and any("diabetes" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        elif measure.id == "cms134":
            return 18 <= age <= 75 and any("diabetes" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        return False

    @classmethod
    def _in_numerator(cls, patient: dict, measure: CQMeasure) -> bool:
        """Check if patient meets the numerator criteria."""
        labs = patient.get("labs", {})
        procedures = patient.get("procedures", [])
        meds = patient.get("medications", [])

        if measure.id == "cms122":
            hba1c = labs.get("hba1c")
            return hba1c is not None and hba1c > 9.0
        elif measure.id == "cms165":
            bp_sys = labs.get("bp_systolic")
            bp_dia = labs.get("bp_diastolic")
            return bp_sys is not None and bp_dia is not None and (bp_sys < 140 and bp_dia < 90)
        elif measure.id == "cms125":
            return any("mammogram" in p.get("name", "").lower() for p in procedures)
        elif measure.id == "cms130":
            return any("colonoscopy" in p.get("name", "").lower() for p in procedures)
        elif measure.id == "cms138":
            screened = patient.get("tobacco_screened", False)
            user = patient.get("tobacco_user", False)
            intervention = patient.get("tobacco_intervention", False)
            return screened and (not user or intervention)
        elif measure.id == "cms147":
            return any("influenza" in i.get("name", "").lower() for i in patient.get("immunizations", []))
        elif measure.id == "cms127":
            return any("pneumococcal" in i.get("name", "").lower() for i in patient.get("immunizations", []))
        elif measure.id == "cms131":
            return any("eye_exam" in p.get("name", "").lower() for p in procedures)
        elif measure.id == "cms134":
            has_urine_albumin = labs.get("urine_albumin") is not None
            on_ace_arb = any(m.get("name", "").lower() in ["lisinopril", "enalapril", "losartan"] for m in meds)
            return has_urine_albumin or on_ace_arb
        return False

    @classmethod
    def generate_qrda_category1(cls, patient: dict, measure_id: str) -> str:
        """Generate QRDA Category I (individual patient) XML."""
        measure = cls.get_measure(measure_id)
        if not measure:
            return ""

        now = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.24.1.1" extension="2023-05-01"/>
  <id root="2.16.840.1.113883.19.5" extension="QRDA1-{patient.get('id')}-{now}"/>
  <code code="55182-0" codeSystem="2.16.840.1.113883.6.1" displayName="Quality Measure Report"/>
  <title>QRDA Category I Report</title>
  <effectiveTime value="{now}"/>
  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.19.5" extension="{patient.get('id')}"/>
      <patient>
        <name><given>{patient.get('first_name')}</given><family>{patient.get('last_name')}</family></name>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.24.2.3"/>
          <code code="55186-1" codeSystem="2.16.840.1.113883.6.1" displayName="Measure Section"/>
          <title>Measure Data</title>
          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.24.3.98"/>
              <id root="2.16.840.1.113883.19.5" extension="{measure_id}"/>
              <statusCode code="completed"/>
              <reference typeCode="REFR">
                <externalDocument classCode="DOC" moodCode="EVN">
                  <id root="2.16.840.1.113883.4.2" extension="{measure.cms_number}"/>
                  <text>{measure.name}</text>
                </externalDocument>
              </reference>
            </organizer>
          </entry>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>"""
        return xml

    @classmethod
    def generate_qrda_category3(cls, measure_results: list[dict]) -> str:
        """Generate QRDA Category III (aggregate) XML for CMS submission."""
        now = datetime.now(UTC).strftime("%Y%m%d%H%M%S")

        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.27.1.1" extension="2023-05-01"/>
  <id root="2.16.840.1.113883.19.5" extension="QRDA3-{now}"/>
  <code code="55184-6" codeSystem="2.16.840.1.113883.6.1" displayName="Quality Reporting Document"/>
  <title>QRDA Category III Report</title>
  <effectiveTime value="{now}"/>
  <component>
    <structuredBody>
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.27.2.1"/>
          <code code="55186-1" codeSystem="2.16.840.1.113883.6.1" displayName="Measure Section"/>
          <title>Measure Data</title>
"""
        for result in measure_results:
            xml += f"""          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.27.3.1"/>
              <id root="2.16.840.1.113883.19.5" extension="{result['measure_id']}"/>
              <statusCode code="completed"/>
              <reference typeCode="REFR">
                <externalDocument classCode="DOC" moodCode="EVN">
                  <id root="2.16.840.1.113883.4.2" extension="{result.get('cms_number', '')}"/>
                </externalDocument>
              </reference>
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.14"/>
                  <code code="DENOM" codeSystem="2.16.840.1.113883.5.4"/>
                  <value xsi:type="INT" value="{result['denominator']}"/>
                </observation>
              </component>
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.16"/>
                  <code code="NUMER" codeSystem="2.16.840.1.113883.5.4"/>
                  <value xsi:type="INT" value="{result['numerator']}"/>
                </observation>
              </component>
            </organizer>
          </entry>
"""
        xml += """        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>"""
        return xml
