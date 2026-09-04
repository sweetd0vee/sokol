"""Shared exceptions for CRUD application services.

Canonical definitions live in ``app.core.exceptions``; this module re-exports them
so existing imports keep working.
"""

from app.core.exceptions import (
    AccessDeniedError,
    AttachmentTooLargeError,
    CrudServiceError,
    EmptyAttachmentPayloadError,
    InvalidAttachmentSlotError,
    InvalidReferenceError,
    ResourceNotFoundError,
    StorageDisabledError,
    StorageOperationError,
    UnsupportedAttachmentContentTypeError,
)

__all__ = [
    "AccessDeniedError",
    "AttachmentTooLargeError",
    "CrudServiceError",
    "EmptyAttachmentPayloadError",
    "InvalidAttachmentSlotError",
    "InvalidReferenceError",
    "ResourceNotFoundError",
    "StorageDisabledError",
    "StorageOperationError",
    "UnsupportedAttachmentContentTypeError",
]
