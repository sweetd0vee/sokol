# -*- coding: utf-8 -*-
"""
Сложные тестовые АЗ для ручной прогонки парсинга / генерации Раздела II.

Выход: az/тесты_парсинга_раздел_ii/*.docx + README.md
Запуск из корня репозитория или из sokol-backend:
  python scripts/generate_az_parser_stress_cases.py
"""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = PROJECT_ROOT / "az" / "тесты_парсинга_раздел_ii"


def _font(run, *, name="Times New Roman", size=12, bold=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    r = run._element
    r_pr = r.get_or_add_rPr()
    r_fonts = r_pr.find(qn("w:rFonts"))
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        r_pr.insert(0, r_fonts)
    r_fonts.set(qn("w:ascii"), name)
    r_fonts.set(qn("w:hAnsi"), name)
    r_fonts.set(qn("w:cs"), name)


def _p(doc, text="", *, bold=False, size=12, font="Times New Roman", color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    _font(run, name=font, size=size, bold=bold, color=color)
    return p


def _heading(doc, text, *, bold=True, size=14, font="Times New Roman"):
    return _p(doc, text, bold=bold, size=size, font=font)


def _page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def _bordered(doc, text, *, font="Times New Roman", size=12, bold=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    _font(run, name=font, size=size, bold=bold)
    p_pr = p._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        border = OxmlElement(f"w:{side}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), "auto")
        p_bdr.append(border)
    p_pr.append(p_bdr)
    return p


def _bordered_mixed_runs(doc, fragments: list[tuple[str, bool]]):
    """Рамочка из нескольких run (пробелы/bold на стыках — частый источник багов)."""
    p = doc.add_paragraph()
    for text, bold in fragments:
        run = p.add_run(text)
        _font(run, bold=bold)
    p_pr = p._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        border = OxmlElement(f"w:{side}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "4")
        border.set(qn("w:space"), "0")
        border.set(qn("w:color"), "auto")
        p_bdr.append(border)
    p_pr.append(p_bdr)
    return p


def _toc_skeleton(doc, chapters: list[str]):
    _p(doc, "Содержание", bold=True, size=14)
    for line in chapters:
        _p(doc, line)
    _page_break(doc)


def _title_page(doc, title: str):
    _p(doc, "АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ", bold=True, size=16)
    _p(doc, title, bold=True, size=13)
    _p(doc, "Банк / процесс: тестовый стенд SOKOL")
    _p(doc, "Период аудита: I–IV кварталы 2025–2026")
    _page_break(doc)


def _opinion(doc, *, font="Times New Roman"):
    _heading(doc, "I. Аудиторское мнение по итогам проверки.", font=font)
    _p(
        doc,
        "По результатам аудита система внутреннего контроля в целом признана "
        "достаточной. Ниже — детальные наблюдения по разделам.",
        font=font,
    )


def _frame_rec(
    doc,
    *,
    materiality: str | None = "средний",
    auditor: str | None = "Каминская В.В.",
    obj: str | None = "Департамент развития транзакционного бизнеса",
    head: str | None = "Филианова О.В.",
    label: str = "Аудиторская рекомендация:",
    body: str | list[str] = "Обеспечить устранение выявленного нарушения.",
    deadlines: list[str] | None = None,
    font: str = "Times New Roman",
    skip_label: bool = False,
):
    if materiality is not None:
        _bordered(doc, f"Уровень существенности: {materiality}", font=font)
    if auditor is not None:
        _bordered(doc, f"\tАудитор: {auditor}", font=font)
    if obj is not None:
        _bordered(doc, f"          Объект аудита: {obj}", font=font)
    if head is not None:
        _bordered(doc, f"Руководитель объекта аудита: {head}", font=font)
    if not skip_label:
        _bordered(doc, label, font=font, bold=True)
    if isinstance(body, str):
        body = [body]
    for line in body:
        _bordered(doc, line, font=font)
    for d in deadlines or ["Срок – 01.05.2026."]:
        _bordered(doc, d, font=font, bold=True)


# ---------------------------------------------------------------------------
# Кейсы
# ---------------------------------------------------------------------------

def case_01_quarters_and_chapter_order():
    """Квартальные «I Q 2026» в таблице + III без bold + TOC с IV раньше III."""
    doc = Document()
    _title_page(doc, "01 — кварталы / порядок III→IV / TOC ложный")
    _toc_skeleton(
        doc,
        [
            "I.\tАудиторское мнение",
            "II.\tОсновные результаты",
            "IV.\tАнализ организации работы",
            "III.\tСоблюдение стратегических целей",
            "V.\tАнализ доходности",
        ],
    )
    _opinion(doc)
    # III без bold — типичный сбой старта парсинга
    _p(doc, "III. Соблюдение стратегических целей и установленных Банком показателей.")
    t3 = doc.add_table(rows=1, cols=2)
    t3.cell(0, 0).text = "Наблюдение 3.3.1."
    t3.cell(0, 1).text = (
        "Недостаточная формализация нормативов нагрузки менеджеров клиентского сервиса."
    )
    _frame_rec(
        doc,
        materiality="средний",
        body="Рекомендация именно из раздела три — не путать с IV.",
        deadlines=["Срок – 01.05.2026."],
    )

    _heading(doc, "IV. Анализ организации работы по привлечению клиентов.")
    t4a = doc.add_table(rows=1, cols=2)
    t4a.cell(0, 0).text = "Наблюдение 4.1.1."
    t4a.cell(0, 1).text = "Первое наблюдение раздела четыре (до квартальной таблицы)."
    _frame_rec(
        doc,
        materiality="высокий",
        obj="ДСККБ",
        body="Рек 4.1.1 — должна идти после 3.3.1.",
        deadlines=["Срок – 02.05.2026."],
    )

    # Ложные «заголовки» I–IV внутри кварталов
    quarter = doc.add_table(rows=1, cols=5)
    for idx, label in enumerate(
        ["I Q 2026", "II Q 2025", "III Q 2025", "IV Q 2025", "I Q 2025"]
    ):
        cell = quarter.cell(0, idx)
        cell.text = ""
        run = cell.paragraphs[0].add_run(label)
        _font(run, bold=True, size=14)

    t4b = doc.add_table(rows=1, cols=2)
    t4b.cell(0, 0).text = "Наблюдение 4.1.2."
    t4b.cell(0, 1).text = "Второе наблюдение раздела четыре (после кварталов)."
    _frame_rec(
        doc,
        materiality="низкий",
        body="Рек 4.1.2 — не должна «съехать» из‑за I Q 2026.",
        deadlines=["Срок – 03.05.2026."],
    )
    return doc, "01_кварталы_TOC_III_без_bold.docx", [
        "Ожидаемый порядок: 3.3.1 → 4.1.1 → 4.1.2",
        "Глава III раньше IV в таблице раздела II",
        "Текст рек 3.3.1 содержит «именно из раздела три»",
        "Кварталы I Q / II Q не ломают старт и не создают ложных глав",
    ]


def case_02_number_formats_and_deadlines():
    """Разные форматы номера, сроков, меток рекомендации, отсутствие существенности."""
    doc = Document()
    _title_page(doc, "02 — форматы номера / сроки / метки")
    _toc_skeleton(
        doc,
        [
            "I. Аудиторское мнение",
            "II. Основные результаты",
            "III. Детальные результаты аудита",
        ],
    )
    _opinion(doc)
    _heading(doc, "III. Детальные результаты аудита")

    _p(doc, "Наблюдение № 3.1: Контроль сроков исполнения заявок")
    _frame_rec(
        doc,
        materiality="Средний",
        label="Аудиторская рекомендация:",
        body="Настроить контроль сроков исполнения заявок (слово «сроков» в тексте рек).",
        deadlines=["Срок исполнения: до 01.04.2026."],
    )

    _p(doc, "Наблюдение 3.2) Недостатки мониторинга статусов")
    _bordered(doc, "Уровень существенности: высокий")
    _bordered(doc, "Рекомендация — внедрить мониторинг статусов заявок.")
    _bordered(doc, "Срок: с 01.02.2026 по 01.03.2026.")

    _p(doc, "Наблюдение No. 3.3 — Первый контроль без уровня существенности")
    _bordered(doc, "Аудиторская рекомендация: Усилить контроль. См. также Наблюдение 4.1.1 в следующем разделе.")
    _bordered(doc, "Срок реализации: до 02.04.2026.")

    _p(doc, "Наблюдение N 3.4: Мероприятия вместо рекомендации")
    _bordered(doc, "Мероприятия после аудита: Назначить ответственного за контроль.")
    _bordered(doc, "Срок выполнения: 03.04.26.")

    _heading(doc, "IV Контроль отчетности")  # без точки после IV
    _p(doc, "Наблюдение 4.1.1. Контроль отчётности (трёхчастный номер)")
    _frame_rec(
        doc,
        materiality="средний",
        body="Исправить отчётность.",
        deadlines=["Срок – 15.05.2026 г."],
    )
    return doc, "02_форматы_номеров_сроков_меток.docx", [
        "5 наблюдений: 3.1, 3.2, 3.3, 3.4, 4.1.1",
        "3.1: существенность средний, срок 01.04.2026",
        "3.2: интервал «с 01.02.2026 по 01.03.2026»",
        "3.3: существенность «не указан»; кросс-ссылка на 4.1.1 не создаёт лишнего наблюдения",
        "3.4: метка «Мероприятия после аудита», срок 03.04.26",
        "4.1.1: chapter_title «Контроль отчетности» (IV без точки)",
    ]


def case_03_frames_vs_following_text():
    """Рамки, текст после рамки, несколько сроков, склейка run, метка в середине строки."""
    doc = Document()
    _title_page(doc, "03 — рамки / хвосты / split runs")
    _toc_skeleton(doc, ["I. Мнение", "II. Результаты", "III. Детали"])
    _opinion(doc)
    _heading(doc, "III. Детальные результаты аудита")

    _p(doc, "Наблюдение № 3.1: Контроль границы рамки")
    _frame_rec(
        doc,
        body="Обеспечить контроль поиска анкет клиентов в Siebel CRM.",
        deadlines=["Срок – 01.04.2025"],
    )
    _p(doc, "Выводы по подразделу:")
    _p(
        doc,
        "В ходе аудита выявлена необходимость в разработке нормативов нагрузки. "
        "Этот текст идёт после рамки и НЕ должен попадать в рекомендацию.",
    )

    _p(doc, "Наблюдение № 3.2: Два срока в одной рамке")
    _bordered(doc, "Уровень существенности: высокий")
    _bordered(doc, "Аудитор: Иванов И.И.")
    _bordered(doc, "Объект аудита: ДРТБ")
    _bordered(doc, "Руководитель объекта аудита: Петров П.П.")
    _bordered(doc, "Проработать порядок контроля по заявкам.")
    _bordered(doc, "Срок – 01.05.2026")
    _bordered(doc, "Срок – 01.06.2026")

    _p(doc, "Наблюдение № 3.3: Разбитые run и пробелы")
    _bordered(doc, "Уровень существенности: средний")
    _bordered_mixed_runs(
        doc,
        [
            ("Аудиторская рекомендация: ", True),
            ("Проработать вопрос", False),
            (" по определению подходов", False),
            (" для расчета нормативов", False),
            (" нагрузки менеджеров.", False),
        ],
    )
    _bordered(doc, "Срок – 10.05.2026", bold=True)

    _p(doc, "Наблюдение № 3.4: Метка рекомендации в середине строки")
    _bordered(doc, "Уровень существенности: низкий")
    _bordered_mixed_runs(
        doc,
        [
            ("Объект аудита: ДРТБ", False),
            (
                " Руководитель объекта аудита: Иванов И.И. Аудиторская рекомендация: ",
                True,
            ),
            ("Сделать контроль удобнее.", False),
        ],
    )
    _bordered(doc, "Срок – 11.05.2026", bold=True)
    return doc, "03_рамки_хвосты_split_runs.docx", [
        "4 наблюдения 3.1–3.4",
        "В 3.1 нет «Выводы по подразделу» / «нормативов нагрузки»",
        "В 3.2 оба срока: 01.05.2026 и 01.06.2026",
        "В 3.3 пробелы сохранены: «вопрос по», «подходов для», «нормативов нагрузки»",
        "В 3.4 объект+руководитель до рек; без строки «Аудиторская рекомендация:» в теле",
    ]


def case_04_title_fake_and_unrelated_tables():
    """Фейковое наблюдение на титуле + чужая таблица внутри блока."""
    doc = Document()
    title_table = doc.add_table(rows=1, cols=2)
    title_table.cell(0, 0).text = "Наблюдение 3.1"
    title_table.cell(0, 1).text = (
        "Аудит процесса БК.1.2. «Привлечение корпоративных клиентов сегментов "
        "Крупный, Крупнейший и развитие отношений с ними»."
    )
    _page_break(doc)
    _toc_skeleton(doc, ["I. Мнение", "III. Детали", "IV. Отчётность"])
    _opinion(doc)
    _heading(doc, "III. Детальные результаты аудита")

    real = doc.add_table(rows=1, cols=2)
    real.cell(0, 0).text = "Наблюдение 3.1"
    real.cell(0, 1).text = "Реальное наблюдение (не титул)"
    _p(doc, "Уровень существенности: средний")
    unrelated = doc.add_table(rows=1, cols=1)
    unrelated.cell(0, 0).text = "Справочная таблица, не относится к рекомендации."
    rec_tbl = doc.add_table(rows=3, cols=1)
    rec_tbl.cell(0, 0).text = "Уровень существенности: средний"
    rec_tbl.cell(1, 0).text = "Аудиторская рекомендация: Настроить контроль таблиц."
    rec_tbl.cell(2, 0).text = "Срок – 01.05.2026"

    _heading(doc, "IV. Контроль отчетности")
    _p(doc, "Наблюдение № 4.1: Контроль отчетов без строки в таблице имён")
    _p(doc, "Уровень существенности: средний")
    _p(doc, "Аудиторская рекомендация: Настроить отчетность.")
    _p(doc, "Срок исполнения: до 06.04.2026.")
    return doc, "04_титул_фейк_и_чужие_таблицы.docx", [
        "2 наблюдения: 3.1 (имя «Реальное наблюдение»), 4.1",
        "Нет имени с «Аудит процесса БК.1.2»",
        "В рек 3.1 нет «Справочная таблица»",
        "4.1 не потерян, хотя имени нет в таблице",
    ]


def case_05_no_section_iii_false_subpoint():
    """Нет III; есть «3. Подпункт» внутри V; наблюдения в IV и VI."""
    doc = Document()
    _title_page(doc, "05 — без III / ложный подпункт 3.")
    _toc_skeleton(
        doc,
        [
            "I. Аудиторское мнение",
            "II. Основные результаты",
            "IV. Контроль",
            "V. Риски",
            "VI. Итоги",
        ],
    )
    _opinion(doc)
    _heading(doc, "IV. Контроль отчетности")
    _p(doc, "Наблюдение 4.1. Первый контроль без раздела III")
    _p(doc, "Аудиторская рекомендация: Исправить контроль.")
    _p(doc, "Срок – 01.05.2026.")

    _heading(doc, "V. Управление рисками")
    _p(doc, "3. Подпункт — не раздел III и не наблюдение")
    _p(doc, "Пояснительный текст про риски, без рекомендаций.")

    _heading(doc, "VI. Итоговые выводы")
    _p(doc, "Наблюдение 6.1. Второй контроль")
    _p(doc, "Аудиторская рекомендация: Закрыть замечание.")
    _p(doc, "Срок – 02.05.2026.")
    return doc, "05_без_III_ложный_подпункт.docx", [
        "2 наблюдения: 4.1, 6.1",
        "Раздел II вставлен после I",
        "«3. Подпункт» не стал наблюдением и не сдвинул парсинг",
    ]


def case_06_long_realistic_corp():
    """Длинный «почти реальный» АЗ: много глав, смешанные форматы, Calibri, цвет."""
    doc = Document()
    font = "Calibri"
    _p(doc, "АУДИТОРСКОЕ ЗАКЛЮЧЕНИЕ", bold=True, size=16, font=font)
    _p(
        doc,
        "Аудит процесса привлечения корпоративных клиентов (стресс-кейс)",
        bold=True,
        size=13,
        font=font,
    )
    # Титульная таблица с ложным наблюдением
    tt = doc.add_table(rows=2, cols=2)
    tt.cell(0, 0).text = "Объект"
    tt.cell(0, 1).text = "БК.1.2 Привлечение корпоративных клиентов"
    tt.cell(1, 0).text = "Наблюдение 3.1"
    tt.cell(1, 1).text = "Титульное описание процесса — НЕ наблюдение раздела III"
    _page_break(doc)
    _toc_skeleton(
        doc,
        [
            "I.\tАудиторское мнение по итогам проверки",
            "II.\tОсновные результаты аудита и аудиторские рекомендации",
            "III.\tСоблюдение стратегических целей",
            "IV.\tАнализ организации работы",
            "V.\tКонтроль клиентских данных",
            "VI.\tКонтроль отчетности",
            "VII.\tУправление рисками",
        ],
    )
    _heading(doc, "I. Аудиторское мнение по итогам проверки.", font=font)
    _p(
        doc,
        "Система ВК в целом достаточна; выявлены точечные недостатки. "
        "См. также упоминание Наблюдение 5.2 в тексте мнения — это не старт блока.",
        font=font,
    )

    # Пустой placeholder раздела II (генератор должен заменить)
    _heading(
        doc,
        "II. Основные результаты аудита и аудиторские рекомендации",
        font=font,
    )
    _p(doc, "Старый текст раздела II — должен быть заменён таблицей.", font=font)

    _heading(
        doc,
        "III. Соблюдение стратегических целей и установленных Банком показателей.",
        font=font,
    )
    _p(doc, "3.1. Подраздел методик (это подзаголовок, не наблюдение)", font=font)
    t = doc.add_table(rows=1, cols=2)
    t.cell(0, 0).paragraphs[0].clear()
    r0 = t.cell(0, 0).paragraphs[0].add_run("Наблюдение 3.1.1.")
    _font(r0, name=font, bold=True)
    t.cell(0, 1).paragraphs[0].clear()
    r1 = t.cell(0, 1).paragraphs[0].add_run(
        "Вопросы необходимости уточнения показателей нагрузки менеджеров "
        "клиентского сервиса сегмента «Крупный»."
    )
    _font(r1, name=font)
    _frame_rec(
        doc,
        materiality="высокий",
        font=font,
        body=[
            "\tПроработать вопрос по определению подходов для расчета нормативов нагрузки.",
            "Закрепить методику в локальном акте и провести обучение.",
        ],
        deadlines=["Срок исполнения — до 30.06.2026"],
    )
    _p(doc, "Выводы по подразделу 3.1: текст после рамки — вне таблицы.", font=font)

    _p(doc, "Наблюдение 3.1.2. Дублирование контролей в CRM и Excel", font=font)
    _bordered(doc, "Уровень существенности — низкий", font=font)
    _bordered(doc, "Аудитор: Смирнова А.А.", font=font)
    _bordered(
        doc,
        "Объект аудита: Департамент развития транзакционного бизнеса",
        font=font,
    )
    _bordered(
        doc,
        "Аудиторские рекомендации: Исключить ручное ведение параллельных реестров. "
        "См. также Наблюдение 4.2.1.",
        font=font,
    )
    _bordered(doc, "Срок – 15.07.2026", font=font)

    _heading(doc, "IV. Анализ организации работы по привлечению клиентов.", font=font)
    # Кварталы снова
    q = doc.add_table(rows=1, cols=4)
    for i, lab in enumerate(["I Q 2025", "II Q 2025", "III Q 2025", "IV Q 2025"]):
        cell = q.cell(0, i)
        cell.text = ""
        run = cell.paragraphs[0].add_run(lab)
        _font(run, name=font, bold=True, size=14, color=RGBColor(0x2E, 0x75, 0xB6))

    _p(doc, "Наблюдение № 4.1: Отсутствие SLA по обработке заявок", font=font)
    _frame_rec(
        doc,
        materiality="средний",
        font=font,
        obj="ДСККБ",
        head="Козлов Н.Н.",
        body="Утвердить SLA и настроить эскалацию просрочек.",
        deadlines=["Срок: с 01.08.2026 по 31.08.2026."],
    )

    _p(doc, "Наблюдение 4.2.1) Неполная фиксация причин отказа", font=font)
    _bordered(doc, "Уровень существенности: средний", font=font)
    _bordered(doc, "Рекомендация — доработать справочник причин отказа.", font=font)
    _bordered(doc, "Срок реализации: до 01.09.26.", font=font)

    _heading(doc, "V. Контроль клиентских данных", font=font)
    _p(doc, "Наблюдение No. 5.1 — Неактуальные карточки в Siebel", font=font)
    _frame_rec(
        doc,
        materiality=None,  # без существенности
        font=font,
        label="Мероприятия после аудита:",
        body="Назначить владельца качества данных и провести сверку.",
        deadlines=["Срок выполнения: 12.09.2026."],
    )

    _p(doc, "Наблюдение N 5.2: Права доступа к ПДн", font=font)
    _frame_rec(
        doc,
        materiality="высокий",
        font=font,
        body="Пересмотреть матрицу доступов; отключить избыточные роли.",
        deadlines=["Срок – 01.10.2026.", "Срок – 15.10.2026."],
    )

    _heading(doc, "VI Контроль отчетности", font=font)  # без точки
    _p(doc, "Случайный текст между заголовком и наблюдением — не title главы.", font=font)
    _p(doc, "Наблюдение 6.1. Расхождения управленческой и регуляторной отчётности", font=font)
    _frame_rec(
        doc,
        materiality="средний",
        font=font,
        body=[
            "Обеспечить сверку показателей в комплексе ",
        ],
        deadlines=["Срок исполнения: до 20.10.2026."],
    )
    # Добиваем пробел между run вручную второй рамочкой уже поздно — добавим
    # отдельный абзац-рекомендацию со split runs вместо перезаписи 6.1:
    # Пересоберём 6.1 проще: оставим как есть и добавим 6.2 со split.

    _p(doc, "Наблюдение 6.2: Split-run в рекомендации (Siebel)", font=font)
    _bordered(doc, "Уровень существенности: высокий", font=font)
    _bordered_mixed_runs(
        doc,
        [
            ("Аудиторская рекомендация: ", True),
            ("Обеспечить поиск анкет в комплексе ", False),
            ("Siebel", True),
            (" CRM без ручных выгрузок.", False),
        ],
    )
    _bordered(doc, "Срок – 25.10.2026", font=font, bold=True)

    _heading(doc, "VII. Управление рисками", font=font)
    _p(doc, "3. Методика оценки — не наблюдение и не раздел III", font=font)
    _p(doc, "Наблюдение 7.1. Неполная эскалация операционных инцидентов", font=font)
    _frame_rec(
        doc,
        materiality="низкий",
        font=font,
        body="Доработать регламент эскалации; провести пилот в одном подразделении.",
        deadlines=["Срок – 30.11.2026."],
    )
    return doc, "06_длинный_корпо_Calibri_микс.docx", [
        "Ожидаемые номера (порядок): 3.1.1, 3.1.2, 4.1, 4.2.1, 5.1, 5.2, 6.1, 6.2, 7.1",
        "Титульное «Наблюдение 3.1» не попадает в таблицу",
        "Упоминание «Наблюдение 5.2» в мнении I не создаёт лишнего блока",
        "5.1: существенность «не указан», метка мероприятий",
        "5.2: два срока",
        "6.2: «комплексе Siebel CRM» без склейки слов",
        "«3. Методика» / «3.1. Подраздел» не стали наблюдениями",
        "Старый текст раздела II заменён",
    ]


def case_07_materiality_word_trap():
    """Слово «высокий» в рекомендации без метки существенности + эмодзи/буллеты."""
    doc = Document()
    _title_page(doc, "07 — ловушка существенности и буллеты")
    _toc_skeleton(doc, ["I. Мнение", "III. Детали"])
    _opinion(doc)
    _heading(doc, "III. Детальные результаты аудита")
    _p(doc, "Наблюдение 3.1. Контроль приоритетов")
    _bordered(doc, "Аудитор: Тестов Т.Т.")
    _bordered(doc, "Объект аудита: ДРТБ")
    _bordered(
        doc,
        "Аудиторская рекомендация: обеспечить высокий приоритет обработки заявок "
        "и средний уровень сервиса для сегмента «Крупный».",
    )
    _bordered(doc, "Срок – 01.05.2026.")

    _p(doc, "Наблюдение 3.2. Буллеты и длинная рек")
    _frame_rec(
        doc,
        materiality="средний",
        body=[
            "• Первый пункт рекомендации с длинным текстом про доработку "
            "регламента и обучение сотрудников филиальной сети.",
            "• Второй пункт: см. Наблюдение 3.1. (кросс-ссылка).",
            "– Третий пункт с другим маркером.",
        ],
        deadlines=["Срок исполнения — до 31.12.2026"],
    )
    return doc, "07_ловушка_существенности_буллеты.docx", [
        "3.1: существенность «не указан» (слово «высокий» только в тексте рек)",
        "3.2: два наблюдения, кросс-ссылка на 3.1 не дублирует блок",
        "Буллеты сохраняются / не ломают срок",
    ]


CASES = [
    case_01_quarters_and_chapter_order,
    case_02_number_formats_and_deadlines,
    case_03_frames_vs_following_text,
    case_04_title_fake_and_unrelated_tables,
    case_05_no_section_iii_false_subpoint,
    case_06_long_realistic_corp,
    case_07_materiality_word_trap,
]


def _write_readme(entries: list[tuple[str, list[str]]]) -> None:
    lines = [
        "# Тесты парсинга / генерации Раздела II",
        "",
        "Сложные синтетические АЗ для прогонки через вкладку **Инструменты → АЗ** "
        "(или API генерации раздела II).",
        "",
        "Как гонять:",
        "1. Загрузить исходный `.docx` (не `*_section_ii*`).",
        "2. Скачать результат.",
        "3. Сверить номера/порядок/тексты рекомендаций с ожидаемым ниже.",
        "",
        "Перегенерация:",
        "```",
        "cd sokol-backend",
        "python scripts/generate_az_parser_stress_cases.py",
        "```",
        "",
    ]
    for name, expects in entries:
        lines.append(f"## `{name}`")
        lines.append("")
        for e in expects:
            lines.append(f"- {e}")
        lines.append("")
    (OUT_DIR / "README.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    readme_entries: list[tuple[str, list[str]]] = []
    for builder in CASES:
        doc, filename, expects = builder()
        path = OUT_DIR / filename
        doc.save(path)
        print(f"Saved: {path}")
        readme_entries.append((filename, expects))
    _write_readme(readme_entries)
    print(f"README: {OUT_DIR / 'README.md'}")


if __name__ == "__main__":
    main()
