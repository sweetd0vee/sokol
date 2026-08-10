from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AttachmentEntityTypeLiteral = Literal["check", "recommendation"]

CHECK_ATTACHMENT_SLOTS = frozenset({"order", "program", "az", "dz", "dz_appendix"})
RECOMMENDATION_ATTACHMENT_SLOTS = frozenset({"recommendation_files", "control_removal_files"})


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: AttachmentEntityTypeLiteral
    entity_id: int
    slot: str
    check_serial_number: str
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime


class AttachmentListResponse(BaseModel):
    items: list[AttachmentRead]
    total: int


class AttachmentUploadResponse(BaseModel):
    attachment: AttachmentRead


class StorageStatusResponse(BaseModel):
    enabled: bool
    reachable: bool = False
    bucket_layout: str = Field(
        default="check-{serial_number}/{slot}/{uuid}_{filename}",
        description="Шаблон путей в MinIO",
    )
