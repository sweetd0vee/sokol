import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from docx import Document
from docx.enum.text import WD_BREAK, WD_LINE_SPACING
from docx.shared import Pt

from app.api.v1.endpoints.instruments_reports import _canonicalize_memorandum_source
from app.services.reports.memorandum.docx_generator import generate_memorandum
from app.services.reports.memorandum.models import (
    MemorandumAuditObject,
    MemorandumRecommendation,
    MemorandumSource,
)
from app.services.reports.memorandum.parser import document_has_section_ii, parse_az_for_memorandum
from app.services.reports.memorandum.section_ii_table_parser import (
    _extract_observation_name,
    parse_section_ii_for_memorandum,
)
from app.services.reports.section_ii.docx_generator import process_document


def _session_with_departments(names: list[str]) -> AsyncMock:
    session = AsyncMock()
    result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = names
    result.scalars.return_value = scalars
    session.execute.return_value = result
    return session


def _build_az_without_section_ii(path: Path) -> None:
    doc = Document()
    title = doc.add_paragraph("Комплексный аудит процессов кредитования")
    title.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("I. Аудиторское мнение")
    doc.add_paragraph("II. Основные результаты")
    doc.add_paragraph("III. Детальные результаты")
    title.add_run().add_break(WD_BREAK.PAGE)
    doc.add_paragraph("I. Аудиторское мнение по итогам проверки.")
    doc.add_paragraph("Текст раздела I.")
    doc.add_paragraph("III. Детальные результаты аудита")
    doc.add_paragraph("Глава 3. Кредитные процессы")
    doc.add_paragraph("Наблюдение 3.1. Несвоевременное обновление лимитов")
    doc.add_paragraph("Уровень существенности: средний")
    doc.add_paragraph("Аудиторская рекомендация: Внедрить контроль сроков.")
    doc.add_paragraph("Срок – 01.09.2026")
    doc.save(path)


