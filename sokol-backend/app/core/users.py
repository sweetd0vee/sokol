from __future__ import annotations

# Latin lookalikes → Cyrillic so "Админ A.A." matches "Админ А.А."
_LATIN_LOOKALIKES = str.maketrans(
    "ABCEHKMOPTXYabcehkmoptxy",
    "АВСЕНКМОРТХУавсенкмортху",
)


def normalize_login(value: str) -> str:
    translated = value.strip().translate(_LATIN_LOOKALIKES)
    return " ".join(translated.split()).casefold()
