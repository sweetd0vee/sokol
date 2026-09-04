"""Errors raised by settings dictionary CRUD.

Canonical definitions live in ``app.core.exceptions``; this module re-exports them
so existing imports keep working.
"""

from app.core.exceptions import (
    DictionaryInUseError,
    DictionaryProtectedError,
    DuplicateDictionaryError,
)

__all__ = [
    "DictionaryInUseError",
    "DictionaryProtectedError",
    "DuplicateDictionaryError",
]
