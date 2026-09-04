"""Golden DOCX pipeline: section II, links, ДЗ, parse, control file, layout variants."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.shared import Pt
from openpyxl import load_workbook

from app.services.reports.az_import import parse_recommendations_from_docx
from app.services.reports.control_file.generator import COL_RECOMMENDATION, generate_control_file_template
from app.services.reports.memorandum.docx_generator import generate_memorandum
from app.services.reports.memorandum.parser import parse_az_for_memorandum
from app.services.reports.section_ii.docx_generator import process_document
from app.services.reports.section_ii.docx_parser import parse_observations_from_file_with_runs


def _add_bold_heading(doc: Document, text: str):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    run.bold = True
    run.font.size = Pt(14)
    run.font.name = "Times New Roman"
    return paragraph


def _wrap_in_sdt(paragraph) -> None:
    sdt = OxmlElement("w:sdt")
    content = OxmlElement("w:sdtContent")
    p_el = paragraph._element
    parent = p_el.getparent()
    index = list(parent).index(p_el)
    parent.remove(p_el)
    content.append(p_el)
    sdt.append(content)
    parent.insert(index, sdt)


def _build_canonical_az(path: Path, *, wrap_headings: bool = False, extra_blanks: bool = False) -> None:
    doc = Document()
    title = doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
    check_title = doc.add_paragraph("Комплексный аудит процессов кредитования")
    check_title.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("Содержание")
    doc.add_paragraph("I. Аудиторское мнение")
    doc.add_paragraph("II. Основные результаты")
    doc.add_paragraph("III. Контроль клиентских данных")
    page_break = doc.add_paragraph("")
    page_break.add_run().add_break(WD_BREAK.PAGE)

    heading_i = _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
    doc.add_paragraph("Текст раздела I")
    if extra_blanks:
        doc.add_paragraph("")
        doc.add_paragraph("")
    heading_iii = _add_bold_heading(doc, "III. Контроль клиентских данных")
    doc.add_paragraph("Наблюдение 3.1. Несвоевременное обновление лимитов")
    doc.add_paragraph("Уровень существенности: средний")
    doc.add_paragraph(
        "Объект аудита: Департамент розничных продуктов "
        "Руководитель объекта аудита: Иванов И.И."
    )
    doc.add_paragraph("Аудиторская рекомендация: Внедрить контроль сроков.")
    doc.add_paragraph("Срок – 01.09.2026.")
    if wrap_headings:
        _wrap_in_sdt(heading_i)
        _wrap_in_sdt(heading_iii)
    doc.save(path)


class DocxToolsGoldenTest(unittest.TestCase):
    def test_full_pipeline_on_canonical_az(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_canonical_az(az_path)

            section_path = Path(tmp) / "az_section_ii.docx"
            result_path, observations, error = process_document(str(az_path), str(section_path))
            self.assertIsNone(error, msg=error)
            self.assertEqual(result_path, str(section_path))
            self.assertEqual([obs.number for obs in observations], ["3.1"])

            links_path = Path(tmp) / "az_section_ii_links.docx"
            links_result, linked_obs, links_error = process_document(
                str(az_path),
                str(links_path),
                with_hyperlinks=True,
            )
            self.assertIsNone(links_error, msg=links_error)
            self.assertEqual(links_result, str(links_path))
            self.assertEqual([obs.number for obs in linked_obs], ["3.1"])

            source, parse_error = parse_az_for_memorandum(str(section_path))
            self.assertIsNone(parse_error, msg=parse_error)
            self.assertIsNotNone(source)
            self.assertTrue(source.groups)

            memo_path = Path(tmp) / "az_dz.docx"
            memo_result, memo_error = generate_memorandum(source, str(memo_path))
            self.assertIsNone(memo_error, msg=memo_error)
            self.assertTrue(Path(memo_result).is_file())

            items, rec_error = parse_recommendations_from_docx(str(section_path))
            self.assertIsNone(rec_error, msg=rec_error)
            self.assertGreaterEqual(len(items), 1)
            self.assertIn("контроль сроков", items[0].name.lower())

            control_path = Path(tmp) / "az_control.xlsx"
            control_result, control_error = generate_control_file_template(
                str(section_path),
                str(control_path),
                check_leader="Иванов И.И.",
                check_date="01.09.2026",
            )
            self.assertIsNone(control_error, msg=control_error)
            workbook = load_workbook(control_result)
            self.assertIn(
                "контроль сроков",
                (workbook.active.cell(row=2, column=COL_RECOMMENDATION).value or "").lower(),
            )

    def test_parses_content_control_wrapped_headings_and_blank_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az_sdt.docx"
            _build_canonical_az(az_path, wrap_headings=True, extra_blanks=True)
            observations = parse_observations_from_file_with_runs(str(az_path))
            self.assertEqual([obs.number for obs in observations], ["3.1"])
            self.assertEqual(observations[0].chapter, "3")

            section_path = Path(tmp) / "az_section_ii.docx"
            _result, generated, error = process_document(str(az_path), str(section_path))
            self.assertIsNone(error, msg=error)
            self.assertEqual([obs.number for obs in generated], ["3.1"])

            items, rec_error = parse_recommendations_from_docx(str(az_path))
            self.assertIsNone(rec_error, msg=rec_error)
            self.assertGreaterEqual(len(items), 1)


if __name__ == "__main__":
    unittest.main()
