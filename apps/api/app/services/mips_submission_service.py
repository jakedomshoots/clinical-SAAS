"""MIPS (Merit-Based Incentive Payment System) submission automation.

Automates quality measure reporting to CMS via registry submission
or direct QRDA upload. Calculates MIPS score and payment adjustment.

Registry options: Mingle Analytics, Clinigence, CECity, IRIS Registry
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any

import httpx

from app.config import settings


class MIPSPerformanceCategory(str, Enum):
    quality = "quality"           # 30% of score
    pi = "promoting_interoperability"  # 25% of score
    improvement_activities = "improvement_activities"  # 15% of score
    cost = "cost"                 # 30% of score (calculated by CMS)


class MIPSRegistry(str, Enum):
    mingle = "mingle"
    clinigence = "clinigence"
    cecity = "cecity"
    iris = "iris"


@dataclass
class MIPSMeasureResult:
    measure_id: str
    measure_name: str
    denominator: int
    numerator: int
    exclusions: int
    performance_rate: float
    benchmark_decile: int | None  # 1-10, CMS benchmark
    points_earned: float
    points_available: float


class MIPSSubmissionService:
    """Service for automating MIPS quality data submission."""

    # CMS benchmark deciles (simplified — real data from CMS annual benchmarks)
    # Decile 1 = lowest performance, Decile 10 = highest
    BENCHMARKS: dict[str, list[float]] = {
        "cms122": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],   # HbA1c poor control (lower is better)
        "cms165": [0, 20, 40, 50, 60, 70, 75, 80, 85, 90],   # BP control (higher is better)
        "cms125": [0, 20, 40, 50, 60, 70, 75, 80, 85, 90],   # Mammogram (higher is better)
        "cms130": [0, 15, 30, 45, 55, 65, 72, 78, 84, 90],   # Colorectal screening (higher)
        "cms138": [0, 30, 50, 60, 70, 75, 80, 85, 90, 95],   # Tobacco screening (higher)
        "cms147": [0, 30, 50, 60, 70, 75, 80, 85, 90, 95],   # Flu vaccine (higher)
        "cms127": [0, 20, 40, 50, 60, 70, 75, 80, 85, 90],   # Pneumococcal (higher)
        "cms117": [0, 30, 50, 60, 70, 75, 80, 85, 90, 95],   # Childhood immunizations (higher)
        "cms131": [0, 20, 40, 50, 60, 70, 75, 80, 85, 90],   # Diabetic eye exam (higher)
        "cms134": [0, 20, 40, 50, 60, 70, 75, 80, 85, 90],   # Diabetic nephropathy (higher)
    }

    def __init__(self) -> None:
        self._registry_api_key = settings.mips_registry_api_key
        self._registry_url = settings.mips_registry_url
        self._registry_type = settings.mips_registry_type
        self._npi = settings.mips_provider_npi
        self._tin = settings.mips_provider_tin

    def calculate_measure_points(
        self,
        measure_id: str,
        performance_rate: float,
    ) -> tuple[float, float, int | None]:
        """Calculate MIPS points for a measure based on CMS benchmarks.

        Returns: (points_earned, points_available, decile)
        """
        benchmarks = self.BENCHMARKS.get(measure_id)
        if not benchmarks:
            return 0.0, 10.0, None

        # Find decile
        decile = None
        for i, threshold in enumerate(benchmarks):
            if performance_rate >= threshold:
                decile = i + 1

        if decile is None:
            decile = 1

        # Points: 3-10 points based on decile
        # Decile 1-3 = 3 points (floor)
        # Decile 4-9 = 4-9 points
        # Decile 10 = 10 points
        if decile <= 3:
            points = 3.0
        else:
            points = float(decile)

        return points, 10.0, decile

    def calculate_mips_score(
        self,
        measure_results: list[MIPSMeasureResult],
        pi_score: float = 0.0,
        ia_score: float = 0.0,
        cost_score: float = 0.0,
    ) -> dict[str, Any]:
        """Calculate total MIPS composite score.

        Weights:
        - Quality: 30%
        - Promoting Interoperability: 25%
        - Improvement Activities: 15%
        - Cost: 30% (CMS calculates)
        """
        # Quality score: average of measure points, max 60 points
        total_quality_points = sum(m.points_earned for m in measure_results)
        total_quality_available = sum(m.points_available for m in measure_results)
        quality_score = (total_quality_points / total_quality_available * 60) if total_quality_available > 0 else 0
        quality_score = min(quality_score, 60)

        # Normalize each category to 0-100
        quality_normalized = (quality_score / 60) * 100 if quality_score > 0 else 0
        pi_normalized = min(pi_score, 100)
        ia_normalized = min(ia_score, 100)
        cost_normalized = min(cost_score, 100)

        # Weighted composite
        composite = (
            quality_normalized * 0.30 +
            pi_normalized * 0.25 +
            ia_normalized * 0.15 +
            cost_normalized * 0.30
        )

        # Payment adjustment (2026 scale)
        # 0-74.99 = penalty (up to -9%)
        # 75 = neutral
        # 75.01-100 = bonus (up to +9%)
        if composite >= 89:
            adjustment = 9.0
        elif composite >= 75:
            adjustment = ((composite - 75) / 25) * 9.0
        elif composite >= 69.5:
            adjustment = 0.0
        else:
            adjustment = -9.0

        return {
            "composite_score": round(composite, 1),
            "quality_score": round(quality_normalized, 1),
            "pi_score": round(pi_normalized, 1),
            "ia_score": round(ia_normalized, 1),
            "cost_score": round(cost_normalized, 1),
            "payment_adjustment_percent": round(adjustment, 1),
            "estimated_impact": "bonus" if adjustment > 0 else "penalty" if adjustment < 0 else "neutral",
            "measure_results": [
                {
                    "measure_id": m.measure_id,
                    "measure_name": m.measure_name,
                    "denominator": m.denominator,
                    "numerator": m.numerator,
                    "performance_rate": m.performance_rate,
                    "decile": m.benchmark_decile,
                    "points": f"{m.points_earned}/{m.points_available}",
                }
                for m in measure_results
            ],
        }

    async def submit_to_registry(
        self,
        measure_results: list[MIPSMeasureResult],
        performance_year: int,
        submission_method: str = "registry",
    ) -> dict[str, Any]:
        """Submit MIPS quality data to a registry.

        Registries validate, aggregate, and submit to CMS on behalf of providers.
        """
        if not self._registry_api_key:
            return {
                "status": "demo",
                "message": "MIPS registry not configured",
                "action": "Configure MIPS_REGISTRY_API_KEY and MIPS_REGISTRY_URL in environment",
                "data_preview": {
                    "npi": self._npi,
                    "tin": self._tin,
                    "performance_year": performance_year,
                    "measures_submitted": len(measure_results),
                },
            }

        payload = {
            "npi": self._npi,
            "tin": self._tin,
            "performance_year": performance_year,
            "submission_method": submission_method,
            "measures": [
                {
                    "measure_id": m.measure_id,
                    "denominator": m.denominator,
                    "numerator": m.numerator,
                    "exclusions": m.exclusions,
                    "performance_rate": m.performance_rate,
                }
                for m in measure_results
            ],
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self._registry_url}/api/v1/mips/submit",
                headers={"Authorization": f"Bearer {self._registry_api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    def generate_submission_preview(
        self,
        measure_results: list[MIPSMeasureResult],
        performance_year: int,
    ) -> dict[str, Any]:
        """Generate a preview of what will be submitted to CMS."""
        mips_score = self.calculate_mips_score(measure_results)

        return {
            "preview_only": True,
            "performance_year": performance_year,
            "provider_npi": self._npi,
            "provider_tin": self._tin,
            "submission_date": datetime.now(UTC).isoformat(),
            "measures": [
                {
                    "measure_id": m.measure_id,
                    "measure_name": m.measure_name,
                    "denominator": m.denominator,
                    "numerator": m.numerator,
                    "performance_rate": f"{m.performance_rate:.1f}%",
                    "cms_decile": m.benchmark_decile,
                    "points": f"{m.points_earned}/{m.points_available}",
                }
                for m in measure_results
            ],
            "projected_mips_score": mips_score["composite_score"],
            "projected_payment_adjustment": f"{mips_score['payment_adjustment_percent']:.1f}%",
            "projected_impact": mips_score["estimated_impact"],
            "submission_deadline": f"{performance_year + 1}-03-31",
            "registry_recommended": self._registry_type or "mingle",
        }

    def get_submission_timeline(self, performance_year: int) -> list[dict[str, Any]]:
        """Get key dates for MIPS submission."""
        return [
            {
                "date": f"{performance_year}-01-01",
                "event": "Performance period begins",
                "action_required": "Start collecting quality data",
            },
            {
                "date": f"{performance_year}-03-01",
                "event": "MIPS eligibility check",
                "action_required": "Verify NPI is eligible for MIPS",
            },
            {
                "date": f"{performance_year}-10-01",
                "event": "Data collection review",
                "action_required": "Review measure performance, identify gaps",
            },
            {
                "date": f"{performance_year}-12-31",
                "event": "Performance period ends",
                "action_required": "Finalize all quality data",
            },
            {
                "date": f"{performance_year + 1}-01-01",
                "event": "Submission period opens",
                "action_required": "Begin submission via registry or QPP portal",
            },
            {
                "date": f"{performance_year + 1}-03-31",
                "event": "Submission deadline",
                "action_required": "Final submission to CMS",
                "critical": True,
            },
            {
                "date": f"{performance_year + 1}-07-01",
                "event": "Feedback reports available",
                "action_required": "Review MIPS score and payment adjustment",
            },
            {
                "date": f"{performance_year + 2}-01-01",
                "event": "Payment adjustment applied",
                "action_required": "Verify adjustment on Medicare claims",
            },
        ]
