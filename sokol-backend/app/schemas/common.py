"""Shared Pydantic helpers used by domain schemas."""

from datetime import date, datetime
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, BeforeValidator

T = TypeVar("T")


class ListResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


def parse_optional_date(value: object) -> date | None:
    """Blank strings become ``None``; malformed values raise ``ValueError`` (HTTP 422)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        try:
            return date.fromisoformat(cleaned[:10])
        except ValueError as exc:
            raise ValueError("Некорректная дата.") from exc
    return value  # type: ignore[return-value]


OptionalDate = Annotated[date | None, BeforeValidator(parse_optional_date)]
