import asyncio
import logging

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import log_caught_exception
from app.core.metrics import prometheus_text, snapshot_metrics
from app.core.startup_validation import is_production_env
from app.db.session import AsyncSessionLocal
from app.services.reports.docx_queue import get_docx_job_limiter


logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def status_endpoint() -> dict[str, object]:
    return {
        "status": "ok",
        "env": "prod" if is_production_env(settings.sokol_env) else "development",
        **snapshot_metrics(),
        **get_docx_job_limiter().snapshot(),
    }


@router.get("/metrics")
async def metrics_endpoint() -> Response:
    body = prometheus_text(snapshot_metrics(), get_docx_job_limiter().snapshot())
    return Response(content=body, media_type="text/plain; version=0.0.4; charset=utf-8")


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
