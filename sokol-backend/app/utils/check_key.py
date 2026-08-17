# -*- coding: utf-8 -*-
"""Генерация серверного ключа проверки по году, аудитору, кварталу и типу."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Literal

CheckType = Literal["planned", "unscheduled", "thematic"]

CHECK_TYPE_KEY_CODES: dict[str, str] = {
    "planned": "P",
    "unscheduled": "V",
    "thematic": "K",
}

TRANSLIT_MAP: dict[str, str] = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "i",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ы": "y",
    "э": "e",
    "ю": "yu",
    "я": "ya",
    "ъ": "",
    "ь": "",
}


@dataclass(frozen=True)
class CheckKeySeed:
    leader: str
    start_date: date
    check_type: str


def _transliterate_char(char: str) -> str:
    mapped = TRANSLIT_MAP.get(char.lower(), char)
    return mapped[:1].upper() if mapped else ""


def get_leader_initials_code(full_name: str) -> str:
    parts = full_name.replace(".", " ").split()
    return "".join(_transliterate_char(part[0]) for part in parts if part)


def _same_year(first: date, second: date) -> bool:
    return first.year == second.year


def count_matching_check_keys(
    leader: str,
    start_date: date,
    check_type: str,
    existing: Iterable[CheckKeySeed],
) -> int:
    return sum(
        1
        for item in existing
        if item.leader == leader
        and item.check_type == check_type
        and _same_year(item.start_date, start_date)
    )


def generate_check_serial_number(
    start_date: date,
    check_quarter: int,
    check_leader: str,
    check_type: str,
    existing: Iterable[CheckKeySeed],
    *,
    leader_code: str | None = None,
) -> str:
    year_code = str(start_date.year)[-2:]
    resolved_leader_code = (
        leader_code.strip().upper()
        if leader_code is not None
        else get_leader_initials_code(check_leader)
    )
    if (
        len(resolved_leader_code) != 3
        or not resolved_leader_code.isascii()
        or not resolved_leader_code.isalpha()
    ):
        raise ValueError("Auditor code must contain exactly 3 Latin letters.")
    if check_quarter not in {1, 2, 3, 4}:
        raise ValueError("Check quarter must be between 1 and 4.")
    type_code = CHECK_TYPE_KEY_CODES.get(check_type, "")
    next_number = count_matching_check_keys(check_leader, start_date, check_type, existing) + 1
    return f"{year_code}{resolved_leader_code}{check_quarter}{type_code}{next_number}"


def assign_serial_numbers(
    checks: list[dict],
) -> list[dict]:
    assigned: list[CheckKeySeed] = []
    result: list[dict] = []
    for check in checks:
        start = check["start_date"]
        if isinstance(start, str):
            start = date.fromisoformat(start)
        serial = generate_check_serial_number(
            start,
            int(check["check_quarter"]),
            check["check_leader"],
            check["check_type"],
            assigned,
            leader_code=check.get("check_leader_code"),
        )
        assigned.append(CheckKeySeed(check["check_leader"], start, check["check_type"]))
        result.append({**check, "serial_number": serial})
    return result
