"""DrChrono migration service for CSV processing and data import.

Handles:
- CSV parsing and validation
- Row classification (create/update/skip/duplicate)
- Dry-run analysis
- Import batch management
- Write blocking until production approval
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class RowAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    SKIP = "skip"
    DUPLICATE = "duplicate"
    MISSING_DEPENDENCY = "missing_dependency"
    NEEDS_REVIEW = "needs_review"


class ImportSection(str, Enum):
    PATIENTS = "patients"
    APPOINTMENTS = "appointments"
    ENCOUNTERS = "encounters"
    DOCUMENTS = "documents"
    MEDICATIONS = "medications"
    ALLERGIES = "allergies"
    PROBLEMS = "problems"
    VITALS = "vitals"
    LAB_RESULTS = "lab_results"
    BILLING = "billing"
    INSURANCE = "insurance"


@dataclass
class MigrationRow:
    """Single row from DrChrono export."""

    row_number: int
    section: ImportSection
    source_data: dict[str, Any]
    action: RowAction = RowAction.CREATE
    target_id: str | None = None
    confidence: float = 1.0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "row_number": self.row_number,
            "section": self.section.value,
            "source_data": self.source_data,
            "action": self.action.value,
            "target_id": self.target_id,
            "confidence": self.confidence,
            "warnings": self.warnings,
            "errors": self.errors,
            "notes": self.notes,
        }


@dataclass
class ImportBatch:
    """Batch of rows to import."""

    batch_id: str
    section: ImportSection
    mode: str  # dry-run or production
    rows: list[MigrationRow] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    completed_at: str | None = None
    status: str = "pending"  # pending, processing, completed, failed
    create_count: int = 0
    update_count: int = 0
    skip_count: int = 0
    error_count: int = 0
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "section": self.section.value,
            "mode": self.mode,
            "row_count": len(self.rows),
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "status": self.status,
            "create_count": self.create_count,
            "update_count": self.update_count,
            "skip_count": self.skip_count,
            "error_count": self.error_count,
            "summary": self.summary,
        }


class DrChronoMigrationService:
    """Service for processing DrChrono exports and managing imports."""

    def __init__(self, write_enabled: bool = False) -> None:
        self.write_enabled = write_enabled
        self._batches: dict[str, ImportBatch] = {}
        self._dry_run_results: dict[str, Any] = {}

    def parse_csv(
        self,
        section: ImportSection,
        csv_content: str,
        delimiter: str = ",",
    ) -> list[MigrationRow]:
        """Parse CSV content into migration rows."""
        rows: list[MigrationRow] = []

        reader = csv.DictReader(
            io.StringIO(csv_content),
            delimiter=delimiter,
        )

        for row_number, source_data in enumerate(reader, start=1):
            # Clean up keys and values
            cleaned_data = {
                k.strip(): v.strip() if v else None
                for k, v in source_data.items()
                if k and k.strip()
            }

            migration_row = MigrationRow(
                row_number=row_number,
                section=section,
                source_data=cleaned_data,
            )

            rows.append(migration_row)

        return rows

    def analyze_row(
        self,
        row: MigrationRow,
        existing_records: dict[str, Any] | None = None,
    ) -> MigrationRow:
        """Analyze a single row and determine action."""
        existing = existing_records or {}

        # Check for required fields
        required_fields = self._get_required_fields(row.section)
        missing_fields = [f for f in required_fields if not row.source_data.get(f)]

        if missing_fields:
            row.action = RowAction.MISSING_DEPENDENCY
            row.errors.append(f"Missing required fields: {', '.join(missing_fields)}")
            return row

        # Check for duplicates
        record_key = self._generate_record_key(row.section, row.source_data)
        if record_key in existing:
            existing_record = existing[record_key]

            # Check if data is identical
            if self._is_identical(row.source_data, existing_record):
                row.action = RowAction.DUPLICATE
                row.notes = "Identical to existing record"
            else:
                row.action = RowAction.UPDATE
                row.target_id = existing_record.get("id")
                row.notes = "Record exists with different data"
        else:
            row.action = RowAction.CREATE

        # Check for data quality issues
        warnings = self._validate_data_quality(row.section, row.source_data)
        row.warnings.extend(warnings)

        if warnings:
            row.action = RowAction.NEEDS_REVIEW

        return row

    def run_dry_run(
        self,
        section: ImportSection,
        csv_content: str,
        existing_records: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run dry-run analysis on CSV data."""
        rows = self.parse_csv(section, csv_content)
        analyzed_rows: list[MigrationRow] = []

        action_counts: dict[str, int] = {
            "create": 0,
            "update": 0,
            "skip": 0,
            "duplicate": 0,
            "missing_dependency": 0,
            "needs_review": 0,
        }

        for row in rows:
            analyzed = self.analyze_row(row, existing_records)
            analyzed_rows.append(analyzed)
            action_counts[analyzed.action.value] += 1

        # Generate summary
        total = len(analyzed_rows)
        dry_run_id = hashlib.sha256(
            f"{section.value}:{datetime.now(UTC).isoformat()}".encode()
        ).hexdigest()[:16]

        result = {
            "dry_run_id": dry_run_id,
            "section": section.value,
            "total_rows": total,
            "action_counts": action_counts,
            "create_count": action_counts["create"],
            "update_count": action_counts["update"],
            "skip_count": action_counts["skip"],
            "duplicate_count": action_counts["duplicate"],
            "missing_dependency_count": action_counts["missing_dependency"],
            "needs_review_count": action_counts["needs_review"],
            "confidence_score": self._calculate_confidence(analyzed_rows),
            "sample_rows": [r.to_dict() for r in analyzed_rows[:5]],
            "all_rows": [r.to_dict() for r in analyzed_rows],
            "generated_at": datetime.now(UTC).isoformat(),
        }

        self._dry_run_results[dry_run_id] = result
        return result

    def create_import_batch(
        self,
        section: ImportSection,
        dry_run_id: str,
        mode: str = "dry-run",
    ) -> ImportBatch | None:
        """Create import batch from dry-run results."""
        dry_run = self._dry_run_results.get(dry_run_id)
        if not dry_run:
            return None

        # Block writes unless explicitly enabled
        if mode == "production" and not self.write_enabled:
            raise ValueError(
                "Production imports are blocked. "
                "Set write_enabled=True after production migration approval."
            )

        batch_id = f"{section.value}-{dry_run_id[:8]}"
        batch = ImportBatch(
            batch_id=batch_id,
            section=section,
            mode=mode,
        )

        # Only include create/update rows
        for row_data in dry_run.get("all_rows", []):
            action = RowAction(row_data["action"])
            if action in (RowAction.CREATE, RowAction.UPDATE):
                row = MigrationRow(
                    row_number=row_data["row_number"],
                    section=ImportSection(row_data["section"]),
                    source_data=row_data["source_data"],
                    action=action,
                    target_id=row_data.get("target_id"),
                    confidence=row_data.get("confidence", 1.0),
                    warnings=row_data.get("warnings", []),
                    errors=row_data.get("errors", []),
                    notes=row_data.get("notes", ""),
                )
                batch.rows.append(row)

        self._batches[batch_id] = batch
        return batch

    def execute_batch(self, batch_id: str) -> ImportBatch | None:
        """Execute an import batch."""
        batch = self._batches.get(batch_id)
        if not batch:
            return None

        if batch.mode == "production" and not self.write_enabled:
            raise ValueError(
                "Production imports are blocked. "
                "Set write_enabled=True after production migration approval."
            )

        batch.status = "processing"

        for row in batch.rows:
            try:
                if row.action == RowAction.CREATE:
                    if self.write_enabled:
                        # Actually create the record
                        row.target_id = self._create_record(row.section, row.source_data)
                    batch.create_count += 1
                elif row.action == RowAction.UPDATE:
                    if self.write_enabled:
                        # Actually update the record
                        self._update_record(row.section, row.target_id, row.source_data)
                    batch.update_count += 1
            except Exception as e:
                batch.error_count += 1
                row.errors.append(str(e))

        batch.status = "completed"
        batch.completed_at = datetime.now(UTC).isoformat()
        batch.summary = (
            f"Created: {batch.create_count}, "
            f"Updated: {batch.update_count}, "
            f"Errors: {batch.error_count}"
        )

        return batch

    def get_batch(self, batch_id: str) -> ImportBatch | None:
        """Get import batch by ID."""
        return self._batches.get(batch_id)

    def list_batches(self, section: ImportSection | None = None) -> list[ImportBatch]:
        """List all import batches."""
        batches = list(self._batches.values())
        if section:
            batches = [b for b in batches if b.section == section]
        return batches

    def _get_required_fields(self, section: ImportSection) -> list[str]:
        """Get required fields for a section."""
        required_fields: dict[str, list[str]] = {
            ImportSection.PATIENTS: ["first_name", "last_name", "date_of_birth"],
            ImportSection.APPOINTMENTS: ["patient_id", "scheduled_time", "duration"],
            ImportSection.ENCOUNTERS: ["patient_id", "date", "provider_id"],
            ImportSection.DOCUMENTS: ["patient_id", "document_type", "content"],
            ImportSection.MEDICATIONS: ["patient_id", "medication_name", "status"],
            ImportSection.ALLERGIES: ["patient_id", "allergen", "reaction"],
            ImportSection.PROBLEMS: ["patient_id", "problem", "status"],
            ImportSection.VITALS: ["patient_id", "date", "vital_type", "value"],
            ImportSection.LAB_RESULTS: ["patient_id", "test_name", "result", "date"],
            ImportSection.BILLING: ["patient_id", "service_date", "charge_amount"],
            ImportSection.INSURANCE: ["patient_id", "payer_name", "policy_number"],
        }
        return required_fields.get(section, [])

    def _generate_record_key(
        self,
        section: ImportSection,
        data: dict[str, Any],
    ) -> str:
        """Generate unique key for deduplication."""
        if section == ImportSection.PATIENTS:
            key_parts = [
                data.get("first_name", "").lower(),
                data.get("last_name", "").lower(),
                data.get("date_of_birth", ""),
            ]
        elif section == ImportSection.APPOINTMENTS:
            key_parts = [
                data.get("patient_id", ""),
                data.get("scheduled_time", ""),
            ]
        else:
            key_parts = [json.dumps(data, sort_keys=True)]

        return hashlib.sha256(":".join(key_parts).encode()).hexdigest()[:16]

    def _is_identical(
        self,
        source: dict[str, Any],
        target: dict[str, Any],
    ) -> bool:
        """Check if two records are identical."""
        # Compare common fields
        common_fields = set(source.keys()) & set(target.keys())
        return all(
            source.get(common_field) == target.get(common_field) for common_field in common_fields
        )

    def _validate_data_quality(
        self,
        section: ImportSection,
        data: dict[str, Any],
    ) -> list[str]:
        """Validate data quality and return warnings."""
        warnings: list[str] = []

        if section == ImportSection.PATIENTS:
            # Check for common data quality issues
            phone = data.get("phone")
            if phone and len(phone.replace("-", "").replace(" ", "")) < 10:
                warnings.append("Phone number appears incomplete")

            email = data.get("email")
            if email and "@" not in email:
                warnings.append("Email format appears invalid")

        elif section == ImportSection.BILLING:
            amount = data.get("charge_amount")
            if amount:
                try:
                    float(amount)
                except ValueError:
                    warnings.append("Charge amount is not a valid number")

        return warnings

    def _calculate_confidence(self, rows: list[MigrationRow]) -> float:
        """Calculate overall confidence score."""
        if not rows:
            return 1.0

        total = len(rows)
        clean_rows = len(
            [r for r in rows if r.action in (RowAction.CREATE, RowAction.UPDATE) and not r.warnings]
        )

        return clean_rows / total

    def _create_record(
        self,
        section: ImportSection,
        data: dict[str, Any],
    ) -> str:
        """Create a record in the database."""
        # This would call the appropriate service
        # For now, return a mock ID
        return f"{section.value}-{hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:8]}"

    def _update_record(
        self,
        section: ImportSection,
        record_id: str | None,
        data: dict[str, Any],
    ) -> None:
        """Update a record in the database."""
        # This would call the appropriate service
        pass
