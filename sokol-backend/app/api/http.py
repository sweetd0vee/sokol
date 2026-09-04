"""Shared HTTP response helpers."""

from __future__ import annotations

from urllib.parse import quote


def content_disposition_attachment(filename: str) -> str:
    ascii_fallback = "".join(char if ord(char) < 128 else "_" for char in filename)
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"