class MemorandumGeneratorTest(unittest.TestCase):
    def test_extracts_observation_name_without_row_label(self):
        name = _extract_observation_name([
            "Наблюдение 3.1.",
            "Несвоевременное обновление лимитов кредитования",
        ])

        self.assertEqual(name, "Несвоевременное обновление лимитов кредитования")

    def test_document_without_section_ii_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az_no_ii.docx"
            _build_az_without_section_ii(az_path)
            self.assertFalse(document_has_section_ii(str(az_path)))

            source, error = parse_az_for_memorandum(str(az_path))
            self.assertIsNone(source)
            self.assertIn("Раздел II", error or "")

    def test_parse_generated_memorandum_recommendations(self):
        source = MemorandumSource(
            groups=[
                MemorandumAuditObject(
                    name="Департамент розничных продуктов",
                    manager="Ванагель У.П.",
                    recommendations=[
                        MemorandumRecommendation(
                            paragraphs=["Внести изменения в Положение о Комиссии."],
                            deadline="01.07.2026",
                        ),
                        MemorandumRecommendation(
                            paragraphs=["Обновить регламент."],
                            deadline="15.08.2026",
                        ),
                    ],
                )
            ]
        )
        with tempfile.TemporaryDirectory() as tmp:
            memo_path = Path(tmp) / "memo.docx"
            result_path, error = generate_memorandum(source, str(memo_path))
            self.assertIsNone(error)

            from app.services.reports.memorandum.memorandum_doc_parser import (
                parse_recommendations_from_memorandum,
            )

            parsed, parse_error = parse_recommendations_from_memorandum(result_path)
            self.assertIsNone(parse_error, msg=parse_error)
            self.assertIsNotNone(parsed)
            self.assertEqual(len(parsed.groups), 1)
            self.assertEqual(len(parsed.groups[0].recommendations), 2)
            self.assertIn("Положение о Комиссии", parsed.groups[0].recommendations[0].paragraphs[0])

    def test_generate_memorandum_groups_by_audit_object(self):
        source = MemorandumSource(
            groups=[
                MemorandumAuditObject(
                    name="Департамент розничных продуктов",
                    manager="Ванагель У.П.",
                    recommendations=[
                        MemorandumRecommendation(
                            paragraphs=["Внести изменения в Положение о Комиссии."],
                            deadline="01.07.2026",
                        )
                    ],
                )
            ]
        )
        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "memo.docx"
            result_path, error = generate_memorandum(source, str(out_path))
            self.assertIsNone(error)
            self.assertTrue(Path(result_path).is_file())

            doc = Document(result_path)
            text = "\n".join(p.text for p in doc.paragraphs)
            self.assertIn("Приложение 2", text)
            self.assertIn("Перечень аудиторских рекомендаций.", text)
            self.assertIn("I. Департамент розничных продуктов (Ванагель У.П.):", text)
            self.assertIn("1.\u00a0Внести изменения в Положение о Комиссии.", text)
            self.assertIn("Срок – 01.07.2026", text)
            for paragraph in doc.paragraphs:
                fmt = paragraph.paragraph_format
                self.assertEqual(fmt.space_before, Pt(0))
                self.assertEqual(fmt.space_after, Pt(0))
                self.assertEqual(fmt.line_spacing_rule, WD_LINE_SPACING.SINGLE)

    def test_canonicalize_memorandum_source_merges_department_typos(self):
        source = MemorandumSource(
            groups=[
                MemorandumAuditObject(
                    name="Департамент - 1",
                    manager="Иванов И.И.",
                    recommendations=[MemorandumRecommendation(paragraphs=["Первая"])],
                ),
                MemorandumAuditObject(
                    name="департамент-1",
                    manager="Иванов И.И.",
                    recommendations=[MemorandumRecommendation(paragraphs=["Вторая"])],
                ),
            ]
        )
        session = _session_with_departments(["Департамент-1"])

        async def run() -> None:
            result = await _canonicalize_memorandum_source(session, source)
            self.assertEqual(len(result.groups), 1)
            self.assertEqual(result.groups[0].name, "Департамент-1")
            self.assertEqual(len(result.groups[0].recommendations), 2)

        asyncio.run(run())

    def test_generate_memorandum_from_az_with_section_ii(self):
        with tempfile.TemporaryDirectory() as tmp:
            az_path = Path(tmp) / "az.docx"
            _build_az_without_section_ii(az_path)
            out_az_path = Path(tmp) / "az_section_ii.docx"
            result_path, _observations, error = process_document(str(az_path), str(out_az_path))
            self.assertIsNone(error, msg=error)
            self.assertTrue(Path(result_path).is_file())

            self.assertTrue(document_has_section_ii(result_path))
            source, parse_error = parse_az_for_memorandum(result_path)
            self.assertIsNone(parse_error, msg=parse_error)
            self.assertIsNotNone(source)
            self.assertTrue(source.groups)

            memo_path = Path(tmp) / "memo.docx"
            memo_result, gen_error = generate_memorandum(source, str(memo_path))
            self.assertIsNone(gen_error, msg=gen_error)
            self.assertTrue(Path(memo_result).is_file())

            doc = Document(memo_result)
            text = "\n".join(p.text for p in doc.paragraphs)
            self.assertIn("Приложение 2", text)
            self.assertIn("1.", text)
            self.assertIn("Срок –", text)

    def test_parse_test2_az_groups_recommendations(self):
        az_dir = Path(__file__).resolve().parents[2] / "az"
        candidates = [f for f in az_dir.glob("*.docx") if "тест2" in f.name.lower() and not f.name.startswith("~")]
        if not candidates:
            self.skipTest("Файл АЗ тест2 не найден")

        with tempfile.TemporaryDirectory() as tmp:
            section_ii_path = Path(tmp) / "az_section_ii.docx"
            result_path, _, error = process_document(str(candidates[0]), str(section_ii_path))
            self.assertIsNone(error, msg=error)

            source, parse_error = parse_section_ii_for_memorandum(result_path)
            self.assertIsNone(parse_error, msg=parse_error)
            self.assertIsNotNone(source)
            self.assertGreaterEqual(len(source.groups), 2)

            total_recommendations = sum(len(group.recommendations) for group in source.groups)
            self.assertGreaterEqual(total_recommendations, 8)

            first_group = source.groups[0]
            self.assertTrue(first_group.name)
            self.assertTrue(first_group.manager)
            self.assertTrue(first_group.recommendations[0].paragraphs[0])


if __name__ == "__main__":
    unittest.main()
