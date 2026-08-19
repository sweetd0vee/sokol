"""Normalization helpers for settings dictionary labels."""

from __future__ import annotations

import re
from collections.abc import Sequence

UNSPECIFIED_AUDIT_OBJECT = "Не указан"

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
    return normalized_hyphens


def dictionary_match_key(value: str) -> str:
    """Stable comparison key for dictionary labels."""
    return normalize_dictionary_label(value).casefold()


def dictionary_loose_match_key(value: str) -> str:
    """Comparison key that ignores punctuation, spaces, and other extra symbols."""
    normalized = dictionary_match_key(value).replace("ё", "е")
    return re.sub(r"[^0-9a-zа-я]+", "", normalized)


def _levenshtein_distance(left: str, right: str, max_distance: int) -> int:
    if abs(len(left) - len(right)) > max_distance:
        return max_distance + 1

    previous = list(range(len(right) + 1))
    for index, left_char in enumerate(left, start=1):
        current = [index]
        for right_index, right_char in enumerate(right, start=1):
            substitution_cost = 0 if left_char == right_char else 1
            current.append(
                min(
                    previous[right_index] + 1,
                    current[right_index - 1] + 1,
                    previous[right_index - 1] + substitution_cost,
                )
            )
        if min(current) > max_distance:
            return max_distance + 1
        previous = current
    return previous[-1]


def _max_fuzzy_distance(key: str) -> int:
    if len(key) < 6:
        return 0
    return min(3, max(1, len(key) // 8))


def find_dictionary_label_match(value: str, candidates: Sequence[str]) -> str | None:
    """Return a unique dictionary candidate matching value, allowing small input noise."""
    strict_key = dictionary_match_key(value)
    for candidate in candidates:
        if dictionary_match_key(candidate) == strict_key:
            return candidate

    loose_key = dictionary_loose_match_key(value)
    if not loose_key:
        return None
    for candidate in candidates:
        if dictionary_loose_match_key(candidate) == loose_key:
            return candidate

    max_distance = _max_fuzzy_distance(loose_key)
    if max_distance == 0:
        return None

    best_candidate: str | None = None
    best_distance = max_distance + 1
    ambiguous = False
    for candidate in candidates:
        candidate_key = dictionary_loose_match_key(candidate)
        distance = _levenshtein_distance(loose_key, candidate_key, max_distance)
        if distance > max_distance:
            continue
        if distance < best_distance:
            best_candidate = candidate
            best_distance = distance
            ambiguous = False
        elif distance == best_distance:
            ambiguous = True

    return None if ambiguous else best_candidate
