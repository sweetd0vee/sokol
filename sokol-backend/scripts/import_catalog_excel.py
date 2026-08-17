#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт справочников из `data/data/catalog.xlsx` в таблицы settings (БД).

Обновляет:
  - auditors
  - departments
  - audit_types
  - check_kinds
  - effectiveness_ratings

После импорта перезагрузите вкладку “Настройки” во UI — данные подтянутся через API.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import sys

from openpyxl import load_workbook
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.db.auditor_names import AUDITOR_CODES, AUDITORS
from app.db.department_names import DEPARTMENTS
from app.models.auditors import Auditor
from app.models.audit_types import AuditType
from app.models.check_kinds import CheckKind
from app.models.departments import Department
from app.models.effectiveness_ratings import EffectivenessRating


@dataclass(frozen=True)
class SheetGuess:
    sheet_name: str
    rows: list[list[object]]
    max_col: int


def _iter_non_empty(values: Iterable[object]) -> list[str]:
    out: list[str] = []
    for v in values:
        if v is None:
            continue
        s = str(v).strip()
        if not s:
            continue
        out.append(s)
    return out


def _read_sheet_rows(ws) -> list[list[object]]:
    rows: list[list[object]] = []
    for row in ws.iter_rows(values_only=True):
        rows.append(list(row))
    return rows


def _guess_sheets(wb) -> dict[str, SheetGuess]:
    guesses: dict[str, SheetGuess] = {}

    auditor_codes_set = set(AUDITOR_CODES.values())
    auditors_found = False
    audit_types_found = False

    one_col_sheets: list[SheetGuess] = []
    two_col_sheets: list[SheetGuess] = []

    for name in wb.sheetnames:
        ws = wb[name]
        max_col = ws.max_column or 0
        rows = _read_sheet_rows(ws)
        if max_col == 1:
            one_col_sheets.append(SheetGuess(sheet_name=name, rows=rows, max_col=max_col))
        elif max_col == 2:
            two_col_sheets.append(SheetGuess(sheet_name=name, rows=rows, max_col=max_col))

    # auditors: 2-col sheet where column 2 contains at least one known auditor code (VDS/GAO/etc.)
    for sh in two_col_sheets:
        values_in_col2: list[str] = []
        for r in sh.rows[1:]:
            if len(r) < 2:
                continue
            if r[1] is None:
                continue
            values_in_col2.append(str(r[1]).strip())
        if any(v in auditor_codes_set for v in values_in_col2):
            guesses["auditors"] = sh
            auditors_found = True
            break

    # audit_types: 2-col sheet where column 1 looks like КП/ВП/ПП (2-letter Cyrillic codes)
    for sh in two_col_sheets:
        if sh.sheet_name == guesses.get("auditors", SheetGuess("", [], 0)).sheet_name:
            continue
        codes: list[str] = []
        for r in sh.rows[1:]:
            if len(r) < 2:
                continue
            if r[0] is None:
                continue
            codes.append(str(r[0]).strip())
        if any(len(c) == 2 for c in codes):
            guesses["audit_types"] = sh
            audit_types_found = True
            break

    # One-col sheets:
    # - departments: big list (~48)
    # - check_kinds: medium (~16)
    # - effectiveness_ratings: small (~6)
    for sh in one_col_sheets:
        data_rows = [r for r in sh.rows[1:] if any(v is not None and str(v).strip() for v in r)]
        count = len(data_rows)
        if count >= 30 and "departments" not in guesses:
            guesses["departments"] = sh
        elif 10 <= count <= 25 and "check_kinds" not in guesses:
            guesses["check_kinds"] = sh
        elif 3 <= count <= 10 and "effectiveness_ratings" not in guesses:
            guesses["effectiveness_ratings"] = sh

    if not auditors_found or not audit_types_found:
        # Не падаем жёстко: просто продолжим проверку по one-col/others.
        pass

    return guesses


async def import_catalog(catalog_path: Path) -> None:
    wb = load_workbook(catalog_path, read_only=True, data_only=True)
    guesses = _guess_sheets(wb)

    required = {"auditors", "departments", "audit_types", "check_kinds", "effectiveness_ratings"}
    missing = required - set(guesses.keys())
    if missing:
        raise RuntimeError(f"Не удалось определить листы справочников для: {sorted(missing)}")

    auditors_rows = guesses["auditors"].rows[1:]  # skip header
    departments_rows = guesses["departments"].rows[1:]
    audit_types_rows = guesses["audit_types"].rows[1:]
    check_kinds_rows = guesses["check_kinds"].rows[1:]
    effectiveness_rows = guesses["effectiveness_ratings"].rows[1:]

    auditors = []
    for r in auditors_rows:
        if len(r) < 2:
            continue
        full_name = str(r[0]).strip() if r[0] is not None else ""
        code = str(r[1]).strip() if r[1] is not None else ""
        if full_name and code:
            auditors.append((full_name, code))

    departments = []
    for r in departments_rows:
        name = str(r[0]).strip() if r and r[0] is not None else ""
        if name:
            departments.append(name)

    audit_types = []
    for r in audit_types_rows:
        if len(r) < 2:
            continue
        code = str(r[0]).strip() if r[0] is not None else ""
        name = str(r[1]).strip() if r[1] is not None else ""
        if code and name:
            audit_types.append((code, name))

    check_kinds = []
    for r in check_kinds_rows:
        label = str(r[0]).strip() if r and r[0] is not None else ""
        if label:
            check_kinds.append(label)

    effectiveness_ratings = []
    for r in effectiveness_rows:
        label = str(r[0]).strip() if r and r[0] is not None else ""
        if label:
            effectiveness_ratings.append(label)

    await init_db()
    async with AsyncSessionLocal() as session:
        # Полный пересоз данных справочников.
        # Справочники используются как текстовые справочные значения (без внешних FK),
        # поэтому перезапись безопасна.
        await session.execute(
            text(
                """
            TRUNCATE TABLE
              effectiveness_ratings,
              check_kinds,
              audit_types,
              departments,
              auditors
            RESTART IDENTITY CASCADE
            """
            ),
        )
        await session.commit()

        session.add_all([Auditor(full_name=n, code=c) for n, c in auditors])
        session.add_all([Department(name=n) for n in departments])
        session.add_all([AuditType(code=c, name=n) for c, n in audit_types])
        session.add_all([CheckKind(label=l) for l in check_kinds])
        session.add_all([EffectivenessRating(label=l) for l in effectiveness_ratings])
        await session.commit()

    print("Catalog import completed.")
    print(f" auditors: {len(auditors)}")
    print(f" departments: {len(departments)}")
    print(f" audit_types: {len(audit_types)}")
    print(f" check_kinds: {len(check_kinds)}")
    print(f" effectiveness_ratings: {len(effectiveness_ratings)}")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    catalog_path = repo_root / "data" / "data" / "catalog.xlsx"
    if not catalog_path.is_file():
        raise FileNotFoundError(f"Не найден файл каталога: {catalog_path}")
    import asyncio

    asyncio.run(import_catalog(catalog_path))


if __name__ == "__main__":
    main()

