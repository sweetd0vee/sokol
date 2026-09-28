# -*- coding: utf-8 -*-
import tempfile
import unittest
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK

from app.services.reports.az_import import is_completed_during_audit, parse_recommendations_from_docx
from app.services.reports.section_ii.field_parser import extract_deadline_from_text


def _build_az(path: Path, *, deadline_line: str) -> None:
    doc = Document()
    title = doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
    title.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("I. Аудиторское мнение")
    doc.add_paragraph("II. Основные результаты")
    doc.add_paragraph("III. Детальные результаты")
    title.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("I. Аудиторское мнение по итогам проверки.")
    doc.add_paragraph("III. Детальные результаты аудита")
    doc.add_paragraph("Наблюдение 3.1. Контроль остатков")
    doc.add_paragraph("Уровень существенности: средний")
    doc.add_paragraph("Объект аудита: Департамент ИТ Руководитель объекта аудита: Важник Д.С.")
    doc.add_paragraph("Аудиторская рекомендация: Сверить остатки.")
    doc.add_paragraph(deadline_line)
    doc.save(path)


class AzImportCompletedDuringAuditTests(unittest.TestCase):
    def test_extracts_completed_during_audit_from_deadline_line(self) -> None:
        self.assertEqual(
            extract_deadline_from_text("Срок исполнения — исполнено в ходе аудита"),
            "исполнено в ходе аудита",
        )
        self.assertEqual(
            extract_deadline_from_text("Срок – 15.10.2026"),
            "15.10.2026",
        )
        self.assertTrue(is_completed_during_audit("исполнено в ходе аудита"))
        self.assertFalse(is_completed_during_audit("Срок – 15.10.2026"))

    def test_parse_marks_completed_during_audit_instead_of_date(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az(az_path, deadline_line="Срок исполнения — исполнено в ходе аудита")
            items, error = parse_recommendations_from_docx(str(az_path))
            self.assertIsNone(error, msg=error)
            self.assertEqual(len(items), 1)
            self.assertTrue(items[0].completed_during_audit)
            self.assertEqual(items[0].deadline, "")


if __name__ == "__main__":
    unittest.main()
