from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.fax import FaxListOut, FaxOut, FaxSendRequest, FaxMatchRequest
from app.services import fax_service

router = APIRouter(prefix="/api/faxes", tags=["faxes"])


@router.get("", response_model=FaxListOut)
async def list_faxes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    direction: str | None = Query(None),
    status: str | None = Query(None),
    patient_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data, total = await fax_service.list_faxes(db, page=page, page_size=page_size, direction=direction, status=status, patient_id=patient_id)
    return FaxListOut(data=[FaxOut(**f) for f in data], total=total, page=page, page_size=page_size)


@router.get("/{fax_id}", response_model=FaxOut)
async def get_fax(fax_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    fax = await fax_service.get_fax(db, fax_id)
    if not fax:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fax not found")
    return FaxOut(**fax)


@router.post("/send", response_model=FaxOut, status_code=status.HTTP_201_CREATED)
async def send_fax(data: FaxSendRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    fax = await fax_service.send_fax(db, current_user, data.to_number, data.patient_id, data.file_url)
    return FaxOut(**fax)


@router.post("/{fax_id}/match", response_model=FaxOut)
async def match_fax(fax_id: str, data: FaxMatchRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    fax = await fax_service.match_fax(db, current_user, fax_id, data.patient_id)
    if not fax:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fax not found")
    return FaxOut(**fax)
