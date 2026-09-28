# -*- coding: utf-8 -*-
"""Мини-АЗ для проверки импорта рекомендаций и индикаторов по сроку контроля.

Структура как в шаблоне АЗ: титул, содержание, раздел I, наблюдения с рамочками.
ФИО — из справочника аудиторов, подразделения — из справочника департаментов.
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.catalogs.auditors import AUDITORS  # noqa: E402
from app.db.catalogs.departments import DEPARTMENTS  # noqa: E402
from app.db.catalogs.users import DEPARTMENT_HEAD_USERNAME  # noqa: E402

OUTPUT_DIR = PROJECT_ROOT / "data" / "az"
OUTPUT_DOCX = OUTPUT_DIR / "аз_тест_индикаторов.docx"

DEPARTMENT_SAMPLE = [name for name in DEPARTMENTS if name != "Не указан"][:7]
AUDITOR_SAMPLE = list(AUDITORS)
MANAGERS = [DEPARTMENT_HEAD_USERNAME, *AUDITOR_SAMPLE]

# Сегодня в запросе: 28.09.2026. Сроки подобраны вокруг этой даты.
RECOMMENDATIONS = [
    {
        "number": "3.1",
        "observation": "Несвоевременное обновление лимитов кредитования",
        "auditor": AUDITOR_SAMPLE[0],
        "audit_object": DEPARTMENT_SAMPLE[0],
        "manager": MANAGERS[0],
        "text": "Внедрить ежемесячный контроль актуальности лимитов.",
        "deadline": "15.01.2025",
        "expected": "срок прошёл → жёлтые часы + жёлтый колокольчик",
    },
    {
        "number": "3.2",
        "observation": "Неполный регламент обработки инцидентов",
        "auditor": AUDITOR_SAMPLE[1],
        "audit_object": DEPARTMENT_SAMPLE[1],
        "manager": MANAGERS[1],
        "text": "Дополнить регламент обработки инцидентов контрольной процедурой.",
        "deadline": "01.06.2026",
        "expected": "срок прошёл → жёлтые часы + жёлтый колокольчик",
    },
    {
        "number": "3.3",
        "observation": "Отсутствие сверки клиентских данных",
        "auditor": AUDITOR_SAMPLE[2],
        "audit_object": DEPARTMENT_SAMPLE[2],
        "manager": MANAGERS[2],
        "text": "Настроить ежедневную сверку клиентских данных между АБС и CRM.",
        "deadline": "27.09.2026",
        "expected": "срок прошёл → жёлтые часы + жёлтый колокольчик",
    },
    {
        "number": "4.1",
        "observation": "Неактуальные матрицы доступа",
        "auditor": AUDITOR_SAMPLE[3],
        "audit_object": DEPARTMENT_SAMPLE[3],
        "manager": MANAGERS[3],
        "text": "Актуализировать матрицы доступа и утвердить график пересмотра.",
        "deadline": "28.09.2026",
        "expected": "срок наступил → жёлтые часы + жёлтый колокольчик",
    },
    {
        "number": "4.2",
        "observation": "Задержки закрытия периода",
        "auditor": AUDITOR_SAMPLE[4],
        "audit_object": DEPARTMENT_SAMPLE[4],
        "manager": MANAGERS[4],
        "text": "Сократить срок закрытия отчётного периода и зафиксировать контрольные точки.",
        "deadline": "15.10.2026",
        "expected": "срок ещё не наступил → серые песочные часы + серый колокольчик",
    },
    {
        "number": "4.3",
        "observation": "Неполный комплект договорных шаблонов",
        "auditor": AUDITOR_SAMPLE[5],
        "audit_object": DEPARTMENT_SAMPLE[5],
        "manager": MANAGERS[5],
        "text": "Обновить шаблоны договоров и разместить их в корпоративной библиотеке.",
        "deadline": "31.12.2027",
        "expected": "срок ещё не наступил → серые песочные часы + серый колокольчик",
    },
    {
        "number": "4.4",
        "observation": "Неполная сверка остатков на счетах",
        "auditor": AUDITOR_SAMPLE[6],
        "audit_object": DEPARTMENT_SAMPLE[6] if len(DEPARTMENT_SAMPLE) > 6 else DEPARTMENT_SAMPLE[0],
        "manager": MANAGERS[6],
        "text": "Сверить остатки на транзитных счетах и устранить расхождения.",
        "deadline": None,
        "deadline_text": "Срок исполнения — исполнено в ходе аудита",
        "expected": "вместо срока → синяя звезда + зелёный колокольчик",
    },
]


def _style_normal(doc: Document) -> None:
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)
    style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    style.paragraph_format.space_after = Pt(4)


def _font(run, *, size: int = 12, bold: bool = False) -> None:
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.bold = bold
    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.find(qn("w:rFonts"))
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        r_pr.insert(0, r_fonts)
    r_fonts.set(qn("w:ascii"), "Times New Roman")
    r_fonts.set(qn("w:hAnsi"), "Times New Roman")
    r_fonts.set(qn("w:cs"), "Times New Roman")


def _para(doc: Document, text: str = "", *, bold: bool = False, size: int = 12):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    _font(run, size=size, bold=bold)
    return paragraph


def _heading(doc: Document, text: str) -> None:
    _para(doc, text, bold=True, size=14)


def _page_break(doc: Document) -> None:
    paragraph = doc.add_paragraph()
    paragraph.add_run().add_break(WD_BREAK.PAGE)


def _bordered(doc: Document, text: str, *, bold: bool = False):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    _font(run, bold=bold)
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


def _observation_block(doc: Document, item: dict) -> None:
    _para(doc, f"Наблюдение {item['number']}. {item['observation']}")
    _bordered(doc, "Уровень существенности — средний")
    _bordered(doc, f"Аудитор: {item['auditor']}")
    _bordered(doc, f"Объект аудита: {item['audit_object']}")
    _bordered(doc, f"Руководитель объекта аудита: {item['manager']}")
    _bordered(doc, "Аудиторская рекомендация:", bold=True)
    _bordered(doc, item["text"])
    deadline_line = item.get("deadline_text")
    if not deadline_line:
        deadline_line = f"Срок исполнения — до {item['deadline']}"
    _bordered(doc, deadline_line, bold=True)


def build_document() -> Document:
    doc = Document()
    _style_normal(doc)

    _heading(doc, "АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ")
    _para(doc, "Тематическая проверка процессов внутреннего контроля", bold=True, size=14)
    _para(doc, "Департамент внутреннего аудита")
    _page_break(doc)

    _heading(doc, "Содержание")
    _para(doc, "I. Аудиторское мнение по итогам проверки")
    _para(doc, "II. Основные результаты аудита и аудиторские рекомендации")
    _para(doc, "III. Детальные результаты аудита")
    _para(doc, "IV. Финансовая и юридическая отчётность")
    _page_break(doc)

    _heading(doc, "I. Аудиторское мнение по итогам проверки.")
    _para(
        doc,
        "По итогам проверки выявлены недостатки внутреннего контроля. "
        "Рекомендации по устранению приведены в наблюдениях ниже.",
    )

    current_chapter = ""
    for item in RECOMMENDATIONS:
        chapter = item["number"].split(".", 1)[0]
        if chapter != current_chapter:
            current_chapter = chapter
            if chapter == "3":
                _heading(doc, "III. Детальные результаты аудита")
            else:
                _heading(doc, "IV. Финансовая и юридическая отчётность")
        _observation_block(doc, item)
    return doc


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = build_document()
    doc.save(OUTPUT_DOCX)
    print(f"Wrote {OUTPUT_DOCX}")
    for item in RECOMMENDATIONS:
        print(
            f"{item['number']}: {item['audit_object']} / {item['auditor']} / "
            f"{item['manager']} / {item.get('deadline_text') or item.get('deadline')}"
        )


if __name__ == "__main__":
    main()
