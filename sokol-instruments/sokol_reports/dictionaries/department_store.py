"""Локальное хранение справочника департаментов (JSON, без БД)."""

from __future__ import annotations

import json
from pathlib import Path

from sokol_reports.dictionaries.department_names import DEPARTMENTS

_STORE_DIR = Path(__file__).resolve().parents[2] / "data"
_STORE_PATH = _STORE_DIR / "departments.json"


def default_departments() -> list[str]:
    return list(DEPARTMENTS)


def load_departments() -> list[str]:
    if not _STORE_PATH.is_file():
        return default_departments()
    try:
        data = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default_departments()
    if not isinstance(data, list):
        return default_departments()
    names = [item.strip() for item in data if isinstance(item, str) and item.strip()]
    return names or default_departments()


def save_departments(names: list[str]) -> None:
    cleaned = normalize_departments(names)
    _STORE_DIR.mkdir(parents=True, exist_ok=True)
    _STORE_PATH.write_text(
        json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def reset_departments() -> list[str]:
    if _STORE_PATH.is_file():
        _STORE_PATH.unlink(missing_ok=True)
    return default_departments()


def normalize_departments(names: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for name in names:
        stripped = str(name).strip()
        if not stripped:
            continue
        key = stripped.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(stripped)
    return result


def validate_departments(names: list[str]) -> str | None:
    cleaned = [str(name).strip() for name in names if str(name).strip()]
    if not cleaned:
        return "Добавьте хотя бы один департамент."

    seen: set[str] = set()
    for name in cleaned:
        key = name.casefold()
        if key in seen:
            return f"Дублируется департамент: «{name}»."
        seen.add(key)
    return None
