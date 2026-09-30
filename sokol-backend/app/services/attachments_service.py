import io
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.current_user import CurrentUser
from app.core.config import settings
from app.core.recommendation_access import (
    ensure_user_can_manage_check,
    ensure_user_can_manage_recommendation,
    user_can_manage_recommendation,
)
from app.crud import attachments_crud, checks_crud, recommendations_crud
from app.models.recommendations import Recommendation
from app.models.attachments import Attachment
from app.schemas.attachments import (
    CHECK_ATTACHMENT_SLOTS,
    RECOMMENDATION_ATTACHMENT_SLOTS,
    AttachmentListResponse,
    AttachmentUploadResponse,
    StorageStatusResponse,
)
from app.core.exceptions import (
    AttachmentTooLargeError,
    EmptyAttachmentPayloadError,
    InvalidAttachmentSlotError,
    ResourceNotFoundError,
    StorageDisabledError,
    StorageOperationError,
    UnsupportedAttachmentContentTypeError,
)
from app.core.logging import log_caught_exception
from app.services.storage.minio_storage import get_storage, require_storage

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
) -> tuple[str, int | None, Recommendation | None]:
    if entity_type == "check":
        check = await checks_crud.get_check(session, entity_id)
        if check is None:
            raise ResourceNotFoundError("Проверка не найдена.")
        return check.serial_number, None, None

    recommendation = await recommendations_crud.get_recommendation(session, entity_id)
    if recommendation is None:
        raise ResourceNotFoundError("Рекомендация не найдена.")
    check = await checks_crud.get_check(session, recommendation.check_id)
    if check is None:
        raise ResourceNotFoundError("Проверка для рекомендации не найдена.")
    return check.serial_number, recommendation.id, recommendation


async def get_storage_status() -> StorageStatusResponse:
    if not settings.minio_enabled:
        return StorageStatusResponse(enabled=False, reachable=False)
    storage = require_storage()
    reachable = await storage.ping()
    return StorageStatusResponse(enabled=True, reachable=reachable)


async def _ensure_user_can_manage_check(session: AsyncSession, user: CurrentUser, check_id: int) -> None:
    check = await checks_crud.get_check(session, check_id)
    if check is None:
        raise ResourceNotFoundError("Проверка не найдена.")
    ensure_user_can_manage_check(
        role=user.role,
        username=user.username,
        check_leader=check.check_leader,
        created_by=check.created_by,
        message="Недостаточно прав для операции с вложениями этой проверки.",
    )


async def _ensure_user_can_manage_recommendation(
    session: AsyncSession,
    user: CurrentUser,
    recommendation: Recommendation,
) -> None:
    message = "Недостаточно прав для операции с вложениями этой рекомендации."
    if user_can_manage_recommendation(
        role=user.role,
        username=user.username,
        auditor=recommendation.auditor,
        created_by=recommendation.created_by,
    ):
        return
    check = await checks_crud.get_check(session, recommendation.check_id)
    ensure_user_can_manage_recommendation(
        role=user.role,
        username=user.username,
        auditor=recommendation.auditor,
        created_by=recommendation.created_by,
        check_leader=None if check is None else check.check_leader,
        check_created_by=None if check is None else check.created_by,
        message=message,
    )


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
    user: CurrentUser,
) -> AttachmentUploadResponse:
    if not settings.minio_enabled:
        raise StorageDisabledError("Файловое хранилище не настроено.")

    validate_attachment_slot(entity_type, slot)
    serial_number, recommendation_id, recommendation = await resolve_attachment_target(
        session,
        entity_type,
        entity_id,
    )
    if entity_type == "check":
        await _ensure_user_can_manage_check(session, user, entity_id)
    elif recommendation is not None:
        await _ensure_user_can_manage_recommendation(session, user, recommendation)

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
        log_caught_exception(logger, "MinIO upload failed for check %s slot %s", serial_number, slot)
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
    try:
        saved = await attachments_crud.create_attachment(session, row)
        await session.commit()
        await session.refresh(saved)
    except Exception:
        await session.rollback()
        log_caught_exception(
            logger,
            "Failed to persist attachment metadata for %s/%s",
            stored.bucket,
            stored.object_key,
        )
        try:
            await storage.delete_object(stored.bucket, stored.object_key)
        except Exception:  # noqa: BLE001
            log_caught_exception(
                logger,
                "Failed to compensate orphan upload %s/%s",
                stored.bucket,
                stored.object_key,
            )
        raise
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
        log_caught_exception(logger, "MinIO download failed for attachment %s", attachment_id)
        raise StorageOperationError("Не удалось прочитать файл из хранилища.") from exc

    return attachment, payload, content_type or attachment.content_type


async def delete_attachment(
    session: AsyncSession,
    attachment_id: int,
    user: CurrentUser,
) -> None:
    if not settings.minio_enabled:
        raise StorageDisabledError("Файловое хранилище не настроено.")

    attachment = await attachments_crud.get_attachment(session, attachment_id)
    if attachment is None:
        raise ResourceNotFoundError("Вложение не найдено.")

    if attachment.entity_type == "recommendation":
        recommendation = await recommendations_crud.get_recommendation(session, attachment.entity_id)
        if recommendation is None:
            raise ResourceNotFoundError("Рекомендация не найдена.")
        await _ensure_user_can_manage_recommendation(session, user, recommendation)
    elif attachment.entity_type == "check":
        await _ensure_user_can_manage_check(session, user, attachment.entity_id)

    storage = require_storage()
    bucket = attachment.bucket
    object_key = attachment.object_key
    await attachments_crud.delete_attachment(session, attachment)
    await session.commit()
    try:
        await storage.delete_object(bucket, object_key)
    except Exception:  # noqa: BLE001
        log_caught_exception(
            logger,
            "MinIO delete after commit failed for attachment %s (%s/%s)",
            attachment_id,
            bucket,
            object_key,
        )


async def delete_attachments_for_entity(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: int,
) -> list[tuple[str, str]]:
    """Delete attachment rows. Returns MinIO (bucket, key) pairs to purge AFTER commit."""
    attachment_rows = await attachments_crud.list_attachments(
        session,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    pending: list[tuple[str, str]] = []
    for attachment in attachment_rows:
        pending.append((attachment.bucket, attachment.object_key))
        await attachments_crud.delete_attachment(session, attachment)
    return pending


async def purge_storage_objects(objects: list[tuple[str, str]]) -> None:
    if not objects:
        return
    storage = get_storage()
    if storage is None:
        return
    for bucket, object_key in objects:
        try:
            await storage.delete_object(bucket, object_key)
        except Exception:  # noqa: BLE001
            log_caught_exception(
                logger,
                "MinIO purge after commit failed for %s/%s",
                bucket,
                object_key,
            )

