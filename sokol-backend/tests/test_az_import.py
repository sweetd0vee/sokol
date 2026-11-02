# -*- coding: utf-8 -*-
import tempfile
import unittest
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK

from app.services.reports.az_import import is_completed_during_audit, parse_recommendations_from_docx
from app.services.reports.memorandum.section_ii_table_parser import split_body_into_recommendations
from app.services.reports.section_ii.field_parser import extract_deadline_from_text


def _build_az(path: Path, *, deadline_line: str, auditor_line: str | None = None) -> None:
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
    if auditor_line:
        doc.add_paragraph(auditor_line)
    doc.add_paragraph("Объект аудита: Департамент ИТ Руководитель объекта аудита: Важник Д.С.")
    doc.add_paragraph("Аудиторская рекомендация: Сверить остатки.")
    doc.add_paragraph(deadline_line)
    doc.save(path)


class SectionIiTableDeadlineTests(unittest.TestCase):
    def test_section_ii_table_puts_srok_ispolneniya_into_the_deadline_column(self) -> None:
        doc = Document()
        doc.add_paragraph("II. Основные результаты аудита и аудиторские рекомендации")
        table = doc.add_table(rows=7, cols=3)
        table.cell(0, 0).text = "Основные нарушения и недостатки"
        rows = [
            (
                "Наблюдение 3.1.",
                "Несвоевременное обновление лимитов кредитования",
                "Внедрить ежемесячный контроль актуальности лимитов.",
                "Срок исполнения — исполнено в ходе аудита",
                "Ковалев С.С.",
            ),
            (
                "Наблюдение 3.2.",
                "Неполный регламент обработки инцидентов",
                "Дополнить регламент обработки инцидентов контрольной процедурой.",
                "Срок исполнения — 28.09.2026",
                "Важник Д.С.",
            ),
            (
                "Наблюдение 3.3.",
                "Отсутствие сверки клиентских данных",
                "Настроить ежедневную сверку клиентских данных между АБС и CRM.",
                "Срок исполнения — 29.10.2026",
                "Харитонов А.И.",
            ),
        ]
        for index, (number, observation, recommendation, deadline, manager) in enumerate(rows):
            base = 1 + index * 2
            table.cell(base, 0).text = number
            table.cell(base, 1).text = observation
            table.cell(base + 1, 0).text = "Рекомендация"
            table.cell(base + 1, 1).text = (
                "Объект аудита: Группа защиты персональных данных\n"
                f"Руководитель объекта аудита: {manager}\n"
                f"{recommendation}\n"
                f"{deadline}"
            )

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "section_ii.docx"
            doc.save(path)
            items, error = parse_recommendations_from_docx(str(path))

        self.assertIsNone(error, msg=error)
        self.assertEqual(
            [(item.name, item.deadline, item.completed_during_audit) for item in items],
            [
                ("Внедрить ежемесячный контроль актуальности лимитов.", "", True),
                (
                    "Дополнить регламент обработки инцидентов контрольной процедурой.",
                    "2026-09-28",
                    False,
                ),
                (
                    "Настроить ежедневную сверку клиентских данных между АБС и CRM.",
                    "2026-10-29",
                    False,
                ),
            ],
        )
        self.assertNotIn("Срок исполнения", " ".join(item.name for item in items))


class SectionIiDeadlineSplitTests(unittest.TestCase):
    def test_srok_ispolneniya_is_not_left_inside_the_recommendation(self) -> None:
        completed = split_body_into_recommendations(
            "Внедрить ежемесячный контроль актуальности лимитов."
            "Срок исполнения — исполнено в ходе аудита"
        )
        self.assertEqual(len(completed), 1)
        self.assertEqual(
            completed[0].paragraphs,
            ["Внедрить ежемесячный контроль актуальности лимитов."],
        )
        self.assertEqual(completed[0].deadline, "исполнено в ходе аудита")

        dated = split_body_into_recommendations(
            "Дополнить регламент обработки инцидентов.Срок исполнения — 28.09.2026"
        )
        self.assertEqual(
            dated[0].paragraphs,
            ["Дополнить регламент обработки инцидентов."],
        )
        self.assertEqual(dated[0].deadline, "28.09.2026")

        short = split_body_into_recommendations("Сверить остатки. Срок – 15.10.2026")
        self.assertEqual(short[0].paragraphs, ["Сверить остатки."])
        self.assertEqual(short[0].deadline, "15.10.2026")

        until = split_body_into_recommendations("Обновить регламент. Срок исполнения: до 01.04.2026")
        self.assertEqual(until[0].paragraphs, ["Обновить регламент."])
        self.assertEqual(until[0].deadline, "01.04.2026")


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
        self.assertEqual(
            extract_deadline_from_text("Срок исполнения — исправлено в ходе аудита"),
            "исполнено в ходе аудита",
        )
        self.assertTrue(is_completed_during_audit("исполнено в ходе аудита"))
        self.assertTrue(is_completed_during_audit("Исправлено в ходе аудита"))
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

    def test_parse_marks_corrected_during_audit_as_blue_star(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az(az_path, deadline_line="Срок исполнения — исправлено в ходе аудита")
            items, error = parse_recommendations_from_docx(str(az_path))
            self.assertIsNone(error, msg=error)
            self.assertEqual(len(items), 1)
            self.assertTrue(items[0].completed_during_audit)
            self.assertEqual(items[0].deadline, "")

    def test_parse_keeps_auditor_from_service_line(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az(
                az_path,
                deadline_line="Срок – 15.10.2026",
                auditor_line="Аудитор: Каминская В.В.",
            )
            items, error = parse_recommendations_from_docx(str(az_path))
            self.assertIsNone(error, msg=error)
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0].auditor, "Каминская В.В.")
            self.assertNotIn("Аудитор:", items[0].name)


if __name__ == "__main__":
    unittest.main()
