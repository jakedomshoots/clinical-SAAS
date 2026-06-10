"""Admin dashboard router for monitoring and management.

Provides endpoints for:
- Adapter health monitoring
- System metrics
- User activity
- Integration status
- Alert management
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.integrations.factory import IntegrationFactory
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin", tags=["admin"])


async def get_audit_service() -> AuditService:
    """Dependency to get audit service."""
    return AuditService()


@router.get("/dashboard")
async def get_dashboard_summary(
    audit_service: AuditService = Depends(get_audit_service),
) -> dict[str, Any]:
    """Get admin dashboard summary."""
    # Get integration health
    integrations = await _get_integration_health()

    # Get recent audit stats
    stats = await _get_audit_stats(audit_service)

    # Get system status
    system_status = await _get_system_status()

    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "integrations": integrations,
        "audit_stats": stats,
        "system_status": system_status,
        "alerts": await _get_active_alerts(),
    }


@router.get("/integrations/health")
async def get_integration_health() -> dict[str, Any]:
    """Get detailed health status for all integrations."""
    return {"integrations": await _get_integration_health()}


@router.get("/integrations/{integration_key}/health")
async def get_single_integration_health(
    integration_key: str,
) -> dict[str, Any]:
    """Get health status for a specific integration."""
    factory = IntegrationFactory()
    client = factory.get_client(integration_key)

    if not client:
        raise HTTPException(status_code=404, detail="Integration not found")

    health = await client.health()

    return {
        "integration": integration_key,
        "health": health.as_dict(),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/integrations/{integration_key}/metrics")
async def get_integration_metrics(
    integration_key: str,
    hours: int = 24,
) -> dict[str, Any]:
    """Get metrics for a specific integration."""
    # In production, this would query metrics database
    return {
        "integration": integration_key,
        "period_hours": hours,
        "metrics": {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "average_latency_ms": 0,
            "last_error": None,
            "last_success": None,
        },
    }


@router.get("/audit/summary")
async def get_audit_summary(
    hours: int = 24,
    audit_service: AuditService = Depends(get_audit_service),
) -> dict[str, Any]:
    """Get audit log summary."""
    return await _get_audit_stats(audit_service, hours)


@router.get("/users/activity")
async def get_user_activity_summary(
    hours: int = 24,
    audit_service: AuditService = Depends(get_audit_service),
) -> dict[str, Any]:
    """Get user activity summary."""
    start_time = datetime.now(UTC) - timedelta(hours=hours)
    events = audit_service._chain.get_events(
        start_time=start_time.isoformat(),
        limit=10000,
    )

    # Count by actor
    actor_activity: dict[str, dict[str, Any]] = {}
    for event in events:
        actor_id = event.actor_id
        if actor_id not in actor_activity:
            actor_activity[actor_id] = {
                "actor_id": actor_id,
                "actor_type": event.actor_type,
                "total_actions": 0,
                "categories": set(),
                "last_seen": event.timestamp,
            }

        actor_activity[actor_id]["total_actions"] += 1
        actor_activity[actor_id]["categories"].add(event.category.value)

    # Convert sets to lists for JSON serialization
    for actor in actor_activity.values():
        actor["categories"] = list(actor["categories"])

    return {
        "period_hours": hours,
        "total_events": len(events),
        "active_users": len(actor_activity),
        "users": list(actor_activity.values()),
    }


@router.get("/alerts")
async def get_alerts(
    status: str = "active",
) -> dict[str, Any]:
    """Get system alerts."""
    alerts = await _get_active_alerts()

    if status == "active":
        alerts = [a for a in alerts if a["status"] == "active"]
    elif status == "resolved":
        alerts = [a for a in alerts if a["status"] == "resolved"]

    return {
        "alerts": alerts,
        "total": len(alerts),
        "active_count": len([a for a in alerts if a["status"] == "active"]),
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
) -> dict[str, str]:
    """Acknowledge an alert."""
    # In production, update alert status in database
    return {"status": "acknowledged", "alert_id": alert_id}


@router.get("/system/status")
async def get_system_status() -> dict[str, Any]:
    """Get overall system status."""
    return await _get_system_status()


@router.get("/system/metrics")
async def get_system_metrics(
    hours: int = 24,
) -> dict[str, Any]:
    """Get system metrics."""
    return {
        "period_hours": hours,
        "metrics": {
            "cpu_usage": 0,
            "memory_usage": 0,
            "disk_usage": 0,
            "network_io": 0,
            "active_connections": 0,
        },
    }


# Helper functions


async def _get_integration_health() -> list[dict[str, Any]]:
    """Get health status for all integrations."""
    factory = IntegrationFactory()
    results = []

    for key in factory._clients:
        client = factory.get_client(key)
        if client:
            health = await client.health()
            results.append(
                {
                    "key": key,
                    "name": client.name,
                    "configured": health.configured,
                    "healthy": health.ok,
                    "mode": health.as_dict().get("mode", "unknown"),
                    "adapter_implemented": health.adapter_implemented,
                    "last_check": datetime.now(UTC).isoformat(),
                }
            )

    return results


async def _get_audit_stats(
    audit_service: AuditService,
    hours: int = 24,
) -> dict[str, Any]:
    """Get audit statistics."""
    start_time = datetime.now(UTC) - timedelta(hours=hours)
    events = audit_service._chain.get_events(
        start_time=start_time.isoformat(),
        limit=10000,
    )

    category_counts: dict[str, int] = {}
    success_count = 0
    failure_count = 0

    for event in events:
        category_counts[event.category.value] = category_counts.get(event.category.value, 0) + 1
        if event.success:
            success_count += 1
        else:
            failure_count += 1

    return {
        "period_hours": hours,
        "total_events": len(events),
        "success_count": success_count,
        "failure_count": failure_count,
        "category_breakdown": category_counts,
    }


async def _get_system_status() -> dict[str, Any]:
    """Get system status."""
    return {
        "status": "operational",
        "components": {
            "api": "healthy",
            "database": "healthy",
            "cache": "healthy",
            "object_storage": "healthy",
        },
        "last_updated": datetime.now(UTC).isoformat(),
    }


async def _get_active_alerts() -> list[dict[str, Any]]:
    """Get active system alerts."""
    # In production, query alert database
    return []
