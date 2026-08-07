#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерация Excel-файлов с синтетическими проверками и рекомендациями для загрузки в PostgreSQL."""

from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook

from app.db.demo_data import build_check_rows, build_recommendation_rows

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DEMO_COUNT = 100


def _write_sheet(workbook: Workbook, title: str, headers: list[str], rows: list[dict]) -> None:
    sheet = workbook.create_sheet(title)
    sheet.append(headers)
    for row in rows:
        sheet.append([row.get(header) for header in headers])


def main() -> None:
    checks = build_check_rows(DEMO_COUNT)
    recommendations = build_recommendation_rows(checks, DEMO_COUNT)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    checks_book = Workbook()
    checks_book.remove(checks_book.active)
    check_headers = [
        "serial_number",
        "check_name",
        "check_type",
        "check_view",
        "start_date",
        "end_date",
        "check_leader",
        "status",
        "created_at",
        "description",
        "order_document_number",
        "order_document_date",
        "program_document_number",
        "program_document_date",
        "az_document_number",
        "az_document_date",
        "dz_document_number",
        "dz_document_date",
        "process_effectiveness",
        "svk_effectiveness",
        "sur_effectiveness",
        "svik_effectiveness",
    ]
    _write_sheet(checks_book, "checks", check_headers, checks)
    checks_path = DATA_DIR / "checks.xlsx"
    checks_book.save(checks_path)

    rec_book = Workbook()
    rec_book.remove(rec_book.active)
    rec_headers = [
        "serial_number",
        "sequence_number",
        "name",
        "description",
        "indicator",
        "materiality_level",
        "audit_object",
        "deadline",
        "auditor",
        "manager",
        "status",
        "additional_status",
        "created_at",
        "actual_completion_date",
        "closure_information",
    ]
    _write_sheet(rec_book, "recommendations", rec_headers, recommendations)
    rec_path = DATA_DIR / "recommendations.xlsx"
    rec_book.save(rec_path)

    print(f"Created {checks_path}")
    print(f"Created {rec_path}")
    print(f"Checks: {len(checks)}, recommendations: {len(recommendations)}")


if __name__ == "__main__":
    main()
