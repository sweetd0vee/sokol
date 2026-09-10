import asyncio
import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import log_caught_exception
from app.core.metrics import snapshot_metrics
from app.db.session import AsyncSessionLocal


logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def status() -> dict[str, object]:
    return {"status": "ok", **snapshot_metrics()}


@router.get("/ready")
async def ready() -> dict[str, str]:
    try:
        async with AsyncSessionLocal() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=2.0)
    except Exception:
        log_caught_exception(logger, "readiness database check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="База данных недоступна.",
        ) from None
    return {"status": "ok", "database": "ok"}


@router.get("/capabilities")
async def capabilities() -> dict[str, int]:
    return {
        "max_upload_mb": settings.sokol_max_upload_mb,
        "max_upload_bytes": settings.max_upload_bytes,
        "docx_max_concurrent": settings.docx_max_concurrent,
        "docx_max_queue": settings.docx_max_queue,
        "docx_queue_wait_seconds": int(settings.docx_queue_wait_seconds),
    }
