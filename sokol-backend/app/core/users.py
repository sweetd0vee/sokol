from __future__ import annotations

from app.utils.lookalikes import LATIN_TO_CYRILLIC


def normalize_login(value: str) -> str:
    translated = value.strip().translate(LATIN_TO_CYRILLIC)
    return " ".join(translated.split()).casefold()
