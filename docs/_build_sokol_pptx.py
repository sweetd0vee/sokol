"""Build SOKOL snapshot slide as PPTX from the HTML layout."""
from __future__ import annotations

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

OUT = r"c:\Users\audit\Work\sokol\docs\SOKOL_слайд.pptx"

NAVY = RGBColor(0x00, 0x33, 0x66)
NAVY2 = RGBColor(0x00, 0x26, 0x4D)
ACCENT = RGBColor(0x21, 0xA0, 0x38)
ACCENT_SOFT = RGBColor(0xE8, 0xF6, 0xEA)
ACCENT_TEXT = RGBColor(0x15, 0x7A, 0x28)
LINE = RGBColor(0xD5, 0xDC, 0xE6)
MUTED = RGBColor(0x5B, 0x67, 0x76)
TEXT = RGBColor(0x1A, 0x23, 0x32)
BG = RGBColor(0xF4, 0xF6, 0xF8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CHIP_BG = RGBColor(0xEE, 0xF2, 0xF6)
ROW_LINE = RGBColor(0xED, 0xF1, 0xF5)
SUB = RGBColor(0xC5, 0xD4, 0xE4)
FOOT = RGBColor(0xC2, 0xCD, 0xD8)
FONT = "Segoe UI"


def rgb(c: RGBColor) -> str:
    return f"{c[0]:02X}{c[1]:02X}{c[2]:02X}"


def set_fill(shape, color: RGBColor) -> None:
    shape.fill.solid()
    shape.fill.fore_color.rgb = color


def set_line(shape, color: RGBColor, pt: float = 0.75) -> None:
    shape.line.color.rgb = color
    shape.line.width = Pt(pt)


def no_line(shape) -> None:
    shape.line.fill.background()


def round_adj(shape, value: float) -> None:
    try:
        shape.adjustments[0] = value
    except Exception:
        pass


def font_run(run, size: float, color: RGBColor, bold: bool = False, name: str = FONT) -> None:
    run.font.name = name
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    rPr = run._r.get_or_add_rPr()
    for tag in ("latin", "ea", "cs"):
        el = rPr.find(qn(f"a:{tag}"))
        if el is None:
            el = etree.SubElement(rPr, qn(f"a:{tag}"))
        el.set("typeface", name)


def add_rect(slide, l, t, w, h, fill, line=None, radius=None):
    shape = MSO_SHAPE.ROUNDED_RECTANGLE if radius is not None else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(shape, l, t, w, h)
    set_fill(s, fill)
    if line is None:
        no_line(s)
    else:
        set_line(s, line)
    if radius is not None:
        round_adj(s, radius)
    s.shadow.inherit = False
    return s


def add_tb_emu(slide, l, t, w, h, lines, align=PP_ALIGN.LEFT, anchor="t", ml=0, mt=0, mr=0, mb=0):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Emu(ml)
    tf.margin_top = Emu(mt)
    tf.margin_right = Emu(mr)
    tf.margin_bottom = Emu(mb)
    tf._txBody.bodyPr.set("anchor", anchor)

    first = True
    for text, size, color, bold in lines:
        parts = text.split("\n")
        for part in parts:
            if first:
                p = tf.paragraphs[0]
                first = False
            else:
                p = tf.add_paragraph()
            p.alignment = align
            p.space_before = Pt(0)
            p.space_after = Pt(0)
            run = p.add_run()
            run.text = part
            font_run(run, size, color, bold)
    return box


def chip_w(text: str, size: float = 10) -> int:
    return int((len(text) * size * 7200) + Inches(0.16))


def place_chips(slide, x, y, max_w, chips, h=Inches(0.24), gap=Inches(0.07), row_gap=Inches(0.07)):
    cx, cy = x, y
    for text, bg, fg in chips:
        w = chip_w(text, 9)
        if cx > x and cx + w > x + max_w:
            cx = x
            cy += h + row_gap
        s = add_rect(slide, cx, cy, w, h, bg, radius=0.18)
        tf = s.text_frame
        tf.word_wrap = False
        tf.margin_left = Emu(0)
        tf.margin_right = Emu(0)
        tf.margin_top = Emu(0)
        tf.margin_bottom = Emu(0)
        tf._txBody.bodyPr.set("anchor", "ctr")
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.space_before = Pt(0)
        p.space_after = Pt(0)
        run = p.add_run()
        run.text = text
        font_run(run, 9, fg, True)
        cx += w + gap
    return cy + h


def ln_xml(tag, color: RGBColor | None, w_emu: int):
    if color is None or w_emu == 0:
        return etree.fromstring(
            f'<{tag} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" w="0">'
            f"<a:noFill/></{tag}>"
        )
    return etree.fromstring(
        f'<{tag} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" w="{w_emu}">'
        f'<a:solidFill><a:srgbClr val="{rgb(color)}"/></a:solidFill>'
        f"<a:prstDash val=\"solid\"/></{tag}>"
    )


def style_cell(cell, fill: RGBColor | None, border_bottom: RGBColor | None, font_size, font_color, bold, align_right=False, pad_top=40000, pad_bot=40000):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag.endswith(("}lnL", "}lnR", "}lnT", "}lnB", "}solidFill", "}marL")):
            tcPr.remove(child)
    if fill is not None:
        sfill = etree.SubElement(tcPr, qn("a:solidFill"))
        srgb = etree.SubElement(sfill, qn("a:srgbClr"))
        srgb.set("val", rgb(fill))
    for tag, col, w in (
        ("a:lnL", None, 0),
        ("a:lnR", None, 0),
        ("a:lnT", None, 0),
        ("a:lnB", border_bottom, 6350 if border_bottom else 0),
    ):
        tcPr.append(ln_xml(tag, col, w))
    for m, v in (("marL", 0), ("marR", 0), ("marT", pad_top), ("marB", pad_bot)):
        tcPr.set(qn(f"a:{m}"), str(v))

    for p in cell.text_frame.paragraphs:
        p.alignment = PP_ALIGN.RIGHT if align_right else PP_ALIGN.LEFT
        p.space_before = Pt(0)
        p.space_after = Pt(0)
        for run in p.runs:
            font_run(run, font_size, font_color, bold)


def add_dl(slide, x, y, w, rows, dt_w: int, row_h: int):
    cy = y
    for dt, dd in rows:
        add_tb_emu(
            slide, x, cy, dt_w, row_h,
            [(dt, 10.5, MUTED, True)],
            anchor="t",
        )
        add_tb_emu(
            slide, x + dt_w, cy, w - dt_w, row_h,
            [(dd, 10.5, TEXT, False)],
            anchor="t",
        )
        lines = 1 + dd.count("\n")
        cy += int(row_h * (0.72 + 0.28 * lines)) if "\n" in dd else row_h
    return cy


def main() -> None:
    prs = Presentation()
    prs.slide_width = Inches(13.333333)
    prs.slide_height = Inches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    W = prs.slide_width
    H = prs.slide_height
    MX = Inches(0.38)

    add_rect(slide, 0, 0, W, H, BG)

    hdr_h = Inches(0.92)
    add_rect(slide, 0, 0, W, hdr_h, NAVY)
    add_tb_emu(
        slide, MX, Inches(0.16), Inches(9.4), Inches(0.42),
        [("SOKOL — снимок проекта", 24, WHITE, True)],
        anchor="b",
    )
    add_tb_emu(
        slide, MX, Inches(0.56), Inches(9.6), Inches(0.30),
        [("Внутренний инструмент аудита: проверки, рекомендации, аналитика, документы", 12, SUB, False)],
        anchor="t",
    )
    add_tb_emu(
        slide, Inches(10.35), Inches(0.22), Inches(2.6), Inches(0.55),
        [("Сводка по репозиторию\n04.09.2026", 11, SUB, False)],
        align=PP_ALIGN.RIGHT,
        anchor="ctr",
    )

    kpi_y = Inches(1.04)
    kpi_h = Inches(0.86)
    gap = Inches(0.12)
    inner = W - MX * 2
    kpi_n = 5
    kpi_w = int((inner - gap * (kpi_n - 1)) / kpi_n)
    kpis = [
        ("30,7 тыс.", "строк frontend\nsrc: TS / TSX / CSS"),
        ("20,3 тыс.", "строк backend\napp + скрипты Python"),
        ("60", "HTTP-эндпоинтов\nprefix /api/v1"),
        ("4", "Docker-контейнера\nPostgres · MinIO · API · UI"),
        ("10", "таблиц PostgreSQL 16\nфайлы — MinIO (S3)"),
    ]
    x = MX
    for n, lab in kpis:
        add_rect(slide, x, kpi_y, kpi_w, kpi_h, WHITE, LINE, radius=0.08)
        add_tb_emu(
            slide, x + Inches(0.12), kpi_y + Inches(0.08), kpi_w - Inches(0.20), Inches(0.36),
            [(n, 20, NAVY, True)],
            anchor="b",
        )
        add_tb_emu(
            slide, x + Inches(0.12), kpi_y + Inches(0.44), kpi_w - Inches(0.20), Inches(0.38),
            [(lab, 9, MUTED, False)],
            anchor="t",
        )
        x += kpi_w + gap

    col_y = Inches(2.02)
    col_h = Inches(5.02)
    ratios = (1.15, 0.95, 1.05)
    col_gap = Inches(0.14)
    usable = inner - col_gap * 2
    col_ws = [int(usable * r / sum(ratios)) for r in ratios]
    col_ws[-1] = int(usable - sum(col_ws[:-1]))
    xs = [MX]
    for i in range(2):
        xs.append(xs[-1] + col_ws[i] + col_gap)

    pad = Inches(0.16)
    titles = ("СТЕК", "ИНФРАСТРУКТУРА", "API /api/v1 — 60 ЭНДПОИНТОВ")

    for i in range(3):
        add_rect(slide, xs[i], col_y, col_ws[i], col_h, WHITE, LINE, radius=0.06)
        add_tb_emu(
            slide, xs[i] + pad, col_y + Inches(0.12), col_ws[i] - pad * 2, Inches(0.26),
            [(titles[i], 11, NAVY, True)],
            anchor="ctr",
        )

    c1x, c1w = xs[0] + pad, col_ws[0] - pad * 2
    chip_y = col_y + Inches(0.42)
    fe = [("Frontend", ACCENT_SOFT, ACCENT_TEXT)] + [
        (t, CHIP_BG, NAVY)
        for t in ("React 19", "Vite 7", "TypeScript", "Tailwind", "TanStack Query 5", "React Router 7", "Axios", "Recharts")
    ]
    be = [("Backend", ACCENT_SOFT, ACCENT_TEXT)] + [
        (t, CHIP_BG, NAVY)
        for t in ("Python 3.12", "FastAPI", "SQLAlchemy 2", "asyncpg", "Pydantic", "Uvicorn", "PyJWT", "python-docx", "openpyxl")
    ]
    y = place_chips(slide, c1x, chip_y, c1w, fe)
    y = place_chips(slide, c1x, y + Inches(0.10), c1w, be)

    dl1 = [
        ("Auth", "JWT + RBAC: auditor / department_head / admin"),
        ("Отчёты", "Раздел II АЗ, докладная, файл контроля, parse-recommendations"),
        ("Аналитика", "5 дашбордов на SQL-агрегатах, конструктор, планирование"),
        ("CI", "GitHub Actions: Backend (Py 3.12) и Frontend (Node 22)"),
    ]
    y = add_dl(slide, c1x, y + Inches(0.14), c1w, dl1, Inches(1.12), Inches(0.34))
    add_tb_emu(
        slide, c1x, y + Inches(0.06), c1w, Inches(0.70),
        [(
            "Frontend: 30 722 строк (197 файлов) + 3 440 тесты (Vitest, Playwright).\n"
            "Backend: 20 340 строк (204 файла) + 5 296 тесты (32 unittest). 14 маршрутов UI.",
            10, MUTED, False
        )],
        anchor="t",
    )

    c2x, c2w = xs[1] + pad, col_ws[1] - pad * 2
    dl2 = [
        ("Контейнеры", "db (Postgres 16) · minio · api · ui"),
        ("БД", "PostgreSQL 16, хост-порт 5433, БД sokol_db"),
        ("Файлы", "MinIO S3, порты 9000 / 9001"),
        ("Раскладка", "бакет check-{serial} на проверку; метаданные в attachments"),
        ("UI / API", "5180 · Docker API 8800 · локально 8802"),
        ("Тома", "~/docker-share/postgres-data-sokol\n~/docker-share/minio-data-sokol"),
        ("Таблицы", "checks, recommendations, junction, attachments, 5 справочников, users"),
    ]
    add_dl(slide, c2x, col_y + Inches(0.44), c2w, dl2, Inches(1.22), Inches(0.50))

    c3x, c3w = xs[2] + pad, col_ws[2] - pad * 2
    rows_data = [
        ("Модуль", "шт.", True),
        ("Health (status, capabilities)", "2", False),
        ("Auth (login, me, пароль)", "3", False),
        ("Users", "2", False),
        ("Checks CRUD", "5", False),
        ("Recommendations + batch", "7", False),
        ("Analytics (5 дашбордов)", "5", False),
        ("Attachments / MinIO", "5", False),
        ("Tools (DOCX / XLSX)", "6", False),
        ("Settings, 5 справочников × CRUD", "25", False),
        ("Итого", "60", True),
    ]
    nrows = len(rows_data)
    tbl_h = Inches(3.22)
    table_shape = slide.shapes.add_table(nrows, 2, c3x, col_y + Inches(0.42), c3w, tbl_h)
    table = table_shape.table
    table.columns[0].width = int(c3w * 0.82)
    table.columns[1].width = int(c3w * 0.18)

    tbl = table._tbl
    tblPr = tbl.tblPr
    for child in list(tblPr):
        if "tblStyle" in child.tag or "tblLook" in child.tag:
            tblPr.remove(child)

    for i, (mod, n, is_head_or_total) in enumerate(rows_data):
        cell0 = table.cell(i, 0)
        cell1 = table.cell(i, 1)
        cell0.text = mod
        cell1.text = n
        is_header = i == 0
        is_total = i == nrows - 1
        size = 9 if is_header else 11
        color = MUTED if is_header else (NAVY if is_total else TEXT)
        bold = is_header or is_total
        border = None if is_total else ROW_LINE
        style_cell(cell0, WHITE, border, size, color, bold, False, 35000, 35000)
        style_cell(cell1, WHITE, border, size, color, bold, True, 35000, 35000)

    bullets = [
        "Публичны: /, /status, /capabilities, POST /auth/login",
        "Остальное — Bearer JWT; роль из БД, не из токена",
        "Нет: OIDC, Alembic, WebSocket",
    ]
    by = col_y + Inches(0.42) + tbl_h + Inches(0.12)
    for b in bullets:
        dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, c3x, by + Inches(0.07), Inches(0.07), Inches(0.07))
        set_fill(dot, ACCENT)
        no_line(dot)
        add_tb_emu(
            slide, c3x + Inches(0.16), by, c3w - Inches(0.16), Inches(0.28),
            [(b, 10.5, TEXT, False)],
            anchor="ctr",
        )
        by += Inches(0.28)

    foot_h = Inches(0.38)
    foot_y = H - foot_h
    add_rect(slide, 0, foot_y, W, foot_h, NAVY2)
    add_tb_emu(
        slide, MX, foot_y, Inches(5.6), foot_h,
        [("Репозиторий sokol · React UI + FastAPI + PostgreSQL + MinIO", 10, FOOT, False)],
        anchor="ctr",
    )
    add_tb_emu(
        slide, Inches(6.2), foot_y, Inches(6.75), foot_h,
        [("Источник: docs/, docker-compose.yml, подсчёт LOC 04.09.2026 (без node_modules / venv / Streamlit)", 9.5, FOOT, False)],
        align=PP_ALIGN.RIGHT,
        anchor="ctr",
    )

    prs.core_properties.title = "SOKOL — снимок проекта"
    prs.core_properties.subject = "Сводка по репозиторию 04.09.2026"
    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
