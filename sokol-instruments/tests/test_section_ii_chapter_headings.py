# -*- coding: utf-8 -*-
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

from sokol_reports.section_ii.docx_parser import parse_observations_from_file_with_runs
from sokol_reports.section_ii.patterns import W_NS
from sokol_reports.section_ii.table_builder import create_table_xml


def _add_bold_heading(doc: Document, text: str):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    run.bold = True
    run.font.size = Pt(14)
    run.font.name = "Times New Roman"
    return paragraph


def _add_observation(doc: Document, number: str, name: str) -> None:
    doc.add_paragraph(f"Наблюдение {number}. {name}")
    doc.add_paragraph("Аудиторская рекомендация: Исправить.")
    doc.add_paragraph("Срок – 01.05.2026.")


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


def _wrap_in_hyperlink_field(paragraph, anchor: str = "_TocChapter") -> None:
    p_el = paragraph._element

    def _r_fld(fld_type: str):
        run = OxmlElement("w:r")
        fld = OxmlElement("w:fldChar")
        fld.set(qn("w:fldCharType"), fld_type)
        run.append(fld)
        return run

    instr_run = OxmlElement("w:r")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f' HYPERLINK \\l "{anchor}" '
    instr_run.append(instr)

    children = list(p_el)
    first_run_idx = next(i for i, child in enumerate(children) if child.tag.endswith("}r"))
    p_el.insert(first_run_idx, _r_fld("begin"))
    p_el.insert(first_run_idx + 1, instr_run)
    p_el.insert(first_run_idx + 2, _r_fld("separate"))
    p_el.append(_r_fld("end"))


class SectionIIChapterHeadingsTest(unittest.TestCase):
    def test_all_chapter_titles_appear_in_section_ii_table(self):
        """Названия всех глав с наблюдениями должны попасть в таблицу Раздела II."""
        doc = Document()
        title = doc.add_paragraph("АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
        title.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("Содержание")
        doc.add_paragraph("I. Аудиторское мнение")
        doc.add_paragraph("III. Контроль клиентских данных")
        doc.add_paragraph("IV. Анализ организации работы")
        doc.add_paragraph("V. Управление рисками")
        doc.add_paragraph("VI. Контроль отчетности")
        page_break = doc.add_paragraph("")
        page_break.add_run().add_break(WD_BREAK.PAGE)

        _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
        doc.add_paragraph("Текст раздела I")

        _add_bold_heading(doc, "III. Контроль клиентских данных")
        _add_observation(doc, "3.1", "Первый контроль")

        heading_iv = _add_bold_heading(doc, "IV. Анализ организации работы")
        _wrap_in_hyperlink_field(heading_iv, "_TocIV")
        _add_observation(doc, "4.1", "Контроль заявок")

        heading_v = _add_bold_heading(doc, "V. Управление рисками")
        _wrap_in_sdt(heading_v)
        _add_observation(doc, "5.1", "Эскалация инцидентов")

        _add_bold_heading(doc, "Глава 6. Контроль отчетности")
        _add_observation(doc, "6.1", "Расхождения отчётности")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)
            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual([obs.number for obs in observations], ["3.1", "4.1", "5.1", "6.1"])
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[0].chapter_title, "Контроль клиентских данных")
        self.assertEqual(observations[1].chapter, "4")
        self.assertEqual(observations[1].chapter_title, "Анализ организации работы")
        self.assertEqual(observations[2].chapter, "5")
        self.assertEqual(observations[2].chapter_title, "Управление рисками")
        self.assertEqual(observations[3].chapter, "6")
        self.assertEqual(observations[3].chapter_title, "Контроль отчетности")

        table_xml = ET.tostring(create_table_xml(observations), encoding="unicode")
        self.assertIn("III. Контроль клиентских данных", table_xml)
        self.assertIn("IV. Анализ организации работы", table_xml)
        self.assertIn("V. Управление рисками", table_xml)
        self.assertIn("VI. Контроль отчетности", table_xml)
        self.assertNotIn("HYPERLINK", table_xml)

    def test_missed_heading_does_not_keep_next_chapter_under_previous_title(self):
        doc = Document()
        _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
        _add_bold_heading(doc, "III. Контроль клиентских данных")
        _add_observation(doc, "3.1", "Первый контроль")
        doc.add_paragraph("Случайный абзац без римского номера.")
        _add_observation(doc, "4.1", "Наблюдение следующей главы")
        _add_bold_heading(doc, "V. Управление рисками")
        _add_observation(doc, "5.1", "Эскалация")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)
            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual([obs.number for obs in observations], ["3.1", "4.1", "5.1"])
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[1].chapter, "4")
        self.assertNotEqual(observations[1].chapter_title, observations[0].chapter_title)
        self.assertEqual(observations[2].chapter, "5")
        self.assertEqual(observations[2].chapter_title, "Управление рисками")

        table_xml = ET.tostring(create_table_xml(observations), encoding="unicode")
        self.assertIn("III. Контроль клиентских данных", table_xml)
        self.assertIn("Наблюдение 4.1", table_xml)
        self.assertIn("V. Управление рисками", table_xml)
        text_nodes = [node.text or "" for node in ET.fromstring(table_xml).iter(f"{{{W_NS}}}t")]
        self.assertTrue(any("Раздел 4" in text or "IV." in text for text in text_nodes))


if __name__ == "__main__":
    unittest.main()
