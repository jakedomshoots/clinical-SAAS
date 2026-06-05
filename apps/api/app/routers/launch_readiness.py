from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models.user import User
from app.services.launch_readiness_service import launch_readiness

router = APIRouter(prefix="/api/launch-readiness", tags=["launch-readiness"])


@router.get("")
async def get_launch_readiness(
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    return await launch_readiness()
