import io
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud import attachments_crud, checks_crud, recommendations_crud
from app.models.attachments import Attachment
from app.schemas.attachments import (
    CHECK_ATTACHMENT_SLOTS,
    RECOMMENDATION_ATTACHMENT_SLOTS,
    AttachmentListResponse,
    AttachmentUploadResponse,
    StorageStatusResponse,
)
from app.services.crud_errors import (
    AttachmentTooLargeError,
    EmptyAttachmentPayloadError,
    InvalidAttachmentSlotError,
    ResourceNotFoundError,
    StorageDisabledError,
    StorageOperationError,
    UnsupportedAttachmentContentTypeError,
)
from app.services.storage.minio_storage import require_storage

logger = logging.getLogger(__name__)

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


def validate_attachment_slot(entity_type: str, slot: str) -> None:
    allowed = CHECK_ATTACHMENT_SLOTS if entity_type == "check" else RECOMMENDATION_ATTACHMENT_SLOTS
    if slot not in allowed:
        raise InvalidAttachmentSlotError(f"Недопустимый слот «{slot}» для entity_type={entity_type}.")


async def resolve_attachment_target(
    session: AsyncSession,
    entity_type: str,
    entity_id: int,
) -> tuple[str, int | None]:
    if entity_type == "check":
        check = await checks_crud.get_check(session, entity_id)
        if check is None:
            raise ResourceNotFoundError("Проверка не найдена.")
        return check.serial_number, None

    recommendation = await recommendations_crud.get_recommendation(session, entity_id)
    if recommendation is None:
        raise ResourceNotFoundError("Рекомендация не найдена.")
    check = await checks_crud.get_check(session, recommendation.check_id)
    if check is None:
        raise ResourceNotFoundError("Проверка для рекомендации не найдена.")
    return check.serial_number, recommendation.id


async def get_storage_status() -> StorageStatusResponse:
    if not settings.minio_enabled:
        return StorageStatusResponse(enabled=False, reachable=False)
    storage = require_storage()
    reachable = await storage.ping()
    return StorageStatusResponse(enabled=True, reachable=reachable)


async def list_attachments(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    slot: Optional[str] = None,
) -> AttachmentListResponse:
    await resolve_attachment_target(session, entity_type, entity_id)
    if slot:
        validate_attachment_slot(entity_type, slot)
    items = await attachments_crud.list_attachments(
        session,
        entity_type=entity_type,
        entity_id=entity_id,
        slot=slot,
    )
    total = await attachments_crud.count_attachments(
        session,
        entity_type=entity_type,
        entity_id=entity_id,
        slot=slot,
    )
    return AttachmentListResponse(items=list(items), total=total)


async def upload_attachment(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
    slot: str,
    original_name: str,
    content_type: str,
    payload: bytes,
) -> AttachmentUploadResponse:
    if not settings.minio_enabled:
        raise StorageDisabledError("Файловое хранилище не настроено.")

    validate_attachment_slot(entity_type, slot)
    serial_number, recommendation_id = await resolve_attachment_target(session, entity_type, entity_id)

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedAttachmentContentTypeError(f"Тип файла не поддерживается: {content_type}.")
    if not payload:
        raise EmptyAttachmentPayloadError("Пустой файл.")
    if len(payload) > settings.max_upload_bytes:
        raise AttachmentTooLargeError(f"Файл превышает лимит {settings.sokol_max_upload_mb} МБ.")

    storage = require_storage()
    try:
        stored = await storage.upload(
            serial_number,
            slot,
            io.BytesIO(payload),
            original_name=original_name,
            content_type=content_type,
            size_bytes=len(payload),
            recommendation_id=recommendation_id if entity_type == "recommendation" else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("MinIO upload failed for check %s slot %s", serial_number, slot)
        raise StorageOperationError("Не удалось сохранить файл в хранилище.") from exc

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
    saved = await attachments_crud.create_attachment(session, row)
    return AttachmentUploadResponse(attachment=saved)


async def download_attachment(
    session: AsyncSession,
    attachment_id: int,
) -> tuple[Attachment, bytes, str]:
    if not settings.minio_enabled:
        raise StorageDisabledError("Файловое хранилище не настроено.")

    attachment = await attachments_crud.get_attachment(session, attachment_id)
    if attachment is None:
        raise ResourceNotFoundError("Вложение не найдено.")

    storage = require_storage()
    try:
        payload, content_type = await storage.download(attachment.bucket, attachment.object_key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("MinIO download failed for attachment %s", attachment_id)
        raise StorageOperationError("Не удалось прочитать файл из хранилища.") from exc

    return attachment, payload, content_type or attachment.content_type


async def delete_attachment(session: AsyncSession, attachment_id: int) -> None:
    if not settings.minio_enabled:
        raise StorageDisabledError("Файловое хранилище не настроено.")

    attachment = await attachments_crud.get_attachment(session, attachment_id)
    if attachment is None:
        raise ResourceNotFoundError("Вложение не найдено.")

    storage = require_storage()
    try:
        await storage.delete_object(attachment.bucket, attachment.object_key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("MinIO delete failed for attachment %s", attachment_id)
        raise StorageOperationError("Не удалось удалить файл из хранилища.") from exc

    await attachments_crud.delete_attachment(session, attachment)

