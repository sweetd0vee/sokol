"""Domain exceptions with HTTP status codes for the API exception handler."""

from __future__ import annotations


class DomainError(Exception):
    """Base class for service-layer errors mapped to HTTP responses."""

    http_status: int = 500


CrudServiceError = DomainError


class ResourceNotFoundError(DomainError):
    http_status = 404


class InvalidReferenceError(DomainError):
    http_status = 400


class AccessDeniedError(DomainError):
    http_status = 403


class StorageDisabledError(DomainError):
    http_status = 503


class InvalidAttachmentSlotError(DomainError):
    http_status = 400


class UnsupportedAttachmentContentTypeError(DomainError):
    http_status = 415


class EmptyAttachmentPayloadError(DomainError):
    http_status = 400


class AttachmentTooLargeError(DomainError):
    http_status = 413


class StorageOperationError(DomainError):
    http_status = 502


class DictionaryRefError(DomainError):
    """Raised when a domain field value is missing from a settings dictionary."""

    http_status = 400

    def __init__(self, *, field: str, value: str, dictionary: str) -> None:
        self.field = field
        self.value = value
        self.dictionary = dictionary
        super().__init__(
            f"Значение «{value}» поля «{field}» отсутствует в справочнике «{dictionary}»."
        )


class DuplicateDictionaryError(DomainError):
    """Raised when a dictionary label already exists."""

    http_status = 409

    def __init__(self, *, dictionary: str, label: str) -> None:
        self.dictionary = dictionary
        self.label = label
        super().__init__(
            f"Запись «{label}» уже существует в справочнике «{dictionary}»."
        )


class DictionaryInUseError(DomainError):
    """Raised when a dictionary row is referenced by checks or recommendations."""

    http_status = 409

    def __init__(self, *, dictionary: str, label: str) -> None:
        self.dictionary = dictionary
        self.label = label
        super().__init__(
            f"Нельзя удалить «{label}» из справочника «{dictionary}»: "
            "значение используется в проверках или рекомендациях."
        )


class DictionaryProtectedError(DomainError):
    """Raised when a system dictionary row cannot be renamed or deleted."""

    http_status = 409

    def __init__(self, *, dictionary: str, label: str, action: str = "удалить") -> None:
        self.dictionary = dictionary
        self.label = label
        self.action = action
        super().__init__(
            f"Системное значение «{label}» нельзя {action} в справочнике «{dictionary}»."
        )
