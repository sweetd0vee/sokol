"""Generate docs/SOKOL_Backlog_sprint.pptx — 3-slide sprint backlog deck."""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

NAVY = RGBColor(0x00, 0x33, 0x66)
ACCENT = RGBColor(0x66, 0x99, 0xFF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
INK = RGBColor(0x1F, 0x29, 0x37)
MUTED = RGBColor(0x4B, 0x55, 0x63)
CARD_BORDER = RGBColor(0xD1, 0xD5, 0xDB)
PAGE_BG = RGBColor(0xF5, 0xF5, 0xF5)
CHIP_BG = RGBColor(0xE8, 0xEE, 0xF6)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

ITEMS_LEFT = [
    (
        "01",
        "Авторасчёт индикатора рекомендации",
        "Индикатор статуса и доп. индикатор считаются автоматически по правилам "
        "(статус → индикатор). Значение «исполнено в ходе аудита» — отдельный "
        "корректный исход, без ручных рассинхронов с полем статуса.",
    ),
    (
        "02",
        "Срок «исполнено в ходе аудита»",
        "Добавить поле срока / даты исполнения в ходе аудита: форма рекомендации, "
        "API и БД, список, аналитика и все форматы экспорта.",
    ),
    (
        "03",
        "Страница планирования — концепция",
        "Зафиксировать продуктовую модель: охват департаментов, план/факт, "
        "красные рекомендации, фильтры периода и KPI. Сейчас раздел ограничен, "
        "экспорт выключен.",
    ),
    (
        "04",
        "Страница планирования — дашборды",
        "Реализовать полноценные карточки: охват подразделений, аналитика "
        "департаментов, рейтинг высокой существенности. Не beta-заглушка.",
    ),
    (
        "05",
        "Дашборды аналитики",
        "Довести вкладки «Проверки» и «Рекомендации»: согласованные KPI, серии, "
        "легенды, пустые состояния и отбор секций для экспорта.",
    ),
    (
        "06",
        "Палитра вкладки «Рекомендации»",
        "Единые цвета статусов, существенности и индикаторов в таблице, форме, "
        "бейджах и иконках. Совпадение с корпоративной гаммой navy / accent.",
    ),
]

ITEMS_RIGHT = [
    (
        "07",
        "Палитра дашбордов аналитики",
        "Корпоративная шкала на графиках и treemap вместо случайной радуги. "
        "Интенсивность цвета передаёт величину, соседние сегменты читаемы.",
    ),
    (
        "08",
        "Палитра вкладки «Мониторинг»",
        "Привести динамику сроков, статусы и срок исполнения к той же палитре "
        "и контрастам, что на рекомендациях и дашбордах.",
    ),
    (
        "09",
        "Вкладка «ДВА» — полная проработка",
        "KPI, портфель, нагрузка аудиторов, документы и закрытие, карты "
        "аудиторов: метрики, визуал, фильтры и экспорт как законченный контур.",
    ),
    (
        "10",
        "MinIO на backend + тесты",
        "Рабочий контур вложений: бакеты check-*, upload / download / delete, "
        "GET storage/status. Интеграционные тесты и негативные сценарии "
        "(хранилище выключено / недоступно).",
    ),
    (
        "11",
        "Ревизия экспортов",
        "Прогнать XLSX / PDF / HTML таблиц и визуальный экспорт всех вкладок "
        "аналитики. Починить иконки индикаторов, цвета и отбор секций.",
    ),
    (
        "12",
        "Экспорт планирования и smoke вложений",
        "Включить экспорт планирования по образцу аналитики. Сквозной сценарий: "
        "проверка → файл в MinIO → скачивание → удаление; баннер, если "
        "хранилище недоступно.",
    ),
]


def _set_run(run, text: str, size: int, color: RGBColor, bold: bool = False) -> None:
    run.text = text
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.name = "Calibri"
    run.font.italic = False


def _fill(shape, color: RGBColor) -> None:
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def _line(shape, color: RGBColor, pt: float = 1.0) -> None:
    shape.line.color.rgb = color
    shape.line.width = Pt(pt)


def _disable_shadow(shape) -> None:
    sp_pr = shape._element.spPr
    ns_a = "http://schemas.openxmlformats.org/drawingml/2006/main"
    for child in list(sp_pr):
        if child.tag == f"{{{ns_a}}}effectLst":
            sp_pr.remove(child)


def add_rect(slide, left, top, width, height, fill: RGBColor, line: RGBColor | None = None):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    _fill(shape, fill)
    if line is None:
        shape.line.fill.background()
    else:
        _line(shape, line, 1.0)
    _disable_shadow(shape)
    return shape


def add_round(slide, left, top, width, height, fill: RGBColor, line: RGBColor | None = None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    _fill(shape, fill)
    if line is None:
        shape.line.fill.background()
    else:
        _line(shape, line, 1.0)
    # tighter corners
    try:
        shape.adjustments[0] = 0.08
    except Exception:
        pass
    _disable_shadow(shape)
    return shape


def add_textbox(
    slide,
    left,
    top,
    width,
    height,
    text: str,
    size: int,
    color: RGBColor,
    bold: bool = False,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    try:
        tf._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor])
    except Exception:
        pass
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_before = Pt(0)
    p.space_after = Pt(0)
    _set_run(p.add_run() if p.runs else p.runs[0] if False else _ensure_run(p), text, size, color, bold)
    return box


def _ensure_run(paragraph):
    if paragraph.runs:
        return paragraph.runs[0]
    return paragraph.add_run()


def set_single_para(shape, text, size, color, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tf = shape.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Inches(0.12)
    tf.margin_right = Inches(0.12)
    tf.margin_top = Inches(0.08)
    tf.margin_bottom = Inches(0.08)
    try:
        tf._txBody.bodyPr.set(
            "anchor",
            {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor],
        )
    except Exception:
        pass
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_before = Pt(0)
    p.space_after = Pt(0)
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], text, size, color, bold)
    return tf


