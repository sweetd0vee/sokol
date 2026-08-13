"""Normalization helpers for settings dictionary labels."""

from __future__ import annotations

import re

# Latin letters that look like Cyrillic (and lowercase variants).
_LATIN_TO_CYRILLIC = str.maketrans(
    {
        "A": "А",
        "a": "а",
        "B": "В",
        "b": "в",
        "C": "С",
        "c": "с",
        "E": "Е",
        "e": "е",
        "H": "Н",
        "h": "н",
        "K": "К",
        "k": "к",
        "M": "М",
        "m": "м",
        "O": "О",
        "o": "о",
        "P": "Р",
        "p": "р",
        "T": "Т",
        "t": "т",
        "X": "Х",
        "x": "х",
        "Y": "У",
        "y": "у",
    }
)


def normalize_dictionary_label(value: str) -> str:
    """Trim, collapse spaces, normalize hyphens, and map Latin homoglyphs to Cyrillic."""
    collapsed = " ".join(value.strip().split())
    cyrillic = collapsed.translate(_LATIN_TO_CYRILLIC)
    normalized_hyphens = re.sub(r"\s*[-‐‑‒–—]\s*", "-", cyrillic)
    return normalized_hyphens.rstrip(".")


def dictionary_match_key(value: str) -> str:
    """Stable comparison key for dictionary labels."""
    return normalize_dictionary_label(value).casefold()
