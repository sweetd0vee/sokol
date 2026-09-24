# -*- coding: utf-8 -*-
import re
import unittest

from sokol_reports.section_ii.observation_links import ensure_observation_bookmarks
from sokol_reports.section_ii.patterns import W_NS


def _document(body: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    {body}
  </w:body>
</w:document>
"""


def _paragraph_containing(document_xml: str, snippet: str) -> str:
    for match in re.finditer(r"<w:p\b.*?</w:p>", document_xml, re.DOTALL):
        if snippet in match.group(0):
            return match.group(0)
    raise AssertionError(f"Абзац с текстом {snippet!r} не найден")


class ObservationLinkTargetTests(unittest.TestCase):
    def test_bordered_frame_wins_over_mention_in_text(self) -> None:
        document_xml = _document(
            """
            <w:p><w:r><w:t>Проверкой установлено, см. Наблюдение 3.1 в описании процесса.</w:t></w:r></w:p>
            <w:p>
              <w:pPr><w:pBdr><w:top w:val="single"/></w:pBdr></w:pPr>
              <w:r><w:t>Наблюдение 3.1.</w:t></w:r>
            </w:p>
            <w:p>
              <w:pPr><w:pBdr><w:bottom w:val="single"/></w:pBdr></w:pPr>
              <w:r><w:t>Несвоевременное обновление лимитов</w:t></w:r>
            </w:p>
            """
        )
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

    def test_table_frame_wins_over_mention_in_text(self) -> None:
        document_xml = _document(
            """
            <w:p><w:r><w:t>В ходе проверки указано Наблюдение 3.1 как пример.</w:t></w:r></w:p>
            <w:tbl>
              <w:tr>
                <w:tc><w:p><w:r><w:t>Наблюдение 3.1.</w:t></w:r></w:p></w:tc>
                <w:tc><w:p><w:r><w:t>Несвоевременное обновление лимитов</w:t></w:r></w:p></w:tc>
              </w:tr>
            </w:tbl>
            """
        )
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

    def test_plain_heading_with_name_ignores_later_mention(self) -> None:
        document_xml = _document(
            """
            <w:p><w:r><w:t>Наблюдение 4.1. Контроль сроков исполнения заявок</w:t></w:r></w:p>
            <w:p><w:r><w:t>Повторно см. Наблюдение 4.1 при следующей проверке.</w:t></w:r></w:p>
            """
        )
        updated, anchors, _next_id = ensure_observation_bookmarks(
            document_xml,
            ["4.1"],
            bookmark_start_id=30,
            observation_names={"4.1": "Контроль сроков исполнения заявок"},
        )

        self.assertEqual(anchors["4.1"], "SokolObs4_1")
        heading = _paragraph_containing(updated, "Контроль сроков исполнения заявок")
        mention = _paragraph_containing(updated, "при следующей проверке")
        self.assertIn("SokolObs4_1", heading)
        self.assertNotIn("SokolObs4_1", mention)

    def test_title_frame_wins_over_earlier_plain_heading(self) -> None:
        document_xml = _document(
            """
            <w:p><w:r><w:t>Наблюдение 3.1. Несвоевременное обновление лимитов упоминается в тексте.</w:t></w:r></w:p>
            <w:tbl>
              <w:tr>
                <w:tc><w:p><w:r><w:t>Наблюдение 3.1.</w:t></w:r></w:p></w:tc>
                <w:tc><w:p><w:r><w:t>Несвоевременное обновление лимитов</w:t></w:r></w:p></w:tc>
              </w:tr>
            </w:tbl>
            """
        )
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

    def test_long_title_in_table_beats_earlier_copy(self) -> None:
        name = (
            "Вопросы необходимости уточнения показателей нагрузки менеджеров "
            "клиентского сервиса сегмента Крупный и закрепления методики расчета"
        )
        document_xml = _document(
            f"""
            <w:p><w:r><w:t>Наблюдение 3.1.1. {name} — это не заголовок, а отсылка в тексте.</w:t></w:r></w:p>
            <w:tbl>
              <w:tr>
                <w:tc><w:p><w:r><w:t>Наблюдение 3.1.1.</w:t></w:r></w:p></w:tc>
                <w:tc><w:p><w:r><w:t>{name}</w:t></w:r></w:p></w:tc>
              </w:tr>
            </w:tbl>
            """
        )
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


if __name__ == "__main__":
    unittest.main()
