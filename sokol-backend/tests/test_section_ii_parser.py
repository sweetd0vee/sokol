import tempfile
import struct
import zlib
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

from app.services.reports.section_ii.docx_parser import (
    _extract_rec_entries_from_runs,
    _remove_text_spans_from_runs,
    parse_observations,
    parse_observations_from_file_with_runs,
)
from app.services.reports.section_ii.docx_generator import (
    MATERIALITY_DISPLAY_SIZE_EMU,
    process_document,
)
from app.services.reports.section_ii.models import RunFragment
from app.services.reports.section_ii.patterns import W_NS
from app.services.reports.section_ii.table_builder import create_table_xml


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


def _build_formatted_section_doc():
    doc = Document()
    doc.add_paragraph("Содержание")
    doc.add_paragraph("I. Аудиторское мнение")
    doc.add_paragraph("II. Основные результаты")
    doc.add_paragraph("III. Контроль клиентских данных")
    doc.add_paragraph("IV. Контроль отчетности")
    page_break = doc.add_paragraph("")
    page_break.add_run().add_break(WD_BREAK.PAGE)

    _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
    doc.add_paragraph("Текст раздела I")
    _add_bold_heading(doc, "II. Основные результаты аудита")
    _add_bold_heading(doc, "III. Контроль клиентских данных")
    doc.add_paragraph("Наблюдение 3.1. Первый контроль")
    doc.add_paragraph("Аудиторская рекомендация: Исправить первое.")
    doc.add_paragraph("Срок – 01.05.2026.")
    doc.add_paragraph("Наблюдение 3.2. Второй контроль")
    doc.add_paragraph("Аудиторская рекомендация: Исправить второе.")
    doc.add_paragraph("Срок – 02.05.2026.")
    _add_bold_heading(doc, "IV. Контроль отчетности")
    doc.add_paragraph("Случайный текст между заголовком и наблюдением.")
    doc.add_paragraph("Наблюдение 4.1. Третий контроль")
    doc.add_paragraph("Аудиторская рекомендация: Исправить третье.")
    doc.add_paragraph("Срок – 03.05.2026.")
    return doc