def add_card(slide, left, top, width, height, number: str, title: str, body: str) -> None:
    card = add_round(slide, left, top, width, height, WHITE, CARD_BORDER)
    # left accent bar
    bar = add_rect(slide, left, top, Inches(0.07), height, NAVY)
    # number
    num = slide.shapes.add_textbox(left + Inches(0.18), top + Inches(0.10), Inches(0.55), Inches(0.32))
    tf = num.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], number, 16, ACCENT, True)

    title_box = slide.shapes.add_textbox(
        left + Inches(0.70), top + Inches(0.10), width - Inches(0.88), Inches(0.36)
    )
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], title, 14, NAVY, True)

    body_box = slide.shapes.add_textbox(
        left + Inches(0.18), top + Inches(0.48), width - Inches(0.36), height - Inches(0.58)
    )
    tf = body_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], body, 12, MUTED, False)
    _ = card
    _ = bar


def add_header_bar(slide, kicker: str, title: str, right: str) -> None:
    add_rect(slide, 0, 0, SLIDE_W, Inches(0.92), NAVY)
    add_rect(slide, 0, Inches(0.92), SLIDE_W, Inches(0.06), ACCENT)

    k = slide.shapes.add_textbox(Inches(0.40), Inches(0.10), Inches(8.5), Inches(0.28))
    p = k.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], kicker, 11, ACCENT, True)

    t = slide.shapes.add_textbox(Inches(0.40), Inches(0.34), Inches(9.4), Inches(0.48))
    p = t.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], title, 24, WHITE, True)

    r = slide.shapes.add_textbox(Inches(9.9), Inches(0.30), Inches(3.05), Inches(0.42))
    p = r.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], right, 12, WHITE, False)


def add_footer(slide, page: str) -> None:
    add_rect(slide, 0, Inches(7.22), SLIDE_W, Inches(0.28), NAVY)
    left = slide.shapes.add_textbox(Inches(0.40), Inches(7.24), Inches(10.2), Inches(0.24))
    p = left.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "SOKOL  ·  бэклог ближайшего спринта  ·  12 пунктов к реализации", 10, WHITE, False)
    right = slide.shapes.add_textbox(Inches(11.4), Inches(7.24), Inches(1.55), Inches(0.24))
    p = right.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], page, 10, WHITE, False)


def add_chip(slide, left, top, width, height, text: str) -> None:
    chip = add_round(slide, left, top, width, height, CHIP_BG, None)
    try:
        chip.adjustments[0] = 0.5
    except Exception:
        pass
    tf = chip.text_frame
    tf.word_wrap = False
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    try:
        tf._txBody.bodyPr.set("anchor", "ctr")
    except Exception:
        pass
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], text, 12, NAVY, True)


def paint_page_bg(slide) -> None:
    add_rect(slide, 0, 0, SLIDE_W, SLIDE_H, PAGE_BG)


def add_item_grid(slide, items: list[tuple[str, str, str]]) -> None:
    col_w = Inches(6.22)
    row_h = Inches(1.88)
    gap_x = Inches(0.22)
    gap_y = Inches(0.12)
    origin_x = Inches(0.35)
    origin_y = Inches(1.16)
    for i, (number, title, body) in enumerate(items):
        col = i % 2
        row = i // 2
        left = origin_x + col * (col_w + gap_x)
        top = origin_y + row * (row_h + gap_y)
        add_card(slide, left, top, col_w, row_h, number, title, body)


