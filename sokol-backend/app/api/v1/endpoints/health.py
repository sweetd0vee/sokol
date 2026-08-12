from fastapi import APIRouter

from app.core.config import settings


router = APIRouter()


@router.get("/status")
async def status() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/capabilities")
async def capabilities() -> dict[str, int]:
    return {
        "max_upload_mb": settings.sokol_max_upload_mb,
        "max_upload_bytes": settings.max_upload_bytes,
    }
