# -*- coding: utf-8 -*-
"""Шаблон АЗ + краткие правила для SOKOL (раздел II)."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_RULES = PROJECT_ROOT / "SOKOL_Правила_шаблона_АЗ.docx"
OUTPUT_BLANK = PROJECT_ROOT / "SOKOL_Шаблон_АЗ.docx"


def _style_normal(doc: Document) -> None:
    s = doc.styles["Normal"]
    s.font.name = "Times New Roman"
    s.font.size = Pt(12)
    s.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    s.paragraph_format.space_after = Pt(4)


def _run(p, text: str, *, bold=False, italic=False, size=12):
    r = p.add_run(text)
    r.font.name = "Times New Roman"
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    return r


def _heading(doc, text: str, level: int = 1):
    h = doc.add_heading(text, level=level)
    for r in h.runs:
        r.font.name = "Times New Roman"
        r.font.color.rgb = RGBColor(0, 0, 0)


def _para(doc, text: str = "", bold: bool = False):
    p = doc.add_paragraph()
    _run(p, text, bold=bold)
    return p


def _hint(doc, text: str):
    p = doc.add_paragraph()
    _run(p, text, italic=True, size=11)
    p.paragraph_format.left_indent = Cm(0.5)


def _page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def _section_title(doc, text: str):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(14)


def _bordered(doc, text: str):
    """Рамочка — абзац с границей (так оформляют поля наблюдения в АЗ)."""
    p = doc.add_paragraph(text)
    p_pr = p._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "4")
        b.set(qn("w:space"), "0")
        b.set(qn("w:color"), "auto")
        p_bdr.append(b)
    p_pr.append(p_bdr)
    for r in p.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(12)
    return p


def _observation_block(doc, number: str, name: str):
    """Пример одного наблюдения с рамочками."""
    _para(doc, f"Наблюдение {number}. {name}")
    _bordered(doc, "Уровень существенности — средний")
    _bordered(doc, "Аудитор: Фамилия И.О.")
    _bordered(doc, "Объект аудита: Наименование подразделения")
    _bordered(doc, "Руководитель объекта аудита: Фамилия И.О.")
    _bordered(doc, "Аудиторская рекомендация:")
    _bordered(doc, "Текст рекомендации по устранению нарушения.")
    _bordered(doc, "Срок исполнения — до 31.12.2026")


def _fill_template_body(doc: Document, *, with_hints: bool = False):
    """Основной текст АЗ — эталонная структура."""
    if with_hints:
        _hint(doc, "▼ ШАБЛОН. Скопируйте структуру ниже при подготовке АЗ.")

    _page_break(doc)  # стр. 2 — содержание
    _para(doc, "Содержание", bold=True)
    _para(doc, "I. Аудиторское мнение по итогам проверки")
    _para(doc, "II. Основные результаты аудита и аудиторские рекомендации")
    _para(doc, "III. Детальные результаты аудита")
    _para(doc, "IV. … (название главы)")
    _page_break(doc)  # стр. 3 — основной текст

    _section_title(doc, "I. Аудиторское мнение по итогам проверки.")
    if with_hints:
        _hint(doc, "← SOKOL вставит раздел II сразу после этой строки (заголовок + таблица).")
    _para(doc, "Текст аудиторского мнения…")

    _section_title(doc, "III. Детальные результаты аудита")
    _section_title(doc, "IV. Задачи проведения аудита …")
    _observation_block(doc, "4.1", "Краткое наименование наблюдения")
    _observation_block(doc, "4.2", "Следующее наблюдение")


def _save_doc(doc: Document, path: Path) -> Path:
    tmp = path.with_suffix(".tmp.docx")
    doc.save(tmp)
    try:
        if path.exists():
            path.unlink()
        tmp.replace(path)
        return path
    except OSError:
        fallback = path.with_name(f"{path.stem}_новый{path.suffix}")
        tmp.replace(fallback)
        return fallback


def build_blank_template() -> Path:
    doc = Document()
    _style_normal(doc)
    _para(doc, "АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ", bold=True)
    _para(doc, "(титульный лист — заполните по образцу организации)")
    _fill_template_body(doc, with_hints=False)
    saved = _save_doc(doc, OUTPUT_BLANK)
    print(f"Saved: {saved}")
    return saved


def build_rules_doc() -> Path:
    doc = Document()
    _style_normal(doc)

    p = doc.add_paragraph()
    _run(p, "SOKOL — шаблон и правила оформления АЗ", bold=True, size=16)
    _para(
        doc,
        "Краткая инструкция: как писать аудиторское заключение, чтобы раздел II "
        "сформировался и вставился в нужное место.",
    )

    # --- Шаблон в документе ---
    _heading(doc, "1. Шаблон (структура документа)", 1)
    _fill_template_body(doc, with_hints=True)

    doc.add_paragraph()
    _heading(doc, "2. Порядок разделов", 1)
    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = "Table Grid"
    hdr = tbl.rows[0].cells
    hdr[0].text = "№"
    hdr[1].text = "Как называть"
    hdr[2].text = "Примечание"
    rows = [
        ("I", "Аудиторское мнение по итогам проверки", "Обязателен. Ключевые слова: «Аудиторское мнение»"),
        ("II", "Основные результаты аудита и аудиторские рекомендации", "SOKOL создаёт сам — в исходнике можно не писать"),
        ("III", "Детальные результаты аудита", "Отсюда парсятся наблюдения"),
        ("IV, V…", "Глава / задача аудита (своё название)", "Заголовок главы + наблюдения 4.x, 5.x…"),
    ]
    for num, name, note in rows:
        c = tbl.add_row().cells
        c[0].text = num
        c[1].text = name
        c[2].text = note

    _heading(doc, "3. Ключевые слова (обязательные)", 1)
    kw = doc.add_table(rows=1, cols=2)
    kw.style = "Table Grid"
    kw.rows[0].cells[0].text = "Где"
    kw.rows[0].cells[1].text = "Точная формулировка"
    keywords = [
        ("Заголовок раздела I", "Аудиторское мнение …"),
        ("Каждое наблюдение", "Наблюдение 4.1.  (номер через точку)"),
        ("Рамочка наблюдения", "Уровень существенности — низкий / средний / высокий"),
        ("Рамочка наблюдения", "Аудитор: …"),
        ("Рамочка наблюдения", "Объект аудита: …"),
        ("Рамочка наблюдения", "Руководитель объекта аудита: …"),
        ("Рамочка наблюдения", "Аудиторская рекомендация: …"),
        ("Рамочка наблюдения", "Срок исполнения — до ДД.ММ.ГГГГ"),
    ]
    for where, phrase in keywords:
        r = kw.add_row().cells
        r[0].text = where
        r[1].text = phrase

    _heading(doc, "4. Рамочки — где ставить", 1)
    _para(doc, "После строки «Наблюдение X.Y. Наименование» идут отдельные абзацы с рамкой (границей). Порядок:")
    for i, line in enumerate(
        [
            "Уровень существенности — …",
            "Аудитор: …",
            "Объект аудита: …",
            "Руководитель объекта аудита: …",
            "Аудиторская рекомендация:",
            "Текст рекомендации",
            "Срок исполнения — …",
        ],
        1,
    ):
        _para(doc, f"{i}. {line}")
    _para(doc, "Текст без рамки после блока наблюдения в таблицу не попадает.", bold=True)

    _heading(doc, "5. Краткие правила", 1)
    rules = [
        "Файл — только .docx; стр. 1–2 (титул + содержание) не меняются.",
        "Основной текст — с 3-й страницы (после второго разрыва страницы).",
        "Разделы нумеруйте римскими: I., II., III., IV. — не «3.» вместо «III.».",
        "Раздел II вставляется сразу после заголовка раздела I.",
        "Минимум одно «Наблюдение X.Y.» в тексте — иначе таблица не построится.",
        "Существенность — только: низкий, средний, высокий.",
        "Не подменяйте буквы латиницей (итогам, проверки) — заголовки не распознаются.",
        "Загружайте исходный АЗ, не файл с уже вставленным _section_ii.",
    ]
    for rule in rules:
        p = doc.add_paragraph(rule, style="List Bullet")
        for r in p.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(12)

    _heading(doc, "6. Чеклист", 1)
    for item in [
        "Есть «Аудиторское мнение» в тексте (не только в содержании)",
        "Содержание: пункты I, II, III",
        "Наблюдения: «Наблюдение X.Y.» + рамочки по образцу выше",
        "В каждой рамочке — «Уровень существенности — …»",
        "Раздел II после генерации стоит сразу за заголовком раздела I",
    ]:
        p = doc.add_paragraph()
        _run(p, f"☐  {item}")

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        r.font.name = "Times New Roman"
                        r.font.size = Pt(11)

    saved = _save_doc(doc, OUTPUT_RULES)
    print(f"Saved: {saved}")
    return saved


if __name__ == "__main__":
    build_blank_template()
    build_rules_doc()
