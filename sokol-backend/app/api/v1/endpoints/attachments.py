from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.api.deps import CurrentUser, get_current_user
from app.schemas.attachments import (
    AttachmentListResponse,
    AttachmentRead,
    AttachmentUploadResponse,
    StorageStatusResponse,
)
from app.services import attachments_service
from app.services.crud_errors import (
    AccessDeniedError,
    AttachmentTooLargeError,
    EmptyAttachmentPayloadError,
    InvalidAttachmentSlotError,
    ResourceNotFoundError,
    StorageDisabledError,
    StorageOperationError,
    UnsupportedAttachmentContentTypeError,
)

router = APIRouter(prefix="/attachments", tags=["attachments"])


def _raise_http_error(exc: Exception) -> None:
    if isinstance(exc, AccessDeniedError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, ResourceNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, InvalidAttachmentSlotError | EmptyAttachmentPayloadError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if isinstance(exc, UnsupportedAttachmentContentTypeError):
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    if isinstance(exc, AttachmentTooLargeError):
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    if isinstance(exc, StorageDisabledError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, StorageOperationError):
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    raise exc


@router.get("/storage/status", response_model=StorageStatusResponse)
async def storage_status() -> StorageStatusResponse:
    return await attachments_service.get_storage_status()


@router.get("", response_model=AttachmentListResponse)
async def list_attachments_endpoint(
    entity_type: str = Query(..., pattern="^(check|recommendation)$"),
    entity_id: int = Query(..., ge=1),
    slot: Optional[str] = Query(None, min_length=1, max_length=64),
    session: AsyncSession = Depends(get_db_session),
) -> AttachmentListResponse:
    try:
        return await attachments_service.list_attachments(
            session,
            entity_type=entity_type,
            entity_id=entity_id,
            slot=slot,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_http_error(exc)


@router.post("", response_model=AttachmentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment_endpoint(
    entity_type: str = Form(..., pattern="^(check|recommendation)$"),
    entity_id: int = Form(..., ge=1),
    slot: str = Form(..., min_length=1, max_length=64),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    user: CurrentUser = Depends(get_current_user),
) -> AttachmentUploadResponse:
    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    payload = await file.read()
    original_name = file.filename or "file"
    try:
        return await attachments_service.upload_attachment(
            session,
            entity_type=entity_type,
            entity_id=entity_id,
            slot=slot,
            original_name=original_name,
            content_type=content_type,
            payload=payload,
            user=user,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_http_error(exc)


@router.get("/{attachment_id}/download")
async def download_attachment_endpoint(
    attachment_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        attachment, payload, media_type = await attachments_service.download_attachment(
            session,
            attachment_id,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_http_error(exc)

    headers = {
        "Content-Disposition": f'attachment; filename="{attachment.original_name}"',
    }
    return Response(content=payload, media_type=media_type, headers=headers)


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment_endpoint(
    attachment_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    try:
        await attachments_service.delete_attachment(session, attachment_id, user)
    except Exception as exc:  # noqa: BLE001
        _raise_http_error(exc)
    return None
