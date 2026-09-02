# -*- coding: utf-8 -*-
import tempfile
import unittest
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from openpyxl import load_workbook

from app.services.reports.control_file.generator import (
    COL_CHECK_NAME,
    COL_DEADLINE,
    COL_RECOMMENDATION,
    COL_RESPONSIBLE,
    TEMPLATE_PATH,
    format_responsible_from_pairs,
    generate_control_file_template,
)
from app.services.reports.control_file.title_parser import parse_az_title_from_docx
from app.services.reports.section_ii.docx_generator import process_document
from app.utils.paths import CONTROL_FILE_TEMPLATE_NAME, get_control_file_template_path


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
    def test_header_template_file_exists(self):
        self.assertEqual(TEMPLATE_PATH.name, CONTROL_FILE_TEMPLATE_NAME)
        self.assertTrue(
            TEMPLATE_PATH.is_file(),
            msg=f"Шаблон файла контроля не найден: {TEMPLATE_PATH}",
        )
        self.assertTrue(get_control_file_template_path().is_file())

    def test_parse_title_removes_duplicated_glued_title_and_footer(self):
        check_title = (
            "Тематическая проверка Аудит процессов У.3.36 «Управление объектами недвижимости "
            "(покупка, расходная аренда)», О.2.9 «Девелопмент, строительство, реконструкция и "
            "капитальный ремонт объектов недвижимости»"
        )
        glued = check_title + check_title + "Минск 2026Минск"
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            doc = Document()
            doc.add_paragraph("Аудиторское заключение")
            doc.add_paragraph(glued)
            doc.add_paragraph("Минск 2026").add_run().add_break(WD_BREAK.PAGE)
            doc.save(az_path)

            title, error = parse_az_title_from_docx(str(az_path))
            self.assertIsNone(error)
            self.assertEqual(title, check_title)

    def test_parse_title_skips_header_and_footer_lines(self):
        check_title = (
            "Тематическая проверка Аудит процессов У.3.36 «Управление объектами недвижимости "
            "(покупка, расходная аренда)», О.2.9 «Девелопмент, строительство, реконструкция и "
            "капитальный ремонт объектов недвижимости»"
        )
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            doc = Document()
            doc.add_paragraph("Аудиторское")
            doc.add_paragraph("заключение")
            doc.add_paragraph("Тематическая проверка")
            doc.add_paragraph(
                "Аудит процессов У.3.36 «Управление объектами недвижимости (покупка, расходная аренда)», "
                "О.2.9 «Девелопмент, строительство, реконструкция и капитальный ремонт объектов недвижимости»"
            )
            doc.add_paragraph("Департамент внутреннего")
            footer = doc.add_paragraph("аудита")
            footer.add_run().add_break(WD_BREAK.PAGE)
            doc.save(az_path)

            title, error = parse_az_title_from_docx(str(az_path))
            self.assertIsNone(error)
            self.assertEqual(title, check_title)

    def test_parse_title_strips_word_style_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            doc = Document()
            doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
            title_paragraph = doc.add_paragraph(
                "Комплексный аудит административно-хозяйственных процессовcenter3594735"
            )
            title_paragraph.add_run().add_break(WD_BREAK.PAGE)
            doc.save(az_path)

            title, error = parse_az_title_from_docx(str(az_path))
            self.assertIsNone(error)
            self.assertEqual(title, "Комплексный аудит административно-хозяйственных процессов")

    def test_parse_title_skips_boilerplate_cover_page(self):
        check_title = "Комплексный аудит административно-хозяйственных процессов"
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            doc = Document()
            doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
            cover = doc.add_paragraph("Департамент внутреннего аудита")
            cover.add_run().add_break(WD_BREAK.PAGE)
            title_paragraph = doc.add_paragraph(check_title)
            title_paragraph.add_run().add_break(WD_BREAK.PAGE)
            doc.add_paragraph("Содержание")
            doc.add_paragraph("I. Аудиторское мнение")
            doc.save(az_path)

            title, error = parse_az_title_from_docx(str(az_path))
            self.assertIsNone(error)
            self.assertEqual(title, check_title)

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
            generated_path, gen_error = generate_control_file_template(
                result_path,
                str(output_path),
                check_leader="Иванов И.И.",
                check_date="19.08.2026",
            )
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
            self.assertEqual(worksheet.cell(row=first_row, column=2).value, "19.08.2026")
            self.assertEqual(worksheet.cell(row=first_row, column=5).value, "Иванов И.И.")
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

            recommendation_cell = worksheet.cell(row=first_row, column=COL_RECOMMENDATION)
            self.assertTrue(recommendation_cell.alignment.wrap_text)
            self.assertEqual(recommendation_cell.alignment.vertical, "top")
            self.assertGreater(worksheet.column_dimensions["F"].width or 0, 60)
            self.assertGreaterEqual(worksheet.row_dimensions[first_row].height or 0, 31.5)

    def test_rejects_az_without_section_ii(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az_without_section_ii(az_path, title="Проверка без Раздела II")
            output_path = Path(tmp) / "az_control.xlsx"

            generated_path, error = generate_control_file_template(
                str(az_path),
                str(output_path),
                check_leader="Иванов И.И.",
                check_date="19.08.2026",
            )
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
            _, gen_error = generate_control_file_template(
                result_path,
                str(output_path),
                check_leader="Иванов И.И.",
                check_date="19.08.2026",
            )
            self.assertIsNone(gen_error, msg=gen_error)

            workbook = load_workbook(output_path)
            responsible = workbook.active.cell(row=2, column=COL_RESPONSIBLE).value
            self.assertEqual(
                responsible,
                "Департамент A (Иванов И.И.), Департамент B (Петров П.П.)",
            )

    def test_format_responsible_comma_separated_objects_and_managers(self):
        responsible = format_responsible_from_pairs([
            (
                "Административно - хозяйственный департамент, Отдел закупок.",
                "Ярмошевич И.Н., Лавренюк Р. А.",
            )
        ])
        self.assertEqual(
            responsible,
            "Административно - хозяйственный департамент (Ярмошевич И.Н.), "
            "Отдел закупок (Лавренюк Р. А.)",
        )


if __name__ == "__main__":
    unittest.main()
