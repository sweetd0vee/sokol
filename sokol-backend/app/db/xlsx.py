"""Excel parsing helpers for seed import."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook


def parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def optional_str(value) -> str | None:
    if value is None or value == "":
        return None
    return str(value).strip()


def optional_date_str(value) -> str | None:
    parsed = parse_date(value) if value not in (None, "") else None
    if parsed:
        return parsed.isoformat()
    return optional_str(value)


def closure_lists_from_legacy(fields: dict) -> tuple[list[dict], list[dict]]:
    extensions: list[dict] = []
    if fields.get("extension_1_date") or fields.get("extension_1_comment"):
        extensions.append(
            {
                "date": fields["extension_1_date"].isoformat() if fields.get("extension_1_date") else None,
                "comment": fields.get("extension_1_comment"),
            }
        )
    second_date = parse_date(fields.get("extension_2_reason"))
    if second_date or fields.get("extension_2_comment"):
        extensions.append(
            {
                "date": second_date.isoformat() if second_date else None,
                "comment": fields.get("extension_2_comment"),
            }
        )
    removals: list[dict] = []
    if fields.get("remove_from_control_date") or fields.get("remove_from_control_comment"):
        removals.append(
            {
                "date": fields["remove_from_control_date"].isoformat() if fields.get("remove_from_control_date") else None,
                "comment": fields.get("remove_from_control_comment"),
            }
        )
    return extensions, removals


def read_sheet_rows(path: Path, sheet_name: str) -> list[dict]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook[sheet_name]
    rows = list(sheet.iter_rows(values_only=True))
    workbook.close()
    if not rows:
        return []
    headers = [str(item).strip() for item in rows[0]]
    result: list[dict] = []
    for row in rows[1:]:
        if not any(row):
            continue
        result.append({headers[index]: row[index] for index in range(len(headers))})
    return result
