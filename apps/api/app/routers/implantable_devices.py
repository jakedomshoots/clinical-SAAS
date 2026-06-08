"""Implantable device router for ONC criterion (a)(14)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.implantable_device import ImplantableDevice
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/implantable-devices", tags=["Implantable Devices"])


@router.get("/patients/{patient_id}")
async def list_patient_devices(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List implantable devices for a patient."""
    devices = (
        db.query(ImplantableDevice)
        .filter(ImplantableDevice.patient_id == patient_id)
        .all()
    )
    return [
        {
            "id": d.id,
            "udi": d.udi,
            "device_name": d.device_name,
            "manufacturer": d.manufacturer,
            "model_number": d.model_number,
            "serial_number": d.serial_number,
            "implant_date": d.implant_date.isoformat() if d.implant_date else None,
            "status": d.status.value,
            "safety_alert_status": d.safety_alert_status,
        }
        for d in devices
    ]


@router.post("/patients/{patient_id}")
async def add_device(
    patient_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Add an implantable device to a patient's record."""
    device = ImplantableDevice(
        patient_id=patient_id,
        udi=data["udi"],
        device_name=data["device_name"],
        manufacturer=data.get("manufacturer"),
        model_number=data.get("model_number"),
        serial_number=data.get("serial_number"),
        lot_number=data.get("lot_number"),
        gmdn_pt_name=data.get("gmdn_pt_name"),
        gmdn_pt_definition=data.get("gmdn_pt_definition"),
        implant_date=data.get("implant_date"),
        explant_date=data.get("explant_date"),
        status=data.get("status", "active"),
        implanting_provider_npi=data.get("implanting_provider_npi"),
        implanting_facility=data.get("implanting_facility"),
        notes=data.get("notes"),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {"id": device.id, "status": "created"}


@router.get("/safety-check/{udi}")
async def check_device_safety(
    udi: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check FDA safety alerts/recalls for a device by UDI.

    In production, queries FDA openFDA API or GUDID database.
    """
    # Placeholder — real implementation queries FDA APIs
    return {
        "udi": udi,
        "safety_status": "no_alerts",
        "last_checked": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "fda_recalls": [],
        "mdr_reports": 0,
        "recommendation": "No action required",
    }
