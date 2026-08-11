import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.attachments_crud import (
    count_attachments,
    create_attachment,
    delete_attachment,
    get_attachment,
    list_attachments,
)
from app.crud.checks_crud import get_check
from app.crud.recommendations_crud import get_recommendation
from app.db.session import get_db_session
from app.api.deps import require_admin
from app.models.attachments import Attachment
from app.schemas.attachments import (
    CHECK_ATTACHMENT_SLOTS,
    RECOMMENDATION_ATTACHMENT_SLOTS,
    AttachmentListResponse,
    AttachmentRead,
    AttachmentUploadResponse,
    StorageStatusResponse,
)
from app.services.storage.minio_storage import require_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attachments", tags=["attachments"])

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "text/plain",
        "application/octet-stream",
        "application/zip",
        "application/x-zip-compressed",
    }
)


def _validate_slot(entity_type: str, slot: str) -> None:
    allowed = CHECK_ATTACHMENT_SLOTS if entity_type == "check" else RECOMMENDATION_ATTACHMENT_SLOTS
    if slot not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый слот «{slot}» для entity_type={entity_type}.",
        )


async def _resolve_check_serial(
    session: AsyncSession,
    entity_type: str,
    entity_id: int,
) -> tuple[str, int | None]:
    if entity_type == "check":
        check = await get_check(session, entity_id)
        if not check:
            raise HTTPException(status_code=404, detail="Проверка не найдена.")
        return check.serial_number, None

    recommendation = await get_recommendation(session, entity_id)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Рекомендация не найдена.")
    check = await get_check(session, recommendation.check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Проверка для рекомендации не найдена.")
    return check.serial_number, recommendation.id


@router.get("/storage/status", response_model=StorageStatusResponse)
async def storage_status() -> StorageStatusResponse:
    if not settings.minio_enabled:
        return StorageStatusResponse(enabled=False, reachable=False)
    storage = require_storage()
    reachable = await storage.ping()
    return StorageStatusResponse(enabled=True, reachable=reachable)


@router.get("", response_model=AttachmentListResponse)
async def list_attachments_endpoint(
    entity_type: str = Query(..., pattern="^(check|recommendation)$"),
    entity_id: int = Query(..., ge=1),
    slot: Optional[str] = Query(None, min_length=1, max_length=64),
    session: AsyncSession = Depends(get_db_session),
) -> AttachmentListResponse:
    await _resolve_check_serial(session, entity_type, entity_id)
    if slot:
        _validate_slot(entity_type, slot)
    items = await list_attachments(session, entity_type=entity_type, entity_id=entity_id, slot=slot)
    total = await count_attachments(session, entity_type=entity_type, entity_id=entity_id, slot=slot)
    return AttachmentListResponse(items=list(items), total=total)


@router.post("", response_model=AttachmentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment_endpoint(
    entity_type: str = Form(..., pattern="^(check|recommendation)$"),
    entity_id: int = Form(..., ge=1),
    slot: str = Form(..., min_length=1, max_length=64),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> AttachmentUploadResponse:
    if not settings.minio_enabled:
        raise HTTPException(status_code=503, detail="Файловое хранилище не настроено.")

    _validate_slot(entity_type, slot)
    serial_number, recommendation_id = await _resolve_check_serial(session, entity_type, entity_id)

    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail=f"Тип файла не поддерживается: {content_type}.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Пустой файл.")
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Файл превышает лимит {settings.sokol_max_upload_mb} МБ.",
        )

    original_name = file.filename or "file"
    storage = require_storage()
    buffer = io.BytesIO(payload)
    try:
        stored = await storage.upload(
            serial_number,
            slot,
            buffer,
            original_name=original_name,
            content_type=content_type,
            size_bytes=len(payload),
            recommendation_id=recommendation_id if entity_type == "recommendation" else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("MinIO upload failed for check %s slot %s", serial_number, slot)
        raise HTTPException(status_code=502, detail="Не удалось сохранить файл в хранилище.") from exc

    row = Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        slot=slot,
        check_serial_number=serial_number,
        bucket=stored.bucket,
        object_key=stored.object_key,
        original_name=original_name,
        content_type=content_type,
        size_bytes=stored.size_bytes,
    )
    saved = await create_attachment(session, row)
    return AttachmentUploadResponse(attachment=saved)


@router.get("/{attachment_id}/download")
async def download_attachment_endpoint(
    attachment_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    if not settings.minio_enabled:
        raise HTTPException(status_code=503, detail="Файловое хранилище не настроено.")

    attachment = await get_attachment(session, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Вложение не найдено.")

    storage = require_storage()
    try:
        payload, content_type = await storage.download(attachment.bucket, attachment.object_key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("MinIO download failed for attachment %s", attachment_id)
        raise HTTPException(status_code=502, detail="Не удалось прочитать файл из хранилища.") from exc

    media_type = content_type or attachment.content_type
    headers = {
        "Content-Disposition": f'attachment; filename="{attachment.original_name}"',
    }
    return Response(content=payload, media_type=media_type, headers=headers)


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment_endpoint(
    attachment_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> None:
    if not settings.minio_enabled:
        raise HTTPException(status_code=503, detail="Файловое хранилище не настроено.")

    attachment = await get_attachment(session, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Вложение не найдено.")

    storage = require_storage()
    try:
        await storage.delete_object(attachment.bucket, attachment.object_key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("MinIO delete failed for attachment %s", attachment_id)
        raise HTTPException(status_code=502, detail="Не удалось удалить файл из хранилища.") from exc

    await delete_attachment(session, attachment)
    return None
