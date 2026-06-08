"""Staff training service with automated validation.

Manages training modules, tracks completion, validates competency,
and generates compliance evidence.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class Role(str, Enum):
    """Clinic staff roles."""

    FRONT_DESK = "front_desk"
    MA_NURSE = "ma_nurse"
    PROVIDER = "provider"
    BILLING = "billing"
    MANAGER = "manager"
    ADMIN = "admin"


class TrainingModule(str, Enum):
    """Available training modules."""

    # Core system
    SYSTEM_LOGIN = "system_login"
    PATIENT_SEARCH = "patient_search"
    APPOINTMENT_SCHEDULING = "appointment_scheduling"
    CHART_REVIEW = "chart_review"
    DOCUMENT_MANAGEMENT = "document_management"

    # Clinical workflows
    CHECK_IN = "check_in"
    ROOMING = "rooming"
    VITALS_ENTRY = "vitals_entry"
    CHART_DOCUMENTATION = "chart_documentation"
    E_PRESCRIBING = "e_prescribing"
    LAB_ORDERS = "lab_orders"
    REFERRALS = "referrals"
    CHECK_OUT = "check_out"

    # Billing
    CHARGE_CAPTURE = "charge_capture"
    CLAIM_REVIEW = "claim_review"
    PAYMENT_POSTING = "payment_posting"
    DENIAL_MANAGEMENT = "denial_management"
    REPORT_GENERATION = "report_generation"

    # Compliance
    HIPAA_BASICS = "hipaa_basics"
    PHI_HANDLING = "phi_handling"
    INCIDENT_REPORTING = "incident_reporting"
    PASSWORD_SECURITY = "password_security"
    MFA_USAGE = "mfa_usage"

    # Operations
    BACKUP_PROCEDURES = "backup_procedures"
    DOWNTIME_PROTOCOL = "downtime_protocol"
    VENDOR_SUPPORT = "vendor_support"
    AUDIT_REVIEW = "audit_review"


class CompetencyLevel(str, Enum):
    """Competency assessment levels."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DEMONSTRATED = "demonstrated"
    PROFICIENT = "proficient"
    EXPERT = "expert"


@dataclass
class TrainingItem:
    """Individual training checklist item."""

    id: str
    module: TrainingModule
    role: Role
    title: str
    description: str
    required: bool = True
    estimated_minutes: int = 15
    prerequisites: list[str] = field(default_factory=list)
    validation_steps: list[str] = field(default_factory=list)
    resources: list[str] = field(default_factory=list)


@dataclass
class TrainingRecord:
    """Staff member's training record."""

    user_id: str
    user_name: str
    role: Role
    module: TrainingModule
    status: CompetencyLevel
    started_at: str | None = None
    completed_at: str | None = None
    validated_by: str | None = None
    validation_date: str | None = None
    score: float | None = None
    notes: str = ""
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "role": self.role.value,
            "module": self.module.value,
            "status": self.status.value,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "validated_by": self.validated_by,
            "validation_date": self.validation_date,
            "score": self.score,
            "notes": self.notes,
            "evidence": self.evidence,
        }


