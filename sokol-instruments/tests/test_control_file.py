# -*- coding: utf-8 -*-
import tempfile
import unittest
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from openpyxl import load_workbook

from sokol_reports.control_file.generator import (
    COL_CHECK_NAME,
    COL_DEADLINE,
    COL_RECOMMENDATION,
    COL_RESPONSIBLE,
    generate_control_file_template,
)
from sokol_reports.control_file.title_parser import parse_az_title_from_docx
from sokol_reports.section_ii.docx_generator import process_document


def _add_bordered_paragraph(doc: Document, text: str) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = 0
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        border = OxmlElement(f"w:{side}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "1")
        border.set(qn("w:color"), "auto")
        p_bdr.append(border)
    p_pr.append(p_bdr)
    paragraph.add_run(text)


def _build_az_without_section_ii(path: Path, *, title: str) -> None:
    doc = Document()
    doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
    title_paragraph = doc.add_paragraph(title)
    title_paragraph.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("I. Аудиторское мнение")
    doc.add_paragraph("II. Основные результаты")
    doc.add_paragraph("III. Детальные результаты")
    title_paragraph.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("I. Аудиторское мнение по итогам проверки.")
    doc.add_paragraph("III. Детальные результаты аудита")
    doc.add_paragraph("Глава 3. Административно-хозяйственные процессы")
    doc.add_paragraph("Наблюдение 3.1. Несвоевременное оформление документов")
    doc.add_paragraph("Уровень существенности: средний")
    _add_bordered_paragraph(
        doc,
        "Объект аудита: Административно - хозяйственный департамент "
        "Руководитель объекта аудита: Ярмошевич И.Н.",
    )
    _add_bordered_paragraph(doc, "Аудиторская рекомендация: Усилить контроль сроков оформления.")
    _add_bordered_paragraph(doc, "Срок – 01.09.2026")
    doc.add_paragraph("Наблюдение 3.2. Неактуальный регламент")
    doc.add_paragraph("Уровень существенности: низкий")
    _add_bordered_paragraph(
        doc,
        "Объект аудита: Департамент розничных продуктов "
        "Руководитель объекта аудита: Ванагель У.П.",
    )
    _add_bordered_paragraph(doc, "Аудиторская рекомендация: Актуализировать регламент.")
    _add_bordered_paragraph(doc, "Срок – 15.10.2026")
    doc.save(path)


class ControlFileGeneratorTest(unittest.TestCase):
    def test_parse_title_from_title_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az_without_section_ii(
                az_path,
                title="Комплексный аудит административно-хозяйственных процессов",
            )

            title, error = parse_az_title_from_docx(str(az_path))
            self.assertIsNone(error)
            self.assertEqual(title, "Комплексный аудит административно-хозяйственных процессов")

    def test_generate_control_file_from_az_with_section_ii(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az_without_section_ii(
                az_path,
                title="Комплексный аудит административно-хозяйственных процессов",
            )
            section_ii_path = Path(tmp) / "az_section_ii.docx"
            result_path, _, error = process_document(str(az_path), str(section_ii_path))
            self.assertIsNone(error, msg=error)

            output_path = Path(tmp) / "az_control.xlsx"
            generated_path, gen_error = generate_control_file_template(result_path, str(output_path))
            self.assertIsNone(gen_error, msg=gen_error)
            self.assertEqual(generated_path, str(output_path))
            self.assertTrue(output_path.is_file())

            workbook = load_workbook(output_path)
            worksheet = workbook.active

            first_row = 2
            self.assertEqual(
                worksheet.cell(row=first_row, column=COL_CHECK_NAME).value,
                "Комплексный аудит административно-хозяйственных процессов",
            )
            self.assertIsNone(worksheet.cell(row=first_row, column=5).value)
            self.assertIn(
                "контроль сроков",
                (worksheet.cell(row=first_row, column=COL_RECOMMENDATION).value or "").lower(),
            )
            self.assertEqual(worksheet.cell(row=first_row, column=COL_DEADLINE).value, "01.09.2026")
            self.assertEqual(
                worksheet.cell(row=first_row, column=COL_RESPONSIBLE).value,
                "Административно - хозяйственный департамент (Ярмошевич И.Н.)",
            )

            second_row = 3
            self.assertEqual(
                worksheet.cell(row=second_row, column=COL_RESPONSIBLE).value,
                "Департамент розничных продуктов (Ванагель У.П.)",
            )
            self.assertEqual(worksheet.cell(row=second_row, column=COL_DEADLINE).value, "15.10.2026")
            self.assertIsNone(worksheet.cell(row=4, column=COL_CHECK_NAME).value)

    def test_rejects_az_without_section_ii(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az_without_section_ii(az_path, title="Проверка без Раздела II")
            output_path = Path(tmp) / "az_control.xlsx"

            generated_path, error = generate_control_file_template(str(az_path), str(output_path))
            self.assertIsNone(generated_path)
            self.assertIn("Раздел II", error or "")


    def test_multiple_audit_objects_in_one_recommendation(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            doc = Document()
            doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
            title_paragraph = doc.add_paragraph("Совместная проверка подразделений")
            title_paragraph.add_run().add_break(WD_BREAK.PAGE)
            doc.add_paragraph("I. Аудиторское мнение")
            doc.add_paragraph("II. Основные результаты")
            doc.add_paragraph("III. Детальные результаты")
            title_paragraph.add_run().add_break(WD_BREAK.PAGE)
            doc.add_paragraph("III. Детальные результаты аудита")
            doc.add_paragraph("Наблюдение 3.1. Совместное нарушение")
            _add_bordered_paragraph(
                doc,
                "Объект аудита: Департамент A "
                "Руководитель объекта аудита: Иванов И.И. "
                "Объект аудита: Департамент B "
                "Руководитель объекта аудита: Петров П.П.",
            )
            _add_bordered_paragraph(doc, "Аудиторская рекомендация: Согласовать единый регламент.")
            _add_bordered_paragraph(doc, "Срок – 01.12.2026")
            doc.save(az_path)

            section_ii_path = Path(tmp) / "az_section_ii.docx"
            result_path, _, error = process_document(str(az_path), str(section_ii_path))
            self.assertIsNone(error, msg=error)

            output_path = Path(tmp) / "az_control.xlsx"
            _, gen_error = generate_control_file_template(result_path, str(output_path))
            self.assertIsNone(gen_error, msg=gen_error)

            workbook = load_workbook(output_path)
            responsible = workbook.active.cell(row=2, column=COL_RESPONSIBLE).value
            self.assertIn("Департамент A (Иванов И.И.)", responsible)
            self.assertIn("Департамент B (Петров П.П.)", responsible)
            self.assertIn(", ", responsible)


if __name__ == "__main__":
    unittest.main()
