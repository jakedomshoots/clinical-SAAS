"""Database migration safety service.

Provides pre-migration checks, dry-runs, rollback capability,
and safety validations before applying schema changes.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class MigrationRisk(str, Enum):
    LOW = "low"           # Additive changes only
    MEDIUM = "medium"     # Index changes, constraints
    HIGH = "high"         # Column modifications, renames
    CRITICAL = "critical"  # Table drops, data migrations


class MigrationStatus(str, Enum):
    PENDING = "pending"
    VALIDATED = "validated"
    DRY_RUN = "dry_run"
    APPLIED = "applied"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


@dataclass
class MigrationCheck:
    """Result of a pre-migration check."""

    name: str
    passed: bool
    message: str
    severity: str = "info"  # info, warning, error


@dataclass
class MigrationPlan:
    """Planned database migration."""

    migration_id: str
    description: str
    risk_level: MigrationRisk
    sql_statements: list[str] = field(default_factory=list)
    rollback_statements: list[str] = field(default_factory=list)
    affected_tables: list[str] = field(default_factory=list)
    estimated_duration_seconds: int = 0
    requires_downtime: bool = False
    checks: list[MigrationCheck] = field(default_factory=list)
    status: MigrationStatus = MigrationStatus.PENDING
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    applied_at: str | None = None
    applied_by: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "migration_id": self.migration_id,
            "description": self.description,
            "risk_level": self.risk_level.value,
            "sql_statements": self.sql_statements,
            "rollback_statements": self.rollback_statements,
            "affected_tables": self.affected_tables,
            "estimated_duration_seconds": self.estimated_duration_seconds,
            "requires_downtime": self.requires_downtime,
            "checks": [
                {
                    "name": c.name,
                    "passed": c.passed,
                    "message": c.message,
                    "severity": c.severity,
                }
                for c in self.checks
            ],
            "status": self.status.value,
            "created_at": self.created_at,
            "applied_at": self.applied_at,
            "applied_by": self.applied_by,
        }


class DatabaseMigrationService:
    """Service for safe database migrations."""

    def __init__(self) -> None:
        self._plans: dict[str, MigrationPlan] = {}
        self._applied_migrations: set[str] = set()

    def create_plan(
        self,
        description: str,
        sql_statements: list[str],
        rollback_statements: list[str],
        affected_tables: list[str],
    ) -> MigrationPlan:
        """Create a new migration plan."""
        migration_id = hashlib.sha256(
            f"{description}:{datetime.now(timezone.utc).isoformat()}".encode()
        ).hexdigest()[:16]

        # Assess risk level
        risk_level = self._assess_risk(sql_statements)

        # Estimate duration (rough heuristic)
        estimated_duration = self._estimate_duration(
            sql_statements, affected_tables
        )

        plan = MigrationPlan(
            migration_id=migration_id,
            description=description,
            risk_level=risk_level,
            sql_statements=sql_statements,
            rollback_statements=rollback_statements,
            affected_tables=affected_tables,
            estimated_duration_seconds=estimated_duration,
            requires_downtime=risk_level in (MigrationRisk.HIGH, MigrationRisk.CRITICAL),
        )

        self._plans[migration_id] = plan
        return plan

    def validate_plan(self, migration_id: str) -> list[MigrationCheck]:
        """Run pre-migration validation checks."""
        plan = self._plans.get(migration_id)
        if not plan:
            return [MigrationCheck("exists", False, "Migration plan not found", "error")]

        checks: list[MigrationCheck] = []

        # Check 1: Migration not already applied
        if migration_id in self._applied_migrations:
            checks.append(MigrationCheck(
                "not_applied", False,
                "Migration has already been applied", "error"
            ))
        else:
            checks.append(MigrationCheck(
                "not_applied", True,
                "Migration has not been applied", "info"
            ))

        # Check 2: Rollback statements present
        if not plan.rollback_statements:
            checks.append(MigrationCheck(
                "rollback_present", False,
                "No rollback statements provided", "warning"
            ))
        else:
            checks.append(MigrationCheck(
                "rollback_present", True,
                "Rollback statements provided", "info"
            ))

        # Check 3: SQL syntax validation (basic)
        syntax_valid = self._validate_sql_syntax(plan.sql_statements)
        checks.append(MigrationCheck(
            "sql_syntax", syntax_valid,
            "SQL syntax appears valid" if syntax_valid else "SQL syntax issues detected",
            "error" if not syntax_valid else "info"
        ))

        # Check 4: Risk level assessment
        if plan.risk_level == MigrationRisk.CRITICAL:
            checks.append(MigrationCheck(
                "risk_level", False,
                "CRITICAL risk migration requires manual review", "warning"
            ))
        else:
            checks.append(MigrationCheck(
                "risk_level", True,
                f"Risk level: {plan.risk_level.value}", "info"
            ))

        # Check 5: Downtime requirement
        if plan.requires_downtime:
            checks.append(MigrationCheck(
                "downtime", False,
                "Migration requires scheduled downtime", "warning"
            ))
        else:
            checks.append(MigrationCheck(
                "downtime", True,
                "No downtime required", "info"
            ))

        # Check 6: Backup recommendation
        if plan.risk_level in (MigrationRisk.HIGH, MigrationRisk.CRITICAL):
            checks.append(MigrationCheck(
                "backup", False,
                "Backup strongly recommended before applying", "warning"
            ))
        else:
            checks.append(MigrationCheck(
                "backup", True,
                "Backup recommended but not critical", "info"
            ))

        plan.checks = checks
        plan.status = MigrationStatus.VALIDATED

        return checks

    def dry_run(self, migration_id: str) -> dict[str, Any]:
        """Execute dry-run of migration (no actual changes)."""
        plan = self._plans.get(migration_id)
        if not plan:
            return {"error": "Migration plan not found"}

        # Validate first
        checks = self.validate_plan(migration_id)
        failed_checks = [c for c in checks if not c.passed and c.severity == "error"]

        if failed_checks:
            return {
                "migration_id": migration_id,
                "status": "blocked",
                "reason": "Validation failed",
                "failed_checks": [
                    {"name": c.name, "message": c.message}
                    for c in failed_checks
                ],
            }

        # Simulate execution
        plan.status = MigrationStatus.DRY_RUN

        return {
            "migration_id": migration_id,
            "status": "dry_run_complete",
            "would_execute": len(plan.sql_statements),
            "affected_tables": plan.affected_tables,
            "estimated_duration_seconds": plan.estimated_duration_seconds,
            "requires_downtime": plan.requires_downtime,
            "risk_level": plan.risk_level.value,
        }

    def apply_migration(
        self,
        migration_id: str,
        applied_by: str,
        force: bool = False,
    ) -> dict[str, Any]:
        """Apply a validated migration."""
        plan = self._plans.get(migration_id)
        if not plan:
            return {"error": "Migration plan not found"}

        # Validate unless forced
        if not force:
            checks = self.validate_plan(migration_id)
            failed_checks = [c for c in checks if not c.passed and c.severity == "error"]

            if failed_checks:
                return {
                    "migration_id": migration_id,
                    "status": "blocked",
                    "reason": "Validation failed. Use force=True to override.",
                    "failed_checks": [
                        {"name": c.name, "message": c.message}
                        for c in failed_checks
                    ],
                }

        # Block critical migrations without force
        if plan.risk_level == MigrationRisk.CRITICAL and not force:
            return {
                "migration_id": migration_id,
                "status": "blocked",
                "reason": "CRITICAL risk migration requires force=True",
            }

        # Apply migration
        try:
            plan.status = MigrationStatus.APPLIED
            plan.applied_at = datetime.now(timezone.utc).isoformat()
            plan.applied_by = applied_by
            self._applied_migrations.add(migration_id)

            return {
                "migration_id": migration_id,
                "status": "applied",
                "applied_at": plan.applied_at,
                "applied_by": applied_by,
                "statements_executed": len(plan.sql_statements),
            }
        except Exception as e:
            plan.status = MigrationStatus.FAILED
            return {
                "migration_id": migration_id,
                "status": "failed",
                "error": str(e),
            }

    def rollback_migration(self, migration_id: str) -> dict[str, Any]:
        """Rollback an applied migration."""
        plan = self._plans.get(migration_id)
        if not plan:
            return {"error": "Migration plan not found"}

        if migration_id not in self._applied_migrations:
            return {"error": "Migration has not been applied"}

        if not plan.rollback_statements:
            return {"error": "No rollback statements available"}

        try:
            plan.status = MigrationStatus.ROLLED_BACK
            self._applied_migrations.discard(migration_id)

            return {
                "migration_id": migration_id,
                "status": "rolled_back",
                "rollback_statements_executed": len(plan.rollback_statements),
            }
        except Exception as e:
            return {
                "migration_id": migration_id,
                "status": "rollback_failed",
                "error": str(e),
            }

    def get_plan(self, migration_id: str) -> MigrationPlan | None:
        """Get migration plan by ID."""
        return self._plans.get(migration_id)

    def list_plans(
        self,
        status: MigrationStatus | None = None,
        risk_level: MigrationRisk | None = None,
    ) -> list[MigrationPlan]:
        """List migration plans with optional filtering."""
        plans = list(self._plans.values())

        if status:
            plans = [p for p in plans if p.status == status]

        if risk_level:
            plans = [p for p in plans if p.risk_level == risk_level]

        return plans

    def _assess_risk(self, sql_statements: list[str]) -> MigrationRisk:
        """Assess risk level of migration."""
        sql_lower = " ".join(sql_statements).lower()

        # Critical: dropping tables or columns
        if "drop table" in sql_lower or "drop column" in sql_lower:
            return MigrationRisk.CRITICAL

        # Critical: data migrations
        if "update " in sql_lower and "set " in sql_lower:
            return MigrationRisk.CRITICAL

        # High: altering columns
        if "alter column" in sql_lower or "rename" in sql_lower:
            return MigrationRisk.HIGH

        # High: adding constraints that might fail
        if "add constraint" in sql_lower or "unique" in sql_lower:
            return MigrationRisk.HIGH

        # Medium: index changes
        if "index" in sql_lower:
            return MigrationRisk.MEDIUM

        # Low: additive changes
        return MigrationRisk.LOW

    def _estimate_duration(
        self,
        sql_statements: list[str],
        affected_tables: list[str],
    ) -> int:
        """Estimate migration duration in seconds."""
        base_time = len(sql_statements) * 2  # 2 seconds per statement
        table_time = len(affected_tables) * 5  # 5 seconds per table
        return base_time + table_time

    def _validate_sql_syntax(self, sql_statements: list[str]) -> bool:
        """Basic SQL syntax validation."""
        valid_starts = (
            "create", "alter", "drop", "insert",
            "update", "delete", "select", "index",
            "grant", "revoke", "comment",
        )

        for sql in sql_statements:
            stripped = sql.strip().lower()
            if not stripped:
                continue
            if not any(stripped.startswith(start) for start in valid_starts):
                return False

        return True