class TrainingService:
    """Manages staff training and competency validation."""

    def __init__(self) -> None:
        self._training_items: dict[str, TrainingItem] = {}
        self._records: dict[str, TrainingRecord] = {}
        self._init_training_items()

    def _init_training_items(self) -> None:
        """Initialize default training items."""
        items = [
            # Front desk
            TrainingItem(
                id="fd-001",
                module=TrainingModule.SYSTEM_LOGIN,
                role=Role.FRONT_DESK,
                title="System Login and Navigation",
                description="Learn to log in with MFA and navigate the Command Center.",
                estimated_minutes=15,
                validation_steps=[
                    "Log in with username, password, and MFA",
                    "Navigate to patient search",
                    "Access appointment calendar",
                    "Log out securely",
                ],
            ),
            TrainingItem(
                id="fd-002",
                module=TrainingModule.PATIENT_SEARCH,
                role=Role.FRONT_DESK,
                title="Patient Search and Verification",
                description="Search for patients and verify identity.",
                estimated_minutes=20,
                prerequisites=["fd-001"],
                validation_steps=[
                    "Search by name, DOB, and MRN",
                    "Verify patient identity",
                    "Update contact information",
                    "Flag duplicate records",
                ],
            ),
            TrainingItem(
                id="fd-003",
                module=TrainingModule.CHECK_IN,
                role=Role.FRONT_DESK,
                title="Patient Check-In Workflow",
                description="Complete patient check-in process.",
                estimated_minutes=30,
                prerequisites=["fd-002"],
                validation_steps=[
                    "Confirm appointment",
                    "Verify insurance",
                    "Collect copay",
                    "Print visit summary",
                    "Update wait time",
                ],
            ),
            TrainingItem(
                id="fd-004",
                module=TrainingModule.APPOINTMENT_SCHEDULING,
                role=Role.FRONT_DESK,
                title="Appointment Scheduling",
                description="Schedule, reschedule, and cancel appointments.",
                estimated_minutes=30,
                prerequisites=["fd-001"],
                validation_steps=[
                    "Schedule new appointment",
                    "Reschedule existing appointment",
                    "Cancel appointment with reason",
                    "Set up recurring appointments",
                    "Handle waitlist",
                ],
            ),

            # MA/Nurse
            TrainingItem(
                id="ma-001",
                module=TrainingModule.ROOMING,
                role=Role.MA_NURSE,
                title="Rooming Patients",
                description="Room patients and prepare for provider visit.",
                estimated_minutes=20,
                validation_steps=[
                    "Call patient from waiting room",
                    "Verify chief complaint",
                    "Review medication list",
                    "Update allergies",
                    "Document in chart",
                ],
            ),
            TrainingItem(
                id="ma-002",
                module=TrainingModule.VITALS_ENTRY,
                role=Role.MA_NURSE,
                title="Vitals Entry",
                description="Record patient vital signs.",
                estimated_minutes=15,
                prerequisites=["ma-001"],
                validation_steps=[
                    "Enter blood pressure",
                    "Enter heart rate and temperature",
                    "Enter weight and height",
                    "Flag abnormal values",
                    "Document pain level",
                ],
            ),
            TrainingItem(
                id="ma-003",
                module=TrainingModule.LAB_ORDERS,
                role=Role.MA_NURSE,
                title="Lab Order Management",
                description="Place and track lab orders.",
                estimated_minutes=25,
                prerequisites=["ma-001"],
                validation_steps=[
                    "Create lab order",
                    "Print requisition",
                    "Track pending results",
                    "Review completed results",
                    "Notify provider of critical values",
                ],
            ),

            # Provider
            TrainingItem(
                id="prov-001",
                module=TrainingModule.CHART_DOCUMENTATION,
                role=Role.PROVIDER,
                title="Chart Documentation",
                description="Document patient encounters.",
                estimated_minutes=30,
                validation_steps=[
                    "Create new encounter note",
                    "Use templates and macros",
                    "Add diagnosis codes",
                    "Link procedures",
                    "Sign and lock note",
                ],
            ),
            TrainingItem(
                id="prov-002",
                module=TrainingModule.E_PRESCRIBING,
                role=Role.PROVIDER,
                title="E-Prescribing",
                description="Send prescriptions electronically.",
                estimated_minutes=25,
                prerequisites=["prov-001"],
                validation_steps=[
                    "Select medication",
                    "Verify pharmacy",
                    "Check drug interactions",
                    "Send prescription",
                    "Handle refill requests",
                ],
            ),
            TrainingItem(
                id="prov-003",
                module=TrainingModule.REFERRALS,
                role=Role.PROVIDER,
                title="Referral Management",
                description="Create and track referrals.",
                estimated_minutes=20,
                prerequisites=["prov-001"],
                validation_steps=[
                    "Create referral order",
                    "Select specialist",
                    "Attach relevant documents",
                    "Track referral status",
                    "Review consultation notes",
                ],
            ),

            # Billing
            TrainingItem(
                id="bill-001",
                module=TrainingModule.CHARGE_CAPTURE,
                role=Role.BILLING,
                title="Charge Capture",
                description="Review and post charges from encounters.",
                estimated_minutes=30,
                validation_steps=[
                    "Review encounter documentation",
                    "Verify diagnosis codes",
                    "Verify procedure codes",
                    "Post charges",
                    "Handle missing documentation",
                ],
            ),
            TrainingItem(
                id="bill-002",
                module=TrainingModule.CLAIM_REVIEW,
                role=Role.BILLING,
                title="Claim Review and Submission",
                description="Review and submit insurance claims.",
                estimated_minutes=30,
                prerequisites=["bill-001"],
                validation_steps=[
                    "Review claim for errors",
                    "Verify insurance eligibility",
                    "Submit claim to clearinghouse",
                    "Track claim status",
                    "Handle rejections",
                ],
            ),
            TrainingItem(
                id="bill-003",
                module=TrainingModule.DENIAL_MANAGEMENT,
                role=Role.BILLING,
                title="Denial Management",
                description="Handle denied claims and appeals.",
                estimated_minutes=30,
                prerequisites=["bill-002"],
                validation_steps=[
                    "Review denial reason",
                    "Gather supporting documentation",
                    "Submit appeal",
                    "Track appeal status",
                    "Update billing records",
                ],
            ),

            # Manager
            TrainingItem(
                id="mgr-001",
                module=TrainingModule.REPORT_GENERATION,
                role=Role.MANAGER,
                title="Report Generation",
                description="Generate operational and financial reports.",
                estimated_minutes=30,
                validation_steps=[
                    "Run daily closeout report",
                    "Generate AR aging report",
                    "Review provider productivity",
                    "Export data for analysis",
                    "Schedule automated reports",
                ],
            ),
            TrainingItem(
                id="mgr-002",
                module=TrainingModule.AUDIT_REVIEW,
                role=Role.MANAGER,
                title="Audit Log Review",
                description="Review system audit logs.",
                estimated_minutes=20,
                validation_steps=[
                    "Access audit dashboard",
                    "Filter by date range",
                    "Review failed login attempts",
                    "Check PHI access patterns",
                    "Export audit evidence",
                ],
            ),

            # All roles - Compliance
            TrainingItem(
                id="comp-001",
                module=TrainingModule.HIPAA_BASICS,
                role=Role.FRONT_DESK,  # Required for all roles
                title="HIPAA Basics",
                description="Understand HIPAA requirements and responsibilities.",
                estimated_minutes=45,
                required=True,
                validation_steps=[
                    "Define PHI and ePHI",
                    "Identify minimum necessary standard",
                    "Explain patient rights",
                    "Describe breach notification",
                    "List workforce responsibilities",
                ],
            ),
            TrainingItem(
                id="comp-002",
                module=TrainingModule.PHI_HANDLING,
                role=Role.FRONT_DESK,
                title="PHI Handling Procedures",
                description="Proper handling of protected health information.",
                estimated_minutes=30,
                required=True,
                prerequisites=["comp-001"],
                validation_steps=[
                    "Verify patient identity before disclosure",
                    "Document authorization",
                    "Handle verbal PHI securely",
                    "Dispose of PHI properly",
                    "Report suspected breaches",
                ],
            ),
            TrainingItem(
                id="comp-003",
                module=TrainingModule.MFA_USAGE,
                role=Role.FRONT_DESK,
                title="Multi-Factor Authentication",
                description="Use MFA for system access.",
                estimated_minutes=15,
                required=True,
                validation_steps=[
                    "Set up MFA device",
                    "Complete MFA challenge",
                    "Handle lost device scenario",
                    "Use backup codes",
                    "Report MFA issues",
                ],
            ),
        ]

        for item in items:
            self._training_items[item.id] = item

    def get_training_items(
        self,
        role: Role | None = None,
        module: TrainingModule | None = None,
    ) -> list[TrainingItem]:
        """Get training items with optional filtering."""
        items = list(self._training_items.values())

        if role:
            items = [i for i in items if i.role == role]
        if module:
            items = [i for i in items if i.module == module]

        return items

    def get_training_item(self, item_id: str) -> TrainingItem | None:
        """Get a specific training item."""
        return self._training_items.get(item_id)

    def start_training(
        self,
        user_id: str,
        user_name: str,
        role: Role,
        module: TrainingModule,
    ) -> TrainingRecord:
        """Start a training module."""
        record_id = f"{user_id}:{module.value}"

        record = TrainingRecord(
            user_id=user_id,
            user_name=user_name,
            role=role,
            module=module,
            status=CompetencyLevel.IN_PROGRESS,
            started_at=datetime.now(timezone.utc).isoformat(),
        )

        self._records[record_id] = record
        return record

    def complete_training(
        self,
        user_id: str,
        module: TrainingModule,
        score: float | None = None,
        notes: str = "",
    ) -> TrainingRecord | None:
        """Mark training as completed."""
        record_id = f"{user_id}:{module.value}"
        record = self._records.get(record_id)

        if not record:
            return None

        record.status = CompetencyLevel.DEMONSTRATED
        record.completed_at = datetime.now(timezone.utc).isoformat()
        record.score = score
        record.notes = notes

        return record

    def validate_competency(
        self,
        user_id: str,
        module: TrainingModule,
        validated_by: str,
        level: CompetencyLevel = CompetencyLevel.PROFICIENT,
        evidence: list[str] | None = None,
    ) -> TrainingRecord | None:
        """Validate staff competency."""
        record_id = f"{user_id}:{module.value}"
        record = self._records.get(record_id)

        if not record:
            return None

        record.status = level
        record.validated_by = validated_by
        record.validation_date = datetime.now(timezone.utc).isoformat()

        if evidence:
            record.evidence.extend(evidence)

        return record

    def get_staff_record(self, user_id: str) -> dict[str, Any]:
        """Get complete training record for a staff member."""
        records = [
            r.to_dict()
            for r in self._records.values()
            if r.user_id == user_id
        ]

        # Calculate completion stats
        total_required = len([
            i for i in self._training_items.values()
            if i.required
        ])
        completed = len([
            r for r in records
            if r["status"] in ["demonstrated", "proficient", "expert"]
        ])

        return {
            "user_id": user_id,
            "records": records,
            "completion_percentage": (completed / total_required * 100) if total_required > 0 else 0,
            "completed_modules": completed,
            "total_required": total_required,
            "is_compliant": completed >= total_required,
        }

    def get_role_requirements(self, role: Role) -> dict[str, Any]:
        """Get training requirements for a role."""
        items = self.get_training_items(role=role)
        required = [i for i in items if i.required]
        optional = [i for i in items if not i.required]

        return {
            "role": role.value,
            "required_modules": [
                {
                    "id": i.id,
                    "title": i.title,
                    "module": i.module.value,
                    "estimated_minutes": i.estimated_minutes,
                }
                for i in required
            ],
            "optional_modules": [
                {
                    "id": i.id,
                    "title": i.title,
                    "module": i.module.value,
                    "estimated_minutes": i.estimated_minutes,
                }
                for i in optional
            ],
            "total_required_minutes": sum(i.estimated_minutes for i in required),
            "total_optional_minutes": sum(i.estimated_minutes for i in optional),
        }

    def get_compliance_report(self) -> dict[str, Any]:
        """Generate compliance report for all staff."""
        all_users = {r.user_id for r in self._records.values()}

        staff_reports = []
        for user_id in all_users:
            report = self.get_staff_record(user_id)
            staff_reports.append(report)

        total_staff = len(all_users)
        compliant_staff = len([s for s in staff_reports if s["is_compliant"]])

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_staff": total_staff,
            "compliant_staff": compliant_staff,
            "compliance_rate": (compliant_staff / total_staff * 100) if total_staff > 0 else 0,
            "staff_reports": staff_reports,
        }

    def export_training_evidence(self, user_id: str) -> dict[str, Any]:
        """Export training evidence for compliance."""
        record = self.get_staff_record(user_id)

        return {
            "user_id": user_id,
            "export_date": datetime.now(timezone.utc).isoformat(),
            "training_records": record["records"],
            "completion_status": "complete" if record["is_compliant"] else "incomplete",
            "evidence_files": [
                e for r in record["records"]
                for e in r.get("evidence", [])
            ],
        }
