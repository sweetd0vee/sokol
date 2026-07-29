import unittest

from app.services.reports.section_ii.bookmark_utils import (
    find_toc_anchor_names,
    is_empty_section2_heading_text,
    normalize_section2_heading_text,
    resolve_section2_bookmark_names,
    resolve_section2_heading_text,
)
from app.services.reports.section_ii.patterns import DEFAULT_SECTION2_HEADING, W_NS
from app.services.reports.section_ii import xml_utils


class BookmarkUtilsTests(unittest.TestCase):
    def test_extract_bookmark_names_from_section_heading(self):
        paragraph_xml = (
            '<w:p xmlns:w="' + W_NS + '">'
            '<w:bookmarkStart w:id="12" w:name="_Toc123456789"/>'
            "<w:r><w:t>II. Основные результаты аудита</w:t></w:r>"
            '<w:bookmarkEnd w:id="12"/>'
            "</w:p>"
        )
        from app.services.reports.section_ii.bookmark_utils import extract_bookmark_names

        self.assertEqual(extract_bookmark_names(paragraph_xml), ["_Toc123456789"])

    def test_find_toc_anchor_names_from_hyperlink(self):
        prefix_xml = (
            '<w:p xmlns:w="' + W_NS + '">'
            '<w:hyperlink w:anchor="_Toc123456789">'
            "<w:r><w:t>II. Основные результаты аудита</w:t></w:r>"
            "</w:hyperlink>"
            "</w:p>"
        )
        self.assertEqual(find_toc_anchor_names(prefix_xml), ["_Toc123456789"])

    def test_find_toc_anchor_names_for_empty_link_between_sections(self):
        prefix_xml = (
            '<w:body xmlns:w="' + W_NS + '">'
            '<w:p><w:hyperlink w:anchor="_Toc1">'
            "<w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:hyperlink></w:p>"
            '<w:p><w:hyperlink w:anchor="_Toc2">'
            "<w:r><w:t> </w:t></w:r></w:hyperlink></w:p>"
            '<w:p><w:hyperlink w:anchor="_Toc3">'
            "<w:r><w:t>III. Детальные результаты</w:t></w:r></w:hyperlink></w:p>"
            "</w:body>"
        )
        self.assertEqual(find_toc_anchor_names(prefix_xml), ["_Toc2"])

    def test_find_toc_anchor_names_when_section2_missing(self):
        prefix_xml = (
            '<w:body xmlns:w="' + W_NS + '">'
            '<w:p><w:hyperlink w:anchor="_Toc1">'
            "<w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:hyperlink></w:p>"
            '<w:p><w:hyperlink w:anchor="_Toc3">'
            "<w:r><w:t>III. Детальные результаты</w:t></w:r></w:hyperlink></w:p>"
            "</w:body>"
        )
        self.assertEqual(find_toc_anchor_names(prefix_xml), [])

    def test_resolve_section2_bookmark_names_prefers_original_heading(self):
        toc_paragraph = (
            '<w:p><w:hyperlink w:anchor="_Toc999">'
            "<w:r><w:t>II. Основные результаты</w:t></w:r></w:hyperlink></w:p>"
        )
        heading_paragraph = (
            '<w:p><w:bookmarkStart w:id="5" w:name="_Toc555"/>'
            "<w:r><w:t>II. Основные результаты аудита</w:t></w:r>"
            '<w:bookmarkEnd w:id="5"/></w:p>'
        )
        body_open = f'<w:body xmlns:w="{W_NS}">'
        body_close = "</w:body>"
        document_xml = body_open + toc_paragraph + heading_paragraph + body_close
        offset = len(body_open)
        block_spans = [
            (offset, offset + len(toc_paragraph)),
            (offset + len(toc_paragraph), offset + len(toc_paragraph) + len(heading_paragraph)),
        ]
        names = resolve_section2_bookmark_names(document_xml, block_spans, 1)
        self.assertIn("_Toc555", names)
        self.assertIn("_Toc999", names)

    def test_empty_section2_heading_uses_default_title(self):
        self.assertTrue(is_empty_section2_heading_text("II."))
        self.assertEqual(
            normalize_section2_heading_text("II."),
            DEFAULT_SECTION2_HEADING,
        )

    def test_resolve_section2_heading_from_variant_toc_text(self):
        prefix_xml = (
            '<w:p xmlns:w="' + W_NS + '">'
            '<w:hyperlink w:anchor="_Toc999">'
            "<w:r><w:t>II. Основные результаты аудита и итоговые аудиторские рекомендации.</w:t></w:r>"
            "</w:hyperlink>"
            "</w:p>"
        )
        heading = resolve_section2_heading_text(prefix_xml, [], None)
        self.assertIn("итоговые аудиторские рекомендации", heading)

    def test_section2_start_re_does_not_match_section3_heading(self):
        from app.services.reports.section_ii.patterns import SECTION2_START_RE

        self.assertFalse(SECTION2_START_RE.match("III. Детальные результаты аудита"))
        self.assertFalse(SECTION2_START_RE.match("Раздел III. Детальные результаты"))
        self.assertTrue(SECTION2_START_RE.match("II. Основные результаты аудита"))
        self.assertTrue(SECTION2_START_RE.match("II."))

    def test_find_section2_in_xml_skips_section3_heading(self):
        import xml.etree.ElementTree as ET

        body_xml = (
            f'<w:body xmlns:w="{W_NS}">'
            "<w:p><w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>II. Основные результаты аудита</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Старый текст раздела II</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>III. Детальные результаты аудита</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Наблюдение 3.1. Первый контроль</w:t></w:r></w:p>"
            "</w:body>"
        )
        root = ET.fromstring(body_xml)
        section2 = xml_utils.find_section2_in_xml(root, min_idx=0)
        self.assertIsNotNone(section2)
        start_idx, end_idx = section2
        self.assertEqual(start_idx, 1)
        self.assertEqual(end_idx, 3)

    def test_find_section2_in_xml_for_empty_body_heading(self):
        import xml.etree.ElementTree as ET

        body_xml = (
            f'<w:body xmlns:w="{W_NS}">'
            "<w:p><w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>II.</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>III. Детальные результаты</w:t></w:r></w:p>"
            "</w:body>"
        )
        root = ET.fromstring(body_xml)
        section2 = xml_utils.find_section2_in_xml(root, min_idx=0)
        self.assertIsNotNone(section2)
        self.assertEqual(section2[0], 1)

    def test_find_insert_index_after_section1_when_section3_missing(self):
        import xml.etree.ElementTree as ET

        body_xml = (
            f'<w:body xmlns:w="{W_NS}">'
            "<w:p><w:r><w:t>I. Аудиторское мнение по итогам проверки.</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Текст раздела I.</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>IV. Контроль отчетности</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>V. Управление рисками</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>3. Подпункт внутри раздела V — не заголовок раздела</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>VI. Итоговые выводы</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Наблюдение 6.1. Контроль</w:t></w:r></w:p>"
            "</w:body>"
        )
        root = ET.fromstring(body_xml)
        section1_start = xml_utils.find_section1_start(root, min_idx=0)
        self.assertEqual(section1_start, 0)
        insert_idx = xml_utils.find_insert_index_for_new_section2(root, section1_start, min_idx=0)
        self.assertEqual(insert_idx, 2)

    def test_find_insert_before_section3_ignores_table_with_iii_substring(self):
        import xml.etree.ElementTree as ET

        body_xml = (
            f'<w:body xmlns:w="{W_NS}">'
            "<w:p><w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Текст раздела I</w:t></w:r></w:p>"
            "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>ссылка на раздел III в таблице</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"
            "<w:p><w:r><w:t>IV. Следующий раздел</w:t></w:r></w:p>"
            "</w:body>"
        )
        root = ET.fromstring(body_xml)
        section1_start = xml_utils.find_section1_start(root, min_idx=0)
        insert_idx = xml_utils.find_insert_index_for_new_section2(root, section1_start, min_idx=0)
        self.assertEqual(insert_idx, 3)

    def test_find_section1_start_skips_toc_when_min_idx_after_contents(self):
        import xml.etree.ElementTree as ET

        body_xml = (
            f'<w:body xmlns:w="{W_NS}">'
            "<w:p><w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>II. Основные результаты</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>III. Детальные результаты</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>I. Аудиторское мнение по итогам проверки.</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>IV. Контроль</w:t></w:r></w:p>"
            "</w:body>"
        )
        root = ET.fromstring(body_xml)
        section1_start = xml_utils.find_section1_start(root, min_idx=3)
        self.assertEqual(section1_start, 3)

        section1_start_late = xml_utils.find_section1_start(root, min_idx=0)
        self.assertEqual(section1_start_late, 3)

    def test_build_section_heading_paragraph_copies_paragraph_style(self):
        import xml.etree.ElementTree as ET
        from app.services.reports.section_ii.bookmark_utils import build_section_heading_paragraph

        template = ET.fromstring(
            f'<w:p xmlns:w="{W_NS}">'
            "<w:pPr>"
            '<w:pStyle w:val="1"/>'
            '<w:outlineLvl w:val="0"/>'
            "<w:spacing w:before=\"240\" w:after=\"120\"/>"
            "</w:pPr>"
            "<w:r><w:rPr><w:b/></w:rPr><w:t>I. Аудиторское мнение</w:t></w:r>"
            "</w:p>"
        )
        heading = build_section_heading_paragraph(
            template,
            "II. Основные результаты аудита",
            bookmark_names=["_TocSectionII"],
            bookmark_start_id=10,
        )
        heading_xml = ET.tostring(heading, encoding="unicode")
        self.assertIn('w:val="1"', heading_xml)
        self.assertIn("Основные результаты аудита", heading_xml)
        self.assertNotIn("II. II.", heading_xml)
        self.assertIn('w:name="_TocSectionII"', heading_xml)
        self.assertIn("pageBreakBefore", heading_xml)

    def test_build_section_heading_paragraph_strips_prefix_with_auto_numbering(self):
        import xml.etree.ElementTree as ET
        from app.services.reports.section_ii.bookmark_utils import build_section_heading_paragraph

        template = ET.fromstring(
            f'<w:p xmlns:w="{W_NS}">'
            "<w:pPr>"
            '<w:pStyle w:val="1"/>'
            "<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr>"
            "</w:pPr>"
            "<w:r><w:t>Аудиторское мнение по итогам проверки.</w:t></w:r>"
            "</w:p>"
        )
        heading = build_section_heading_paragraph(
            template,
            "II. Основные результаты аудита и аудиторские рекомендации",
        )
        text_nodes = [node.text or "" for node in heading.findall(f".//{{{W_NS}}}t")]
        self.assertEqual("".join(text_nodes), "Основные результаты аудита и аудиторские рекомендации")

    def test_add_bookmarks_to_paragraph(self):
        import xml.etree.ElementTree as ET
        from app.services.reports.section_ii.bookmark_utils import add_bookmarks_to_paragraph

        paragraph = ET.Element(f"{{{W_NS}}}p")
        ET.SubElement(paragraph, f"{{{W_NS}}}pPr")
        ET.SubElement(paragraph, f"{{{W_NS}}}r")
        add_bookmarks_to_paragraph(paragraph, ["_Toc123"], 7)
        starts = paragraph.findall(f"./{{{W_NS}}}bookmarkStart")
        ends = paragraph.findall(f"./{{{W_NS}}}bookmarkEnd")
        self.assertEqual(len(starts), 1)
        self.assertEqual(starts[0].get(f"{{{W_NS}}}name"), "_Toc123")
        self.assertEqual(starts[0].get(f"{{{W_NS}}}id"), "7")
        self.assertEqual(len(ends), 1)
        self.assertEqual(ends[0].get(f"{{{W_NS}}}id"), "7")


if __name__ == "__main__":
    unittest.main()
