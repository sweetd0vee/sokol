# -*- coding: utf-8 -*-
import re
import unittest
import xml.etree.ElementTree as ET

from app.services.reports.section_ii.observation_links import (
    bookmark_name_for_observation,
    ensure_observation_bookmarks,
)
from app.services.reports.section_ii.table_builder import create_table_xml
from app.services.reports.section_ii.models import Observation
from app.services.reports.section_ii import xml_utils


W_NS = xml_utils.W_NS


def _sample_document_xml() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>I. Аудиторское мнение</w:t></w:r></w:p>
    <w:p><w:r><w:t>III. Основные результаты</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Наблюдение 4.1. Вопросы необходимости уточнения показателей нагрузки менеджеров клиентского сервиса.</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t>Наблюдение 1.1. Первое замечание</w:t></w:r></w:p>
    <w:p><w:r><w:t>Наблюдение 1.2. Второе замечание</w:t></w:r></w:p>
  </w:body>
</w:document>
"""


class ObservationLinksTests(unittest.TestCase):
    def test_bookmark_name(self):
        self.assertEqual(bookmark_name_for_observation("1.1"), "SokolObs1_1")
        self.assertEqual(bookmark_name_for_observation("3.1.2"), "SokolObs3_1_2")

    def test_ensure_observation_bookmarks_and_table_hyperlinks(self):
        document_xml = _sample_document_xml()
        updated, anchors, next_id = ensure_observation_bookmarks(
            document_xml,
            ["1.1", "1.2", "4.1"],
            bookmark_start_id=10,
        )
        self.assertEqual(anchors["1.1"], "SokolObs1_1")
        self.assertEqual(anchors["1.2"], "SokolObs1_2")
        self.assertEqual(anchors["4.1"], "SokolObs4_1")
        self.assertIn('w:name="SokolObs1_1"', updated)
        self.assertIn('w:name="SokolObs4_1"', updated)
        self.assertRegex(
            updated,
            r'w:bookmarkStart w:id="\d+" w:name="SokolObs4_1"/>.*?Наблюдение 4\.1\..*?<w:bookmarkEnd w:id="\d+"/>',
        )
        self.assertGreaterEqual(next_id, 13)

        observations = [
            Observation(
                number="4.1",
                chapter="4",
                chapter_title="Глава",
                name="Вопросы необходимости уточнения показателей нагрузки менеджеров клиентского сервиса.",
                materiality_level="низкий",
                recommendations="Сделать",
                deadline="",
                rec_label="Рекомендация",
            )
        ]
        table = create_table_xml(observations, observation_anchors=anchors)
        table_xml = ET.tostring(table, encoding="unicode")
        self.assertIn("SokolObs4_1", table_xml)
        self.assertIn("fldChar", table_xml)
        self.assertIn("instrText", table_xml)
        self.assertIn("HYPERLINK", table_xml)
        self.assertIn(r'\l "SokolObs4_1"', table_xml)
        self.assertNotIn("fldSimple", table_xml)
        self.assertIn(
            "Вопросы необходимости уточнения показателей нагрузки менеджеров клиентского сервиса.",
            table_xml,
        )
        # Номер наблюдения — обычный текст, без гиперссылки рядом с «Наблюдение 4.1.»
        num_idx = table_xml.find("Наблюдение 4.1.")
        self.assertGreaterEqual(num_idx, 0)
        close_match = re.search(r"</(?:\w+:)?tc>", table_xml[num_idx:])
        self.assertIsNotNone(close_match)
        number_cell_xml = table_xml[num_idx:num_idx + close_match.end()]
        self.assertNotIn("HYPERLINK", number_cell_xml)

    def test_ignores_old_hidden_bookmark_names(self):
        document_xml = _sample_document_xml().replace(
            "<w:r><w:t>Наблюдение 4.1.",
            '<w:bookmarkStart w:id="42" w:name="_sokol_obs_4_1"/>'
            "<w:r><w:t>Наблюдение 4.1.",
        ).replace(
            "</w:t></w:r></w:p></w:tc>",
            '</w:t></w:r><w:bookmarkEnd w:id="42"/></w:p></w:tc>',
            1,
        )

        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["4.1"],
            bookmark_start_id=100,
        )

        self.assertEqual(anchors["4.1"], "SokolObs4_1")
        self.assertIn('w:name="SokolObs4_1"', updated)

    def test_adds_bookmarks_for_multiple_observations_in_one_paragraph(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>III. Детальные результаты</w:t></w:r></w:p>
    <w:p><w:r><w:t>Наблюдение 2.1. Первое. Наблюдение 2.2. Второе. Наблюдение 2.3. Третье.</w:t></w:r></w:p>
  </w:body>
</w:document>
"""

        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["2.1", "2.2", "2.3"],
            bookmark_start_id=20,
        )

        self.assertEqual(anchors["2.1"], "SokolObs2_1")
        self.assertEqual(anchors["2.2"], "SokolObs2_2")
        self.assertEqual(anchors["2.3"], "SokolObs2_3")
        self.assertIn('w:name="SokolObs2_1"', updated)
        self.assertIn('w:name="SokolObs2_2"', updated)
        self.assertIn('w:name="SokolObs2_3"', updated)

    def test_block_spans_start_bookmark_search_in_main_section(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>Содержание Наблюдение 1.1. Наблюдение 1.2.</w:t></w:r></w:p>
    <w:p><w:r><w:t>III. Детальные результаты</w:t></w:r></w:p>
    <w:p><w:r><w:t>Наблюдение 1.1. Первое.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Наблюдение 1.2. Второе.</w:t></w:r></w:p>
  </w:body>
</w:document>
"""
        block_spans = [(match.start(), match.end()) for match in re.finditer(r"<w:p>.*?</w:p>", document_xml, re.DOTALL)]
        blocks = [
            ("p", ET.fromstring(document_xml[start:end].replace("<w:p>", f'<w:p xmlns:w="{W_NS}">', 1)))
            for start, end in block_spans
        ]

        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["1.1", "1.2"],
            bookmark_start_id=30,
            block_spans=block_spans,
            blocks=blocks,
        )

        self.assertEqual(anchors["1.1"], "SokolObs1_1")
        self.assertEqual(anchors["1.2"], "SokolObs1_2")
        section3_idx = updated.find("III. Детальные результаты")
        first_bookmark_idx = updated.find('w:name="SokolObs1_1"')
        self.assertGreater(first_bookmark_idx, section3_idx)


if __name__ == "__main__":
    unittest.main()
