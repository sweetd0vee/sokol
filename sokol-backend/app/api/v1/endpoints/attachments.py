from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.api.http import content_disposition_attachment
from app.db.session import get_db_session
from app.schemas.attachments import (
    AttachmentListResponse,
    AttachmentUploadResponse,
    StorageStatusResponse,
)
from app.services import attachments_service

router = APIRouter(prefix="/attachments", tags=["attachments"])


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
    return await attachments_service.list_attachments(
        session,
        entity_type=entity_type,
        entity_id=entity_id,
        slot=slot,
    )


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


@router.get("/{attachment_id}/download")
async def download_attachment_endpoint(
    attachment_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    attachment, payload, media_type = await attachments_service.download_attachment(
        session,
        attachment_id,
    )
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition_attachment(attachment.original_name)},
    )


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment_endpoint(
    attachment_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    await attachments_service.delete_attachment(session, attachment_id, user)
