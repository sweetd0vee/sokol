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
            observation_names={
                "4.1": (
                    "Вопросы необходимости уточнения показателей нагрузки "
                    "менеджеров клиентского сервиса."
                ),
            },
        )
        self.assertNotIn("1.1", anchors)
        self.assertNotIn("1.2", anchors)
        self.assertEqual(anchors["4.1"], "SokolObs4_1")
        self.assertNotIn('w:name="SokolObs1_1"', updated)
        self.assertIn('w:name="SokolObs4_1"', updated)
        self.assertRegex(
            updated,
            r'w:bookmarkStart w:id="\d+" w:name="SokolObs4_1"/>.*?Наблюдение 4\.1\..*?<w:bookmarkEnd w:id="\d+"/>',
        )
        self.assertGreaterEqual(next_id, 11)

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
            observation_names={
                "4.1": (
                    "Вопросы необходимости уточнения показателей нагрузки "
                    "менеджеров клиентского сервиса."
                ),
            },
        )

        self.assertEqual(anchors["4.1"], "SokolObs4_1")
        self.assertIn('w:name="SokolObs4_1"', updated)

    def test_plain_paragraph_with_several_observations_is_not_a_link_target(self):
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
            observation_names={
                "2.1": "Первое",
                "2.2": "Второе",
                "2.3": "Третье",
            },
        )

        self.assertEqual(anchors, {})
        self.assertNotIn("SokolObs2_1", updated)
        self.assertNotIn("SokolObs2_2", updated)
        self.assertNotIn("SokolObs2_3", updated)

    def test_block_spans_start_bookmark_search_in_main_section(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>Содержание Наблюдение 1.1. Наблюдение 1.2.</w:t></w:r></w:p>
    <w:p><w:r><w:t>III. Детальные результаты</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Наблюдение 1.1.</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Первое замечание</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Наблюдение 1.2.</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Второе замечание</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
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
            observation_names={"1.1": "Первое замечание", "1.2": "Второе замечание"},
        )

        self.assertEqual(anchors["1.1"], "SokolObs1_1")
        self.assertEqual(anchors["1.2"], "SokolObs1_2")
        section3_idx = updated.find("III. Детальные результаты")
        first_bookmark_idx = updated.find('w:name="SokolObs1_1"')
        self.assertGreater(first_bookmark_idx, section3_idx)

    def test_bordered_frame_wins_over_mention_in_text(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>Проверкой установлено, см. Наблюдение 3.1 в описании процесса.</w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pBdr><w:top w:val="single"/></w:pBdr></w:pPr>
      <w:r><w:t>Наблюдение 3.1.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pBdr><w:bottom w:val="single"/></w:pBdr></w:pPr>
      <w:r><w:t>Несвоевременное обновление лимитов</w:t></w:r>
    </w:p>
  </w:body>
</w:document>
"""
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["3.1"],
            bookmark_start_id=10,
            observation_names={"3.1": "Несвоевременное обновление лимитов"},
        )

        self.assertEqual(anchors["3.1"], "SokolObs3_1")
        mention = _paragraph_containing(updated, "в описании процесса")
        heading = _paragraph_containing(updated, "Наблюдение 3.1.")
        self.assertNotIn("SokolObs3_1", mention)
        self.assertIn("SokolObs3_1", heading)
        self.assertIn("pBdr", heading)

    def test_table_frame_wins_over_mention_in_text(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>В ходе проверки указано Наблюдение 3.1 как пример.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Наблюдение 3.1.</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Несвоевременное обновление лимитов</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
"""
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["3.1"],
            bookmark_start_id=20,
            observation_names={"3.1": "Несвоевременное обновление лимитов"},
        )

        self.assertEqual(anchors["3.1"], "SokolObs3_1")
        mention = _paragraph_containing(updated, "как пример")
        heading = _paragraph_containing(updated, "Наблюдение 3.1.")
        self.assertNotIn("SokolObs3_1", mention)
        self.assertIn("SokolObs3_1", heading)
        self.assertLess(updated.find("как пример"), updated.find('w:name="SokolObs3_1"'))

    def test_plain_heading_with_name_is_not_a_link_target(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>Наблюдение 4.1. Контроль сроков исполнения заявок</w:t></w:r></w:p>
    <w:p><w:r><w:t>Повторно см. Наблюдение 4.1 при следующей проверке.</w:t></w:r></w:p>
  </w:body>
</w:document>
"""
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["4.1"],
            bookmark_start_id=30,
            observation_names={"4.1": "Контроль сроков исполнения заявок"},
        )

        self.assertNotIn("4.1", anchors)
        heading = _paragraph_containing(updated, "Контроль сроков исполнения заявок")
        mention = _paragraph_containing(updated, "при следующей проверке")
        self.assertNotIn("SokolObs4_1", heading)
        self.assertNotIn("SokolObs4_1", mention)

    def test_bordered_text_reference_is_not_a_title_frame(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p>
      <w:pPr><w:pBdr><w:top w:val="single"/></w:pBdr></w:pPr>
      <w:r><w:t>Наблюдение 5.2. Ошибки обработки заявок упоминаются далее в тексте.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>
"""
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["5.2"],
            bookmark_start_id=35,
            observation_names={"5.2": "Ошибки обработки заявок"},
        )

        self.assertNotIn("5.2", anchors)
        self.assertNotIn("SokolObs5_2", updated)

    def test_title_frame_wins_over_earlier_plain_heading(self):
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>Наблюдение 3.1. Несвоевременное обновление лимитов упоминается в тексте.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Наблюдение 3.1.</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Несвоевременное обновление лимитов</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
"""
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["3.1"],
            bookmark_start_id=40,
            observation_names={"3.1": "Несвоевременное обновление лимитов"},
        )

        self.assertEqual(anchors["3.1"], "SokolObs3_1")
        plain = _paragraph_containing(updated, "упоминается в тексте")
        heading = _paragraph_containing(updated, ">Наблюдение 3.1.</w:t>")
        self.assertNotIn("SokolObs3_1", plain)
        self.assertIn("SokolObs3_1", heading)

    def test_long_title_in_table_beats_earlier_copy(self):
        name = (
            "Вопросы необходимости уточнения показателей нагрузки менеджеров "
            "клиентского сервиса сегмента Крупный и закрепления методики расчета"
        )
        document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    <w:p><w:r><w:t>Наблюдение 3.1.1. {name} — это не заголовок, а отсылка в тексте.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Наблюдение 3.1.1.</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{name}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
"""
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["3.1.1"],
            bookmark_start_id=50,
            observation_names={"3.1.1": name},
        )

        self.assertEqual(anchors["3.1.1"], "SokolObs3_1_1")
        plain = _paragraph_containing(updated, "это не заголовок")
        heading = _paragraph_containing(updated, ">Наблюдение 3.1.1.</w:t>")
        self.assertNotIn("SokolObs3_1_1", plain)
        self.assertIn("SokolObs3_1_1", heading)


def _paragraph_containing(document_xml: str, snippet: str) -> str:
    for match in re.finditer(r"<w:p\b.*?</w:p>", document_xml, re.DOTALL):
        if snippet in match.group(0):
            return match.group(0)
    raise AssertionError(f"Абзац с текстом {snippet!r} не найден")


if __name__ == "__main__":
    unittest.main()