def _add_bordered_paragraph(doc: Document, text: str):
    paragraph = doc.add_paragraph(text)
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        border = OxmlElement(f"w:{side}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), "auto")
        p_bdr.append(border)
    p_pr.append(p_bdr)
    return paragraph


def _raw_run(text: str, bold: bool = False):
    raw = ET.Element(f"{{{W_NS}}}r")
    if bold:
        r_pr = ET.SubElement(raw, f"{{{W_NS}}}rPr")
        ET.SubElement(r_pr, f"{{{W_NS}}}b")
    t = ET.SubElement(raw, f"{{{W_NS}}}t")
    t.text = text
    return raw


def _runs_to_display_text(runs: list[RunFragment]) -> str:
    parts: list[str] = []
    for frag in runs:
        if frag.br_before:
            parts.append("\n")
        parts.append(frag.text or "")
    return "".join(parts)


def _png_center_pixel_rgba(data: bytes) -> tuple[int, int, int, int]:
    width, height = struct.unpack(">II", data[16:24])
    offset = 8
    compressed = bytearray()
    while offset + 8 <= len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        start = offset + 8
        end = start + length
        if kind == b"IDAT":
            compressed.extend(data[start:end])
        offset = end + 4
    raw = zlib.decompress(bytes(compressed))
    stride = 1 + width * 4
    y = height // 2
    x = width // 2
    pixel_start = y * stride + 1 + x * 4
    return tuple(raw[pixel_start:pixel_start + 4])


class SectionIIParserTest(unittest.TestCase):
    def test_parses_three_part_observation_numbers_in_document_order(self):
        text = """
        III. Контроль клиентских данных
        Наблюдение 3.3.1. Уточнение нагрузки
        Аудиторская рекомендация: Исправить первое.
        Срок – 01.05.2026.

        IV. Контроль отчетности
        Наблюдение 4.1.1. Контроль отчетов
        Аудиторская рекомендация: Исправить второе.
        Срок – 02.05.2026.
        """

        observations = parse_observations(text)

        self.assertEqual([obs.number for obs in observations], ["3.3.1", "4.1.1"])
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[1].chapter, "4")

    def test_ignores_inline_observation_cross_reference_for_order(self):
        text = """
        III. Контроль
        Наблюдение 3.1. Первое
        Аудиторская рекомендация: См. также Наблюдение 4.1.1 в следующем разделе.
        Срок – 01.05.2026.

        IV. Отчетность
        Наблюдение 4.1.1. Второе
        Аудиторская рекомендация: Исправить.
        Срок – 02.05.2026.
        """

        observations = parse_observations(text)

        self.assertEqual([obs.number for obs in observations], ["3.1", "4.1.1"])

    def test_observation_name_excludes_body_after_title(self):
        """Заголовок не должен захватывать абзац «Проверкой установлено…»."""
        text = """
        III. Анализ организации работы
        Наблюдение 3.1.1. Необходимость внесения изменений в SIPOC процесса, регламентирующего строительную деятельность
        Проверкой установлено SIPOC процесса О.2.9 требуют актуализации в связи с изменением структуры.
        Кроме того, SIPOC включает выходы, исключённые из Реестра процессов.
        Уровень существенности: низкий
        Аудиторские рекомендации: инициировать актуализацию SIPOC.
        Срок – 01.10.2026.
        """

        observations = parse_observations(text)

        self.assertEqual(len(observations), 1)
        self.assertEqual(
            observations[0].name,
            "Необходимость внесения изменений в SIPOC процесса, регламентирующего строительную деятельность",
        )
        self.assertNotIn("Проверкой установлено", observations[0].name)

    def test_table_quarter_headers_do_not_skip_section_three_observations(self):
        """Ячейки вроде «I Q 2026» не должны сдвигать старт парсинга после раздела 3."""
        doc = Document()
        title = doc.add_paragraph("Титул")
        title.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("Содержание")
        page_break = doc.add_paragraph("")
        page_break.add_run().add_break(WD_BREAK.PAGE)

        _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
        doc.add_paragraph("Текст раздела I")
        _add_bold_heading(doc, "III. Анализ организации работы.")
        table3 = doc.add_table(rows=1, cols=2)
        table3.cell(0, 0).text = "Наблюдение 3.1.1."
        table3.cell(0, 1).text = "Наблюдение раздела три"
        _add_bordered_paragraph(doc, "Аудиторская рекомендация: Рек три.")
        _add_bordered_paragraph(doc, "Срок – 01.05.2026.")

        _add_bold_heading(doc, "IV. Анализ аренды.")
        table4a = doc.add_table(rows=1, cols=2)
        table4a.cell(0, 0).text = "Наблюдение 4.1.1."
        table4a.cell(0, 1).text = "Первое наблюдение раздела четыре"
        _add_bordered_paragraph(doc, "Аудиторская рекомендация: Рек 4.1.1.")
        _add_bordered_paragraph(doc, "Срок – 02.05.2026.")

        # Ложный «заголовок I» внутри таблицы с кварталами — как в реальном АЗ.
        quarter = doc.add_table(rows=1, cols=5)
        for idx, label in enumerate(["I Q 2026", "II Q 2025", "III Q 2025", "IV Q 2025", "I Q 2025"]):
            cell = quarter.cell(0, idx)
            cell.text = ""
            run = cell.paragraphs[0].add_run(label)
            run.bold = True
            run.font.size = Pt(14)

        table4b = doc.add_table(rows=1, cols=2)
        table4b.cell(0, 0).text = "Наблюдение 4.1.2."
        table4b.cell(0, 1).text = "Второе наблюдение раздела четыре"
        _add_bordered_paragraph(doc, "Аудиторская рекомендация: Рек 4.1.2.")
        _add_bordered_paragraph(doc, "Срок – 03.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)
            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual([obs.number for obs in observations], ["3.1.1", "4.1.1", "4.1.2"])
        self.assertIn("Рек три", observations[0].rec_entries[0].text)
        self.assertIn("Рек 4.1.1", observations[1].rec_entries[0].text)

    def test_section_three_before_four_keeps_recommendations_with_three_part_numbers(self):
        """Раздел 3 не должен уезжать в конец таблицы после раздела 4."""
        doc = Document()
        title = doc.add_paragraph("Титул")
        title.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("Содержание")
        toc = doc.add_paragraph()
        toc.add_run("IV.\tАнализ организации")
        page_break = doc.add_paragraph("")
        page_break.add_run().add_break(WD_BREAK.PAGE)

        _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
        doc.add_paragraph("Текст раздела I")
        # III без bold — типичный кейс, из‑за которого раньше старт съезжал на IV.
        doc.add_paragraph("III. Соблюдение стратегических целей.")
        table3 = doc.add_table(rows=1, cols=2)
        table3.cell(0, 0).text = "Наблюдение 3.3.1."
        table3.cell(0, 1).text = "Наблюдение раздела три"
        _add_bordered_paragraph(doc, "Уровень существенности: средний")
        _add_bordered_paragraph(doc, "Объект аудита: ДРТБ")
        _add_bordered_paragraph(doc, "Аудиторская рекомендация:")
        _add_bordered_paragraph(doc, "Рекомендация именно из раздела три.")
        _add_bordered_paragraph(doc, "Срок – 01.05.2026.")

        _add_bold_heading(doc, "IV. Анализ организации работы.")
        table4 = doc.add_table(rows=1, cols=2)
        table4.cell(0, 0).text = "Наблюдение 4.1.1."
        table4.cell(0, 1).text = "Наблюдение раздела четыре"
        _add_bordered_paragraph(doc, "Уровень существенности: высокий")
        _add_bordered_paragraph(doc, "Объект аудита: ДСККБ")
        _add_bordered_paragraph(doc, "Аудиторская рекомендация:")
        _add_bordered_paragraph(doc, "Рекомендация из раздела четыре.")
        _add_bordered_paragraph(doc, "Срок – 02.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            output_path = Path(tmp_dir) / "output.docx"
            doc.save(docx_path)
            observations = parse_observations_from_file_with_runs(str(docx_path))
            result_path, generated, error = process_document(str(docx_path), str(output_path))

        self.assertEqual([obs.number for obs in observations], ["3.3.1", "4.1.1"])
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[1].chapter, "4")
        self.assertIsNotNone(observations[0].rec_entries)
        self.assertIn("именно из раздела три", observations[0].rec_entries[0].text)
        self.assertIn("из раздела четыре", observations[1].rec_entries[0].text)

        table_xml = ET.tostring(create_table_xml(observations), encoding="unicode")
        self.assertLess(table_xml.index("3.3.1"), table_xml.index("4.1.1"))
        self.assertLess(table_xml.index("III."), table_xml.index("IV."))
        self.assertIn("именно из раздела три", table_xml)

        self.assertIsNone(error, msg=error)
        self.assertEqual([obs.number for obs in generated], ["3.3.1", "4.1.1"])
        self.assertEqual(result_path, str(output_path))

    def test_document_order_ignores_toc_section_four_before_body_section_three(self):
        doc = Document()
        doc.add_paragraph("Содержание")
        toc_iv = doc.add_paragraph()
        toc_iv.add_run("IV.\tАнализ организации работы")
        toc_v = doc.add_paragraph()
        toc_v.add_run("V.\tАнализ доходности")
        page_break = doc.add_paragraph("")
        page_break.add_run().add_break(WD_BREAK.PAGE)

        _add_bold_heading(doc, "I. Аудиторское мнение по итогам проверки.")
        doc.add_paragraph("Текст раздела I")
        _add_bold_heading(
            doc,
            "III. Соблюдение стратегических целей и установленных Банком показателей.",
        )
        doc.add_paragraph("Наблюдение 3.3.1. Наблюдение раздела три")
        doc.add_paragraph("Аудиторская рекомендация: Исправить раздел три.")
        doc.add_paragraph("Срок – 01.05.2026.")
        _add_bold_heading(doc, "IV. Анализ организации работы по привлечению клиентов.")
        doc.add_paragraph("Наблюдение 4.1.1. Наблюдение раздела четыре")
        doc.add_paragraph("Аудиторская рекомендация: Исправить раздел четыре.")
        doc.add_paragraph("Срок – 02.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)
            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual([obs.number for obs in observations], ["3.3.1", "4.1.1"])
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[1].chapter, "4")
        table_xml = ET.tostring(create_table_xml(observations), encoding="unicode")
        pos_iii = table_xml.index("III.")
        pos_iv = table_xml.index("IV.")
        self.assertLess(pos_iii, pos_iv)

    def test_parses_observation_number_with_symbol_and_does_not_cut_plain_srok_word(self):
        text = """
        III. Детальные результаты аудита
        Наблюдение № 3.1: Контроль сроков исполнения заявок
        Уровень существенности — Средний
        Аудиторская рекомендация: Настроить контроль сроков исполнения заявок.
        Срок исполнения: до 01.04.2026.
        """

        observations = parse_observations(text)

        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].number, "3.1")
        self.assertEqual(observations[0].materiality_level, "средний")
        self.assertEqual(observations[0].deadline, "01.04.2026")
        self.assertIn("контроль сроков исполнения заявок", observations[0].recommendations.lower())

    def test_parses_interval_deadline_and_parenthesized_observation_number(self):
        text = """
        Раздел 3. Результаты аудита
        Наблюдение 3.2) Недостатки мониторинга
        Уровень существенности: высокий
        Рекомендация — внедрить мониторинг статусов.
        Срок: с 01.02.2026 по 01.03.2026.
        """

        observations = parse_observations(text)

        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].number, "3.2")
        self.assertEqual(observations[0].materiality_level, "высокий")
        self.assertEqual(observations[0].deadline, "с 01.02.2026 по 01.03.2026")
        self.assertIn("внедрить мониторинг", observations[0].recommendations.lower())

    def test_parses_multiple_observations_and_missing_materiality(self):
        text = """
        Глава 3. Организация контроля
        Наблюдение No. 3.1 — Первый контроль
        Аудиторская рекомендация: Усилить контроль.
        Срок реализации: до 02.04.2026.

        Наблюдение N 3.2: Второй контроль
        Мероприятия после аудита: Назначить ответственного.
        Срок выполнения: 03.04.26.
        """

        observations = parse_observations(text)

        self.assertEqual([obs.number for obs in observations], ["3.1", "3.2"])
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[0].chapter_title, "Организация контроля")
        self.assertEqual(observations[0].materiality_level, "не указан")
        self.assertEqual(observations[1].rec_label, "Мероприятия после аудита")
        self.assertEqual(observations[1].deadline, "03.04.26")

    def test_parses_roman_heading_as_observation_chapter_title(self):
        text = """
        III. Контроль клиентских данных
        Наблюдение 3.1. Первый контроль
        Аудиторская рекомендация: Исправить.
        Срок – 01.05.2026.

        IV. Контроль отчетности
        Наблюдение 4.1. Второй контроль
        Аудиторская рекомендация: Исправить.
        Срок – 02.05.2026.
        """

        observations = parse_observations(text)

        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[0].chapter_title, "Контроль клиентских данных")
        self.assertEqual(observations[1].chapter, "4")
        self.assertEqual(observations[1].chapter_title, "Контроль отчетности")

    def test_parses_roman_heading_without_dot(self):
        text = """
        IV Контроль отчетности
        Наблюдение 4.1. Второй контроль
        Аудиторская рекомендация: Исправить.
        Срок – 02.05.2026.
        """

        observations = parse_observations(text)

        self.assertEqual(observations[0].chapter, "4")
        self.assertEqual(observations[0].chapter_title, "Контроль отчетности")

    def test_formatted_section_headings_use_auditor_opinion_style(self):
        doc = _build_formatted_section_doc()
        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)
            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 3)
        self.assertEqual(observations[0].chapter, "3")
        self.assertEqual(observations[0].chapter_title, "Контроль клиентских данных")
        self.assertEqual(observations[1].chapter, "3")
        self.assertEqual(observations[2].chapter, "4")
        self.assertEqual(observations[2].chapter_title, "Контроль отчетности")
        self.assertNotIn("Случайный текст", observations[2].chapter_title)

        table_xml = ET.tostring(create_table_xml(observations), encoding="unicode")
        self.assertIn("III. Контроль клиентских данных", table_xml)
        self.assertIn("IV. Контроль отчетности", table_xml)
        self.assertNotIn("Случайный текст", table_xml)

    def test_parses_generated_docx_with_runs(self):
        doc = Document()
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль доступа")
        doc.add_paragraph("Уровень существенности — Средний")
        doc.add_paragraph("Аудиторская рекомендация: Настроить контроль доступа.")
        doc.add_paragraph("Срок исполнения: до 01.04.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertEqual(observation.number, "3.1")
        self.assertEqual(observation.materiality_level, "средний")
        self.assertEqual(observation.deadline, "01.04.2026")
        self.assertIsNotNone(observation.rec_runs)
        self.assertIn("контроль доступа", observation.recommendations.lower())

    def test_parses_table_observation_name_runs(self):
        doc = Document()
        doc.add_paragraph("Раздел 3. Детальные результаты аудита")
        table = doc.add_table(rows=1, cols=2)
        table.cell(0, 0).text = "Наблюдение 3.1"
        table.cell(0, 1).text = "Контроль полномочий"
        doc.add_paragraph("Уровень существенности: высокий")
        doc.add_paragraph("Аудиторская рекомендация: Пересмотреть роли.")
        doc.add_paragraph("Срок исполнения: до 05.04.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertEqual(observation.name, "Контроль полномочий")
        self.assertIsNotNone(observation.name_runs)
        self.assertEqual(observation.materiality_level, "высокий")
        self.assertEqual(observation.deadline, "05.04.2026")

    def test_table_name_runs_do_not_drop_observations_missing_from_name_table(self):
        doc = Document()
        doc.add_paragraph("I. Аудиторское мнение")
        doc.add_paragraph("III. Контроль клиентских данных")
        table = doc.add_table(rows=1, cols=2)
        table.cell(0, 0).text = "Наблюдение 3.1"
        table.cell(0, 1).text = "Контроль полномочий из таблицы"
        doc.add_paragraph("Уровень существенности: высокий")
        doc.add_paragraph("Аудиторская рекомендация: Пересмотреть роли.")
        doc.add_paragraph("Срок исполнения: до 05.04.2026.")
        doc.add_paragraph("IV Контроль отчетности")
        doc.add_paragraph("Наблюдение № 4.1: Контроль отчетов без строки в таблице")
        doc.add_paragraph("Уровень существенности: средний")
        doc.add_paragraph("Аудиторская рекомендация: Настроить отчетность.")
        doc.add_paragraph("Срок исполнения: до 06.04.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual([obs.number for obs in observations], ["3.1", "4.1"])
        self.assertEqual(observations[0].name, "Контроль полномочий из таблицы")
        self.assertEqual(observations[1].name, "Контроль отчетов без строки в таблице")
        self.assertEqual(observations[1].chapter_title, "Контроль отчетности")

    def test_textbox_recommendation_keeps_frame_body_and_removes_service_lines(self):
        runs = [
            RunFragment(text="Уровень существенности: средний"),
            RunFragment(text="Аудитор: Каминская В.В.", br_before=True),
            RunFragment(text="Объект аудита: ДРТБ", br_before=True),
            RunFragment(text="Руководитель объекта аудита: Филианова О.В.", br_before=True),
            RunFragment(text="Аудиторская рекомендация:", br_before=True),
            RunFragment(
                text="\tПроработать вопрос по определению подходов для расчета нормативов нагрузки.",
                br_before=True,
            ),
            RunFragment(text="Срок – 01.05.2026", br_before=True),
        ]

        entries = _extract_rec_entries_from_runs(runs)

        self.assertEqual(len(entries), 1)
        text = entries[0].text
        self.assertNotIn("Уровень существенности", text)
        self.assertNotIn("Аудитор: Каминская", text)
        self.assertIn("Объект аудита: ДРТБ", text)
        self.assertIn("Руководитель объекта аудита: Филианова О.В.", text)
        self.assertNotIn("Аудиторская рекомендация:", text)
        self.assertIn("Проработать вопрос", text)
        self.assertIn("Срок – 01.05.2026", text)

    def test_textbox_without_recommendation_label_is_ignored(self):
        runs = [
            RunFragment(text="Пояснение аудитора"),
            RunFragment(text="Этот текст не должен попадать в таблицу рекомендаций.", br_before=True),
            RunFragment(text="Срок – 01.05.2026", br_before=True),
        ]

        entries = _extract_rec_entries_from_runs(runs)

        self.assertEqual(entries, [])

    def test_textbox_recommendation_preserves_spaces_after_service_line_cleanup(self):
        runs = [
            RunFragment(text="Уровень существенности: средний"),
            RunFragment(text="Аудитор: Каминская В.В.", br_before=True),
            RunFragment(text="Аудиторская рекомендация:", br_before=True),
            RunFragment(text="Проработать вопрос", br_before=True),
            RunFragment(text=" по определению подходов"),
            RunFragment(text=" для расчета нормативов"),
            RunFragment(text=" нагрузки менеджеров."),
            RunFragment(text="Срок – 01.05.2026", br_before=True),
        ]

        entries = _extract_rec_entries_from_runs(runs)

        self.assertEqual(len(entries), 1)
        text = entries[0].text
        self.assertIn("Проработать вопрос по определению подходов", text)
        self.assertIn("подходов для расчета нормативов нагрузки", text)
        self.assertNotIn("вопроспо", text)
        self.assertNotIn("подходовдля", text)
        self.assertNotIn("нормативовнагрузки", text)

    def test_extracts_full_bordered_frame_fields_for_observation(self):
        doc = Document()
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль рамок")
        _add_bordered_paragraph(doc, "Уровень существенности: средний")
        _add_bordered_paragraph(doc, "\tАудитор: Каминская В.В.")
        _add_bordered_paragraph(doc, "          Объект аудита: Департамент развития транзакционного бизнеса")
        _add_bordered_paragraph(doc, "Руководитель объекта аудита: Филианова О.В.")
        _add_bordered_paragraph(doc, "          Аудиторская рекомендация: ")
        _add_bordered_paragraph(
            doc,
            "Обеспечить реализацию мероприятия по поиску анкет клиентов в программном комплексе Siebel CRM.",
        )
        _add_bordered_paragraph(doc, "Срок – 01.04.2025")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        observation = observations[0]
        self.assertIsNotNone(observation.rec_entries)
        rec_text = observation.rec_entries[0].text
        self.assertNotIn("Уровень существенности", rec_text)
        self.assertNotIn("Аудитор: Каминская", rec_text)
        self.assertIn("Объект аудита: Департамент развития транзакционного бизнеса", rec_text)
        self.assertIn("Руководитель объекта аудита: Филианова О.В.", rec_text)
        self.assertNotIn("Аудиторская рекомендация:", rec_text)
        self.assertIn("поиску анкет клиентов", rec_text)
        self.assertIn("Срок – 01.04.2025", rec_text)
        self.assertNotIn("Выводы по подразделу", rec_text)

    def test_extracts_bordered_frame_without_recommendation_label_and_multiple_deadlines(self):
        doc = Document()
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль сроков")
        _add_bordered_paragraph(doc, "Уровень существенности: высокий")
        _add_bordered_paragraph(doc, "Аудитор: Иванов И.И.")
        _add_bordered_paragraph(doc, "Объект аудита: ДРТБ")
        _add_bordered_paragraph(doc, "Руководитель объекта аудита: Петров П.П.")
        _add_bordered_paragraph(doc, "Проработать порядок контроля по заявкам.")
        _add_bordered_paragraph(doc, "Срок – 01.05.2026")
        _add_bordered_paragraph(doc, "Срок – 01.06.2026")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        rec_text = observations[0].rec_entries[0].text
        self.assertNotIn("Уровень существенности", rec_text)
        self.assertNotIn("Аудитор: Иванов", rec_text)
        self.assertIn("Объект аудита: ДРТБ", rec_text)
        self.assertIn("Руководитель объекта аудита: Петров П.П.", rec_text)
        self.assertIn("Проработать порядок контроля", rec_text)
        self.assertIn("Срок – 01.05.2026", rec_text)
        self.assertIn("Срок – 01.06.2026", rec_text)

    def test_bordered_frame_does_not_include_following_unframed_text(self):
        doc = Document()
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль границы рамки")
        _add_bordered_paragraph(doc, "Уровень существенности: средний")
        _add_bordered_paragraph(doc, "Аудитор: Каминская В.В.")
        _add_bordered_paragraph(doc, "Объект аудита: ДРТБ")
        _add_bordered_paragraph(doc, "Руководитель объекта аудита: Филианова О.В.")
        _add_bordered_paragraph(doc, "Аудиторская рекомендация:")
        _add_bordered_paragraph(doc, "Обеспечить контроль поиска анкет клиентов.")
        _add_bordered_paragraph(doc, "Срок – 01.04.2025")
        doc.add_paragraph("Выводы по подразделу:")
        doc.add_paragraph(
            "В ходе аудита выявлена необходимость в разработке нормативов нагрузки. "
            "Этот текст идет после рамки и не должен попадать в рекомендацию."
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        self.assertIsNotNone(observations[0].rec_entries)
        rec_text = observations[0].rec_entries[0].text
        self.assertIn("Обеспечить контроль поиска анкет", rec_text)
        self.assertIn("Срок – 01.04.2025", rec_text)
        self.assertNotIn("Выводы по подразделу", rec_text)
        self.assertNotIn("В ходе аудита выявлена", rec_text)
        self.assertNotIn("нормативов нагрузки", rec_text)

    def test_ignores_title_page_tables_before_section_three(self):
        doc = Document()
        title_table = doc.add_table(rows=1, cols=2)
        title_table.cell(0, 0).text = "Наблюдение 3.1"
        title_table.cell(0, 1).text = (
            "Аудит процесса БК.1.2. «Привлечение корпоративных клиентов сегментов "
            "Крупный, Крупнейший и развитие отношений с ними»."
        )
        doc.add_paragraph("I. Аудиторское мнение")
        doc.add_paragraph("III. Детальные результаты аудита")
        real_table = doc.add_table(rows=1, cols=2)
        real_table.cell(0, 0).text = "Наблюдение 3.1"
        real_table.cell(0, 1).text = "Реальное наблюдение"
        doc.add_paragraph("Уровень существенности: средний")
        doc.add_paragraph("Аудиторская рекомендация: Исправить контроль.")
        doc.add_paragraph("Срок исполнения: до 01.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].name, "Реальное наблюдение")
        self.assertNotIn("Аудит процесса", observations[0].name)

    def test_ignores_unrelated_tables_inside_observation(self):
        doc = Document()
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль таблиц")
        unrelated = doc.add_table(rows=1, cols=1)
        unrelated.cell(0, 0).text = "Справочная таблица, не относится к рекомендации."
        recommendation = doc.add_table(rows=3, cols=1)
        recommendation.cell(0, 0).text = "Уровень существенности: средний"
        recommendation.cell(1, 0).text = "Аудиторская рекомендация: Настроить контроль таблиц."
        recommendation.cell(2, 0).text = "Срок – 01.05.2026"

        with tempfile.TemporaryDirectory() as tmp_dir:
            docx_path = Path(tmp_dir) / "input.docx"
            doc.save(docx_path)

            observations = parse_observations_from_file_with_runs(str(docx_path))

        self.assertEqual(len(observations), 1)
        self.assertIsNotNone(observations[0].rec_entries)
        rec_text = observations[0].rec_entries[0].text
        self.assertIn("Настроить контроль таблиц", rec_text)
        self.assertIn("Срок – 01.05.2026", rec_text)
        self.assertNotIn("Справочная таблица", rec_text)

    def test_materiality_requires_explicit_materiality_label(self):
        observations = parse_observations(
            """
            Наблюдение 3.1. Контроль
            Рекомендация: высокий приоритет обработки заявок.
            Срок – 01.05.2026.
            """
        )

        self.assertEqual(observations[0].materiality_level, "не указан")

    def test_table_builder_renders_materiality_as_centered_image(self):
        observations = parse_observations(
            """
            Наблюдение 3.1. Контроль
            Уровень существенности: высокий
            Аудиторская рекомендация: Исправить.
            Срок – 01.05.2026.
            """
        )

        table_xml = create_table_xml(
            observations,
            materiality_image_info={"высокий": {"rel_id": "rId42", "cx": 361905, "cy": 361905}},
        )
        xml_text = ET.tostring(table_xml, encoding="unicode")

        self.assertIn("drawing", xml_text)
        self.assertIn("rId42", xml_text)
        self.assertIn("361905", xml_text)
        self.assertIn('w:val="center"', xml_text)
        self.assertNotIn("●", xml_text)
        self.assertNotIn(">высокий<", xml_text)

    def test_generator_embeds_materiality_image_from_source_pixels(self):
        doc = Document()
        title = doc.add_paragraph("Титульная страница")
        title.add_run().add_break(WD_BREAK.PAGE)
        contents = doc.add_paragraph("Содержание")
        contents.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("I. Аудиторское мнение")
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль картинок")
        doc.add_paragraph("Уровень существенности: высокий")
        doc.add_paragraph("Аудиторская рекомендация: Не менять титул.")
        doc.add_paragraph("Срок – 01.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / "input.docx"
            output_path = Path(tmp_dir) / "output.docx"
            doc.save(input_path)

            result_path, _observations, error = process_document(str(input_path), str(output_path))

            self.assertIsNone(error)
            self.assertEqual(result_path, str(output_path))
            with zipfile.ZipFile(output_path) as zf:
                document_xml = zf.read("word/document.xml").decode("utf-8")
                rels_xml = zf.read("word/_rels/document.xml.rels").decode("utf-8")
                names = zf.namelist()
                high_image = zf.read("word/media/sokol_materiality_high.png")

        self.assertIn("sokol_materiality_high.png", " ".join(names))
        self.assertIn("relationships/image", rels_xml)
        self.assertIn("r:embed", document_xml)
        self.assertIn("wp:inline", document_xml)
        self.assertIn(str(MATERIALITY_DISPLAY_SIZE_EMU), document_xml)
        self.assertNotIn(">высокий<", document_xml)
        self.assertEqual(struct.unpack(">II", high_image[16:24]), (38, 38))
        self.assertEqual(_png_center_pixel_rgba(high_image), (255, 67, 71, 255))

    def test_table_builder_preserves_spaces_between_raw_runs(self):
        first_raw = ET.Element(f"{{{W_NS}}}r")
        first_text = ET.SubElement(first_raw, f"{{{W_NS}}}t")
        first_text.text = "комплексе "
        second_raw = ET.Element(f"{{{W_NS}}}r")
        second_text = ET.SubElement(second_raw, f"{{{W_NS}}}t")
        second_text.text = "Siebel"
        observations = parse_observations(
            """
            Наблюдение 3.1. Контроль
            Уровень существенности: высокий
            Аудиторская рекомендация: Исправить.
            Срок – 01.05.2026.
            """
        )
        observations[0].rec_runs = [
            RunFragment(text="комплексе ", raw_r=first_raw),
            RunFragment(text="Siebel", raw_r=second_raw),
        ]

        table_xml = create_table_xml(observations)
        text_nodes = list(table_xml.iter(f"{{{W_NS}}}t"))
        target = [node for node in text_nodes if node.text == "комплексе "][0]

        self.assertEqual(target.get("{http://www.w3.org/XML/1998/namespace}space"), "preserve")
        self.assertIsNone(target.get(f"{{{W_NS}}}space"))

    def test_recommendation_cell_uses_justified_paragraphs_instead_of_line_breaks(self):
        observations = parse_observations(
            """
            Наблюдение 3.1. Контроль
            Уровень существенности: высокий
            Аудиторская рекомендация: Исправить контроль.
            Срок – 01.05.2026.
            """
        )

        table_xml = create_table_xml(observations)
        xml_text = ET.tostring(table_xml, encoding="unicode")

        self.assertIn('w:val="both"', xml_text)
        self.assertNotIn("<w:br", xml_text)
        self.assertGreaterEqual(xml_text.count("<w:p>"), 2)

    def test_table_builder_inserts_chapter_heading_rows(self):
        observations = parse_observations(
            """
            III. Контроль клиентских данных
            Наблюдение 3.1. Первый контроль
            Аудиторская рекомендация: Исправить.
            Срок – 01.05.2026.

            Наблюдение 3.2. Второй контроль
            Аудиторская рекомендация: Исправить.
            Срок – 02.05.2026.

            IV. Контроль отчетности
            Наблюдение 4.1. Третий контроль
            Аудиторская рекомендация: Исправить.
            Срок – 03.05.2026.
            """
        )

        table_xml = create_table_xml(observations)
        xml_text = ET.tostring(table_xml, encoding="unicode")

        self.assertEqual(xml_text.count("III. Контроль клиентских данных"), 1)
        self.assertEqual(xml_text.count("IV. Контроль отчетности"), 1)
        self.assertIn('w:gridSpan w:val="5"', xml_text)

    def test_recommendation_cleanup_rebuilds_safe_plain_runs_with_label_bold(self):
        runs = [
            RunFragment(text="Уровень существенности: средний", raw_r=_raw_run("Уровень существенности: средний")),
            RunFragment(text="Аудитор: Каминская В.В.", raw_r=_raw_run("Аудитор: Каминская В.В."), br_before=True),
            RunFragment(text="Объект аудита: ", raw_r=_raw_run("Объект аудита: "), br_before=True),
            RunFragment(text="ДРТБ", raw_r=_raw_run("ДРТБ", bold=True)),
            RunFragment(
                text="Аудиторская рекомендация: ",
                raw_r=_raw_run("Аудиторская рекомендация: ", bold=True),
                br_before=True,
            ),
            RunFragment(text="сохранить пробелы ", raw_r=_raw_run("сохранить пробелы ")),
            RunFragment(text="и шрифт", raw_r=_raw_run("и шрифт", bold=True)),
            RunFragment(text="Срок – 01.05.2026", raw_r=_raw_run("Срок – 01.05.2026", bold=True), br_before=True),
        ]

        entries = _extract_rec_entries_from_runs(runs)

        self.assertEqual(len(entries), 1)
        kept_runs = entries[0].runs or []
        kept_text = "".join(frag.text or "" for frag in kept_runs)
        self.assertNotIn("Уровень существенности", kept_text)
        self.assertNotIn("Аудитор: Каминская", kept_text)
        self.assertIn("сохранить пробелы и шрифт", kept_text)
        self.assertTrue(all(frag.raw_r is None for frag in kept_runs))
        self.assertEqual(_runs_to_display_text(kept_runs), (
            "Объект аудита: ДРТБ\n"
            "\n"
            "сохранить пробелы и шрифт\n"
            "Срок – 01.05.2026"
        ))
        deadline_run = [frag for frag in kept_runs if frag.text == "Срок – 01.05.2026"][0]
        self.assertIsNotNone(deadline_run.rPr.find(f".//{{{W_NS}}}b"))
        self.assertFalse(any("Аудиторская рекомендация" in (frag.text or "") for frag in kept_runs))

    def test_recommendation_label_in_middle_of_line_becomes_paragraph_break(self):
        runs = [
            RunFragment(text="Объект аудита: ДРТБ", raw_r=_raw_run("Объект аудита: ДРТБ")),
            RunFragment(
                text=" Руководитель объекта аудита: Иванов И.И. Аудиторская рекомендация: ",
                raw_r=_raw_run(" Руководитель объекта аудита: Иванов И.И. Аудиторская рекомендация: ", bold=True),
            ),
            RunFragment(text="Сделать контроль удобнее.", raw_r=_raw_run("Сделать контроль удобнее.")),
            RunFragment(text="Срок – 01.05.2026", raw_r=_raw_run("Срок – 01.05.2026", bold=True), br_before=True),
        ]

        entries = _extract_rec_entries_from_runs(runs)

        self.assertEqual(len(entries), 1)
        kept_runs = entries[0].runs or []
        self.assertEqual(_runs_to_display_text(kept_runs), (
            "Объект аудита: ДРТБ Руководитель объекта аудита: Иванов И.И.\n"
            "\n"
            "Сделать контроль удобнее.\n"
            "Срок – 01.05.2026"
        ))
        self.assertFalse(any("Аудиторская рекомендация" in (frag.text or "") for frag in kept_runs))

    def test_text_span_removal_preserves_raw_runs_and_spaces_for_remaining_fragments(self):
        runs = [
            RunFragment(text="комплексе ", raw_r=_raw_run("комплексе ")),
            RunFragment(text="лишний ", raw_r=_raw_run("лишний ")),
            RunFragment(text="Siebel", raw_r=_raw_run("Siebel", bold=True)),
        ]
        text = "".join(frag.text for frag in runs)
        start = text.index("лишний ")
        end = start + len("лишний ")

        cleaned = _remove_text_spans_from_runs(runs, [(start, end)])

        self.assertEqual("".join(frag.text for frag in cleaned), "комплексе Siebel")
        self.assertTrue(all(frag.raw_r is not None for frag in cleaned))
        self.assertEqual(cleaned[0].raw_r.find(f".//{{{W_NS}}}t").text, "комплексе ")
        self.assertEqual(
            cleaned[0].raw_r.find(f".//{{{W_NS}}}t").get("{http://www.w3.org/XML/1998/namespace}space"),
            "preserve",
        )
        self.assertIsNotNone(cleaned[1].raw_r.find(f".//{{{W_NS}}}b"))

    def test_generator_restores_section2_bookmark_for_toc_hyperlink(self):
        doc = Document()
        title = doc.add_paragraph("Титул")
        title.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("II. Основные результаты")
        title.add_run().add_break(WD_BREAK.PAGE)
        _add_bold_heading(doc, "I. Аудиторское мнение по иtогам проверки.")
        doc.add_paragraph("Текст раздела I")
        section2_heading = "II. Основные результаты аудита и аудиторские рекомендации"
        _add_bold_heading(doc, section2_heading)
        doc.add_paragraph("Старый текст раздела II.")
        _add_bold_heading(doc, "III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение 3.1. Первый контроль")
        doc.add_paragraph("Аудиторская рекомендация: Исправить.")
        doc.add_paragraph("Срок – 01.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / "input.docx"
            output_path = Path(tmp_dir) / "output.docx"
            doc.save(input_path)

            with zipfile.ZipFile(input_path, "r") as zf:
                document_xml = zf.read("word/document.xml").decode("utf-8")

            document_xml = document_xml.replace(
                "<w:t>II. Основные результаты</w:t>",
                '<w:hyperlink w:anchor="_TocSectionII"><w:r><w:t>II. Основные результаты</w:t></w:r></w:hyperlink>',
                1,
            )
            document_xml = document_xml.replace(
                f"<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:rPr>"
                f"<w:b/><w:bCs/></w:rPr><w:t>{section2_heading}</w:t></w:r></w:p>",
                (
                    f"<w:p><w:pPr><w:pStyle w:val=\"1\"/><w:outlineLvl w:val=\"0\"/>"
                    f"<w:pageBreakBefore/></w:pPr>"
                    f'<w:bookmarkStart w:id="42" w:name="_TocSectionII"/>'
                    f"<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>{section2_heading}</w:t></w:r>"
                    f'<w:bookmarkEnd w:id="42"/></w:p>'
                ),
                1,
            )
            document_xml = document_xml.replace(
                "<w:p><w:r><w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\"/>"
                "<w:b/><w:sz w:val=\"28\"/></w:rPr><w:t>I. Аудиторское мнение по иtогам проверки.</w:t></w:r></w:p>",
                (
                    "<w:p><w:pPr><w:pStyle w:val=\"1\"/><w:outlineLvl w:val=\"0\"/></w:pPr>"
                    "<w:r><w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\"/>"
                    "<w:b/><w:sz w:val=\"28\"/></w:rPr>"
                    "<w:t>I. Аудиторское мнение по иtогам проверки.</w:t></w:r></w:p>"
                ),
                1,
            )

            with zipfile.ZipFile(input_path, "r") as zf_in:
                patched_files = {
                    name: zf_in.read(name)
                    for name in zf_in.namelist()
                    if name != "word/document.xml"
                }
            patched_files["word/document.xml"] = document_xml.encode("utf-8")
            with zipfile.ZipFile(input_path, "w") as zf_out:
                for name, payload in patched_files.items():
                    zf_out.writestr(name, payload)

            result_path, observations, error = process_document(str(input_path), str(output_path))

            self.assertIsNone(error, msg=error)
            self.assertGreater(len(observations), 0)
            output_xml = zipfile.ZipFile(output_path).read("word/document.xml").decode("utf-8")
            self.assertIn('w:name="_TocSectionII"', output_xml)
            self.assertIn('w:anchor="_TocSectionII"', output_xml)
            self.assertIn('w:val="1"', output_xml)
            self.assertRegex(
                output_xml,
                r"</w:tbl>\s*<w:p[^>]*>\s*<w:r>\s*<w:br[^>]*w:type=\"page\"",
            )

    def test_generator_inserts_section2_after_section1_when_section3_missing(self):
        doc = Document()
        title = doc.add_paragraph("Титул")
        title.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("I. Аудиторское мнение")
        doc.add_paragraph("II. Основные результаты")
        doc.add_paragraph("IV. Контроль")
        doc.add_paragraph("V. Риски")
        doc.add_paragraph("VI. Итоги")
        title.add_run().add_break(WD_BREAK.PAGE)
        _add_bold_heading(doc, "I. Аудиторское мнение по иtогам проверки.")
        doc.add_paragraph("Текст раздела I.")
        _add_bold_heading(doc, "IV. Контроль отчетности")
        doc.add_paragraph("Наблюдение 4.1. Первый контроль")
        doc.add_paragraph("Аудиторская рекомендация: Исправить.")
        doc.add_paragraph("Срок – 01.05.2026.")
        _add_bold_heading(doc, "V. Управление рисками")
        doc.add_paragraph("3. Подпункт — не раздел III")
        _add_bold_heading(doc, "VI. Итоговые выводы")
        doc.add_paragraph("Наблюдение 6.1. Второй контроль")
        doc.add_paragraph("Аудиторская рекомендация: Исправить.")
        doc.add_paragraph("Срок – 02.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / "input.docx"
            output_path = Path(tmp_dir) / "output.docx"
            doc.save(input_path)

            result_path, _observations, error = process_document(str(input_path), str(output_path))

            self.assertIsNone(error, msg=error)
            output_xml = zipfile.ZipFile(output_path).read("word/document.xml").decode("utf-8")
            section1_pos = output_xml.index("по иtогам проверки.")
            section2_pos = output_xml.index(
                "II. Основные результаты аудита и аудиторские рекомендации"
            )
            self.assertLess(section1_pos, section2_pos)
            self.assertIn("<w:tbl", output_xml[section2_pos : output_xml.index("</w:tbl>", section2_pos)])

    def test_generator_keeps_title_xml_prefix_unchanged(self):
        doc = Document()
        title = doc.add_paragraph("ТИТУЛЬНАЯ СТРАНИЦА НЕ ДОЛЖНА МЕНЯТЬСЯ")
        title.add_run().add_break(WD_BREAK.PAGE)
        contents = doc.add_paragraph("Содержание")
        contents.add_run().add_break(WD_BREAK.PAGE)
        doc.add_paragraph("I. Аудиторское мнение")
        doc.add_paragraph("Текст раздела I")
        doc.add_paragraph("III. Детальные результаты аудита")
        doc.add_paragraph("Наблюдение № 3.1: Контроль титула")
        doc.add_paragraph("Уровень существенности: высокий")
        doc.add_paragraph("Аудиторская рекомендация: Не менять титул.")
        doc.add_paragraph("Срок – 01.05.2026.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / "input.docx"
            output_path = Path(tmp_dir) / "output.docx"
            doc.save(input_path)

            result_path, _observations, error = process_document(str(input_path), str(output_path))

            self.assertIsNone(error)
            self.assertEqual(result_path, str(output_path))
            original_xml = zipfile.ZipFile(input_path).read("word/document.xml")
            output_xml = zipfile.ZipFile(output_path).read("word/document.xml")
            title_marker = "ТИТУЛЬНАЯ СТРАНИЦА".encode("utf-8")
            title_pos = original_xml.index(title_marker)
            self.assertEqual(original_xml[:title_pos + len(title_marker)], output_xml[:title_pos + len(title_marker)])

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
