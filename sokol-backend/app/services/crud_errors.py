"""Shared exceptions for CRUD application services."""


class CrudServiceError(Exception):
    """Base class for service-layer CRUD errors."""


class ResourceNotFoundError(CrudServiceError):
    """Raised when a requested domain object does not exist."""


class InvalidReferenceError(CrudServiceError):
    """Raised when a payload points to a missing related object."""


class StorageDisabledError(CrudServiceError):
    """Raised when a file operation requires disabled storage."""


class InvalidAttachmentSlotError(CrudServiceError):
    """Raised when an attachment slot is not valid for the target entity."""


class UnsupportedAttachmentContentTypeError(CrudServiceError):
    """Raised when uploaded file content type is not allowed."""


class EmptyAttachmentPayloadError(CrudServiceError):
    """Raised when an uploaded file has no bytes."""


class AttachmentTooLargeError(CrudServiceError):
    """Raised when an uploaded file exceeds the configured limit."""


class StorageOperationError(CrudServiceError):
    """Raised when MinIO cannot complete a requested storage operation."""


class AccessDeniedError(CrudServiceError):
    """Raised when the current user lacks permission for the requested operation."""

