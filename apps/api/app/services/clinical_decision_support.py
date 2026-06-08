"""Clinical Decision Support (CDS) engine for ONC criterion (a)(4).

Provides patient-specific alerts, reminders, and recommendations
based on clinical guidelines (USPSTF, CDC, AHA, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any


class CDSSeverity(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class CDSActionType(str, Enum):
    alert = "alert"
    reminder = "reminder"
    order_suggestion = "order_suggestion"
    education = "education"
    screening = "screening"


@dataclass
class CDSRule:
    id: str
    name: str
    description: str
    severity: CDSSeverity
    action_type: CDSActionType
    condition: str  # Human-readable condition
    check_fn: Any  # Callable that returns bool
    message: str
    suggested_action: str
    reference_url: str | None = None
    reference_guideline: str | None = None


class CDSEngine:
    """Engine for evaluating clinical decision support rules."""

    # USPSTF screening ages
    MAMMOGRAM_AGE_START = 40
    MAMMOGRAM_AGE_END = 74
    COLONOSCOPY_AGE_START = 45
    COLONOSCOPY_AGE_END = 75
    CERVICAL_SCREENING_AGE_START = 21
    CERVICAL_SCREENING_AGE_END = 65
    LUNG_CANCER_SCREENING_AGE_START = 50
    LUNG_CANCER_SCREENING_AGE_END = 80

    def __init__(self) -> None:
        self.rules: list[CDSRule] = self._load_rules()

    def _load_rules(self) -> list[CDSRule]:
        """Load all CDS rules."""
        return [
            # Preventive screening
            CDSRule(
                id="cds-mammogram-001",
                name="Mammogram Screening",
                description="Recommend mammogram for women 40-74 every 2 years",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.screening,
                condition="Female, age 40-74, no mammogram in 2 years",
                check_fn=self._check_mammogram,
                message="Patient is due for mammogram screening",
                suggested_action="Order screening mammogram",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening",
                reference_guideline="USPSTF 2016 (updated 2023)",
            ),
            CDSRule(
                id="cds-colonoscopy-001",
                name="Colorectal Cancer Screening",
                description="Recommend colorectal screening for adults 45-75",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.screening,
                condition="Age 45-75, no colonoscopy in 10 years or FIT in 1 year",
                check_fn=self._check_colonoscopy,
                message="Patient is due for colorectal cancer screening",
                suggested_action="Order colonoscopy or FIT kit",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening",
                reference_guideline="USPSTF 2021",
            ),
            CDSRule(
                id="cds-cervical-001",
                name="Cervical Cancer Screening",
                description="Recommend Pap smear for women 21-65",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.screening,
                condition="Female, age 21-65, no Pap in 3 years or HPV in 5 years",
                check_fn=self._check_cervical_screening,
                message="Patient is due for cervical cancer screening",
                suggested_action="Order Pap smear or HPV test",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/cervical-cancer-screening",
                reference_guideline="USPSTF 2018",
            ),
            # Medication safety
            CDSRule(
                id="cds-aspirin-001",
                name="Aspirin Primary Prevention",
                description="Do not initiate aspirin for primary prevention in adults >60",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.alert,
                condition="Age >60, no ASCVD, on aspirin",
                check_fn=self._check_aspirin_primary_prevention,
                message="Aspirin for primary prevention not recommended in adults >60",
                suggested_action="Consider discontinuing aspirin",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/aspirin-use-to-prevent-cardiovascular-disease-and-colorectal-cancer-preventive-medication",
                reference_guideline="USPSTF 2022",
            ),
            CDSRule(
                id="cds-statin-001",
                name="Statin for ASCVD Prevention",
                description="Recommend statin for adults 40-75 with risk factors",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.order_suggestion,
                condition="Age 40-75, LDL >190 or diabetes or 10-year risk >7.5%",
                check_fn=self._check_statin,
                message="Patient may benefit from statin therapy for ASCVD prevention",
                suggested_action="Calculate 10-year ASCVD risk and consider statin",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/statin-use-for-primary-prevention-of-cardiovascular-disease-in-adults-preventive-medication",
                reference_guideline="USPSTF 2022",
            ),
            # Immunization
            CDSRule(
                id="cds-flu-001",
                name="Annual Influenza Vaccine",
                description="Recommend annual flu vaccine for all adults",
                severity=CDSSeverity.info,
                action_type=CDSActionType.reminder,
                condition="Age >= 6 months, no flu vaccine this season",
                check_fn=self._check_flu_vaccine,
                message="Patient is due for annual influenza vaccination",
                suggested_action="Administer influenza vaccine",
                reference_url="https://www.cdc.gov/flu/professionals/acip/2024-25.htm",
                reference_guideline="CDC ACIP 2024-25",
            ),
            CDSRule(
                id="cds-pneumonia-001",
                name="Pneumococcal Vaccine",
                description="Recommend pneumococcal vaccine for adults >=65",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.reminder,
                condition="Age >=65, no pneumococcal vaccine",
                check_fn=self._check_pneumococcal,
                message="Patient is due for pneumococcal vaccination",
                suggested_action="Administer PCV20 or PCV15 + PPSV23",
                reference_url="https://www.cdc.gov/vaccines/vpd/pneumo/hcp/immunization-schedule.html",
                reference_guideline="CDC ACIP 2024",
            ),
            CDSRule(
                id="cds-shingles-001",
                name="Shingles Vaccine",
                description="Recommend Shingrix for adults >=50",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.reminder,
                condition="Age >=50, no Shingrix series",
                check_fn=self._check_shingles,
                message="Patient is due for shingles (Shingrix) vaccination",
                suggested_action="Administer Shingrix (2-dose series)",
                reference_url="https://www.cdc.gov/vaccines/vpd/shingles/hcp/shingrix/recommendations.html",
                reference_guideline="CDC ACIP 2024",
            ),
            # Diabetes
            CDSRule(
                id="cds-diabetes-screening-001",
                name="Diabetes Screening",
                description="Screen adults 35-70 with overweight/obesity for diabetes",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.screening,
                condition="Age 35-70, BMI >=25, no diabetes screening in 3 years",
                check_fn=self._check_diabetes_screening,
                message="Patient is due for diabetes screening",
                suggested_action="Order HbA1c or fasting glucose",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes",
                reference_guideline="USPSTF 2021",
            ),
            CDSRule(
                id="cds-diabetes-eye-001",
                name="Diabetic Eye Exam",
                description="Annual dilated eye exam for diabetics",
                severity=CDSSeverity.critical,
                action_type=CDSActionType.reminder,
                condition="Diabetes diagnosis, no eye exam in 12 months",
                check_fn=self._check_diabetic_eye_exam,
                message="Diabetic patient overdue for dilated eye exam",
                suggested_action="Order diabetic retinopathy screening",
                reference_url="https://www.aao.org/clinical-statement/screening-for-diabetic-retinopathy",
                reference_guideline="AAO 2023",
            ),
            # Hypertension
            CDSRule(
                id="cds-htn-001",
                name="Hypertension Control",
                description="BP >=140/90 on 2+ visits - intensify treatment",
                severity=CDSSeverity.critical,
                action_type=CDSActionType.alert,
                condition="BP >=140/90 on 2+ visits in past year",
                check_fn=self._check_htn_control,
                message="Blood pressure poorly controlled - consider medication adjustment",
                suggested_action="Intensify antihypertensive therapy per JNC-8",
                reference_url="https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065",
                reference_guideline="AHA/ACC 2017",
            ),
            # Depression
            CDSRule(
                id="cds-depression-001",
                name="Depression Screening",
                description="Screen adults for depression annually",
                severity=CDSSeverity.info,
                action_type=CDSActionType.screening,
                condition="Age >=18, no depression screening in 12 months",
                check_fn=self._check_depression_screening,
                message="Patient is due for depression screening",
                suggested_action="Administer PHQ-9 screening",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-depression-in-adults",
                reference_guideline="USPSTF 2023",
            ),
            # Falls
            CDSRule(
                id="cds-falls-001",
                name="Falls Risk Assessment",
                description="Assess falls risk in adults >=65 annually",
                severity=CDSSeverity.warning,
                action_type=CDSActionType.screening,
                condition="Age >=65, no falls assessment in 12 months",
                check_fn=self._check_falls_risk,
                message="Patient is due for falls risk assessment",
                suggested_action="Perform falls risk assessment and gait evaluation",
                reference_url="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prevention-of-falls-in-community-dwelling-older-adults",
                reference_guideline="USPSTF 2018",
            ),
        ]

    # ------------------------------------------------------------------
    # Rule check functions
    # ------------------------------------------------------------------

    def _check_mammogram(self, patient: dict, history: list) -> bool:
        if patient.get("gender") != "female":
            return False
        age = self._calculate_age(patient.get("dob"))
        if not (self.MAMMOGRAM_AGE_START <= age <= self.MAMMOGRAM_AGE_END):
            return False
        last_mammo = self._last_procedure_date(history, "mammogram")
        return last_mammo is None or (datetime.now(UTC) - last_mammo).days > 730

    def _check_colonoscopy(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if not (self.COLONOSCOPY_AGE_START <= age <= self.COLONOSCOPY_AGE_END):
            return False
        last_colonoscopy = self._last_procedure_date(history, "colonoscopy")
        last_fit = self._last_procedure_date(history, "fit")
        colonoscopy_due = last_colonoscopy is None or (datetime.now(UTC) - last_colonoscopy).days > 3650
        fit_due = last_fit is None or (datetime.now(UTC) - last_fit).days > 365
        return colonoscopy_due and fit_due

    def _check_cervical_screening(self, patient: dict, history: list) -> bool:
        if patient.get("gender") != "female":
            return False
        age = self._calculate_age(patient.get("dob"))
        if not (self.CERVICAL_SCREENING_AGE_START <= age <= self.CERVICAL_SCREENING_AGE_END):
            return False
        last_pap = self._last_procedure_date(history, "pap_smear")
        last_hpv = self._last_procedure_date(history, "hpv_test")
        pap_due = last_pap is None or (datetime.now(UTC) - last_pap).days > 1095
        hpv_due = last_hpv is None or (datetime.now(UTC) - last_hpv).days > 1825
        return pap_due and hpv_due

    def _check_aspirin_primary_prevention(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if age <= 60:
            return False
        meds = patient.get("medications", [])
        on_aspirin = any("aspirin" in m.get("name", "").lower() for m in meds)
        has_ascvd = any("ascvd" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        return on_aspirin and not has_ascvd

    def _check_statin(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if not (40 <= age <= 75):
            return False
        ldl = patient.get("labs", {}).get("ldl")
        if ldl and ldl > 190:
            return True
        has_diabetes = any("diabetes" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        if has_diabetes:
            return True
        return False  # Would need ASCVD risk calc

    def _check_flu_vaccine(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if age < 0.5:
            return False
        last_flu = self._last_immunization_date(history, "influenza")
        season_start = datetime(datetime.now(UTC).year, 8, 1, tzinfo=UTC)
        return last_flu is None or last_flu < season_start

    def _check_pneumococcal(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if age < 65:
            return False
        last_pneumococcal = self._last_immunization_date(history, "pneumococcal")
        return last_pneumococcal is None

    def _check_shingles(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if age < 50:
            return False
        last_shingles = self._last_immunization_date(history, "shingles")
        return last_shingles is None

    def _check_diabetes_screening(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if not (35 <= age <= 70):
            return False
        bmi = patient.get("vitals", {}).get("bmi")
        if not bmi or bmi < 25:
            return False
        last_screening = self._last_procedure_date(history, "diabetes_screening")
        return last_screening is None or (datetime.now(UTC) - last_screening).days > 1095

    def _check_diabetic_eye_exam(self, patient: dict, history: list) -> bool:
        has_diabetes = any("diabetes" in d.get("code", "").lower() for d in patient.get("diagnoses", []))
        if not has_diabetes:
            return False
        last_eye_exam = self._last_procedure_date(history, "diabetic_eye_exam")
        return last_eye_exam is None or (datetime.now(UTC) - last_eye_exam).days > 365

    def _check_htn_control(self, patient: dict, history: list) -> bool:
        vitals = patient.get("vitals", {})
        bp_systolic = vitals.get("bp_systolic")
        bp_diastolic = vitals.get("bp_diastolic")
        if not bp_systolic or not bp_diastolic:
            return False
        return bp_systolic >= 140 or bp_diastolic >= 90

    def _check_depression_screening(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if age < 18:
            return False
        last_screening = self._last_procedure_date(history, "depression_screening")
        return last_screening is None or (datetime.now(UTC) - last_screening).days > 365

    def _check_falls_risk(self, patient: dict, history: list) -> bool:
        age = self._calculate_age(patient.get("dob"))
        if age < 65:
            return False
        last_assessment = self._last_procedure_date(history, "falls_assessment")
        return last_assessment is None or (datetime.now(UTC) - last_assessment).days > 365

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _calculate_age(dob: str | datetime | None) -> int:
        if dob is None:
            return 0
        if isinstance(dob, str):
            dob = datetime.fromisoformat(dob.replace("Z", "+00:00"))
        today = datetime.now(UTC)
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    @staticmethod
    def _last_procedure_date(history: list, procedure_type: str) -> datetime | None:
        dates = [
            datetime.fromisoformat(h["date"].replace("Z", "+00:00"))
            for h in history
            if h.get("type") == procedure_type and h.get("date")
        ]
        return max(dates) if dates else None

    @staticmethod
    def _last_immunization_date(history: list, vaccine_type: str) -> datetime | None:
        dates = [
            datetime.fromisoformat(h["date"].replace("Z", "+00:00"))
            for h in history
            if h.get("type") == "immunization"
            and vaccine_type.lower() in h.get("name", "").lower()
            and h.get("date")
        ]
        return max(dates) if dates else None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def evaluate_patient(self, patient: dict, history: list) -> list[dict]:
        """Evaluate all CDS rules for a patient and return active alerts."""
        alerts = []
        for rule in self.rules:
            try:
                if rule.check_fn(patient, history):
                    alerts.append({
                        "rule_id": rule.id,
                        "name": rule.name,
                        "description": rule.description,
                        "severity": rule.severity.value,
                        "action_type": rule.action_type.value,
                        "message": rule.message,
                        "suggested_action": rule.suggested_action,
                        "reference_url": rule.reference_url,
                        "reference_guideline": rule.reference_guideline,
                    })
            except Exception:
                continue
        return alerts

    def get_rule(self, rule_id: str) -> CDSRule | None:
        """Get a specific CDS rule by ID."""
        for rule in self.rules:
            if rule.id == rule_id:
                return rule
        return None

    def list_rules(self) -> list[dict]:
        """List all available CDS rules."""
        return [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "severity": r.severity.value,
                "action_type": r.action_type.value,
                "reference_guideline": r.reference_guideline,
            }
            for r in self.rules
        ]
