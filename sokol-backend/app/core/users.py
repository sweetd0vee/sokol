from __future__ import annotations


def normalize_login(value: str) -> str:
    # Latin lookalikes → Cyrillic so "Админ A.A." matches "Админ А.А."
    translated = value.strip().translate(
        str.maketrans("ABCEHKMOPTXYabcehkmoptxy", "АВСЕНКМОРТХУавсенкмортху")
    )
    return " ".join(translated.split()).casefold()