def build_title_slide(prs: Presentation) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    paint_page_bg(slide)
    add_rect(slide, 0, 0, Inches(4.35), SLIDE_H, NAVY)
    add_rect(slide, Inches(4.35), 0, Inches(0.10), SLIDE_H, ACCENT)

    brand = slide.shapes.add_textbox(Inches(0.45), Inches(0.55), Inches(3.5), Inches(0.40))
    p = brand.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "SOKOL", 28, WHITE, True)

    kicker = slide.shapes.add_textbox(Inches(0.45), Inches(2.15), Inches(3.5), Inches(0.32))
    p = kicker.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "БЛИЖАЙШИЙ СПРИНТ", 12, ACCENT, True)

    title = slide.shapes.add_textbox(Inches(0.45), Inches(2.50), Inches(3.55), Inches(1.70))
    tf = title.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "Бэклог развития продукта", 28, WHITE, True)

    sub = slide.shapes.add_textbox(Inches(0.45), Inches(4.35), Inches(3.5), Inches(1.4))
    tf = sub.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(
        p.runs[0],
        "12 пунктов: рекомендации, планирование, дашборды, вкладка ДВА, MinIO и экспорты.",
        14,
        RGBColor(0xC5, 0xD4, 0xE8),
        False,
    )

    # Right content
    h = slide.shapes.add_textbox(Inches(4.90), Inches(0.50), Inches(7.9), Inches(0.45))
    p = h.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "Фокус спринта", 22, NAVY, True)

    lead = slide.shapes.add_textbox(Inches(4.90), Inches(0.95), Inches(7.9), Inches(0.70))
    tf = lead.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(
        p.runs[0],
        "Закрыть продуктовую целостность контура: индикаторы рекомендаций считаются по правилам, "
        "планирование и аналитика — рабочие дашборды, файлы живут в MinIO, экспорты проходят проверку.",
        14,
        MUTED,
        False,
    )

    themes = [
        ("Рекомендации", "Авторасчёт индикатора и срок «исполнено в ходе аудита»."),
        ("Планирование", "Концепция страницы и полноценные дашборды, не ограниченный beta."),
        ("Аналитика", "Дашборды, вкладка ДВА, мониторинг и единая цветовая палитра."),
        ("Платформа", "MinIO на backend с тестами и ревизия всех экспортов."),
    ]
    y = Inches(1.80)
    for name, desc in themes:
        add_round(slide, Inches(4.90), y, Inches(7.85), Inches(1.10), WHITE, CARD_BORDER)
        add_rect(slide, Inches(4.90), y, Inches(0.08), Inches(1.10), ACCENT)
        nbox = slide.shapes.add_textbox(Inches(5.20), y + Inches(0.16), Inches(7.3), Inches(0.36))
        p = nbox.text_frame.paragraphs[0]
        if not p.runs:
            p.add_run()
        _set_run(p.runs[0], name, 16, NAVY, True)
        dbox = slide.shapes.add_textbox(Inches(5.20), y + Inches(0.52), Inches(7.3), Inches(0.44))
        tf = dbox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        if not p.runs:
            p.add_run()
        _set_run(p.runs[0], desc, 13, MUTED, False)
        y += Inches(1.22)

    add_rect(slide, 0, Inches(7.22), SLIDE_W, Inches(0.28), NAVY)
    f = slide.shapes.add_textbox(Inches(0.45), Inches(7.24), Inches(8.5), Inches(0.24))
    p = f.text_frame.paragraphs[0]
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "Внутренняя презентация  ·  развитие продукта", 10, WHITE, False)
    f2 = slide.shapes.add_textbox(Inches(11.4), Inches(7.24), Inches(1.55), Inches(0.24))
    p = f2.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    if not p.runs:
        p.add_run()
    _set_run(p.runs[0], "1 / 3", 10, WHITE, False)


def build_items_slide(
    prs: Presentation,
    kicker: str,
    title: str,
    items: list[tuple[str, str, str]],
    page: str,
) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    paint_page_bg(slide)
    add_header_bar(slide, kicker, title, "12 пунктов")
    add_item_grid(slide, items)
    add_footer(slide, page)


def main() -> None:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    build_title_slide(prs)
    build_items_slide(
        prs,
        "БЭКЛОГ  ·  ЧАСТЬ 1",
        "Рекомендации, планирование, дашборды",
        ITEMS_LEFT,
        "2 / 3",
    )
    build_items_slide(
        prs,
        "БЭКЛОГ  ·  ЧАСТЬ 2",
        "Мониторинг, ДВА, MinIO и экспорты",
        ITEMS_RIGHT,
        "3 / 3",
    )

    out = Path(__file__).resolve().parent / "SOKOL_Backlog_sprint.pptx"
    prs.save(out)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
