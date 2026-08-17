import unittest

from sokol_reports.dictionaries.dictionary_text import find_dictionary_label_match
from sokol_reports.dictionaries.validation import DictionaryRefError, canonicalize_audit_objects
from sokol_reports.memorandum.canonicalize import canonicalize_memorandum_source
from sokol_reports.memorandum.models import MemorandumAuditObject, MemorandumRecommendation, MemorandumSource


class DepartmentCanonicalizationTests(unittest.TestCase):
    def test_maps_known_department_from_catalog(self) -> None:
        result = canonicalize_audit_objects(["Административно-хозяйственный департамент"])
        self.assertEqual(result, ["Административно-хозяйственный департамент"])

    def test_maps_spacing_and_hyphen_variants(self) -> None:
        result = canonicalize_audit_objects(
            ["департамент - 1", "Департамент ИТ"],
            department_names=["Департамент-1", "Департамент ИТ"],
        )
        self.assertEqual(result, ["Департамент-1", "Департамент ИТ"])

    def test_rejects_unknown_department(self) -> None:
        with self.assertRaises(DictionaryRefError) as ctx:
            canonicalize_audit_objects(["Неизвестный департамент"])
        self.assertEqual(ctx.exception.dictionary, "departments")

    def test_merges_groups_with_same_canonical_department(self) -> None:
        source = MemorandumSource(
            groups=[
                MemorandumAuditObject(
                    name="Департамент информационных технологий",
                    manager="Иванов И.И.",
                    recommendations=[MemorandumRecommendation(paragraphs=["Первая"])],
                ),
                MemorandumAuditObject(
                    name="департамент информационных технологий",
                    manager="Иванов И.И.",
                    recommendations=[MemorandumRecommendation(paragraphs=["Вторая"])],
                ),
            ]
        )
        result = canonicalize_memorandum_source(source)
        self.assertEqual(len(result.groups), 1)
        self.assertEqual(len(result.groups[0].recommendations), 2)

    def test_find_match_allows_small_typo(self) -> None:
        self.assertEqual(
            find_dictionary_label_match("Оттдел закупок", ["Отдел закупок"]),
            "Отдел закупок",
        )


if __name__ == "__main__":
    unittest.main()
