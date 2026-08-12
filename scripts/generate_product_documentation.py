#!/usr/bin/env python3
"""Generate SOKOL product documentation as DOCX for business users."""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "SOKOL_Документация_продукта.docx"
OUTPUT_CONFLUENCE = Path(__file__).resolve().parent.parent / "docs" / "SOKOL_Документация_продукта_Confluence.docx"

# Brand colors
COLOR_PRIMARY = RGBColor(0x1A, 0x36, 0x5D)  # dark blue
COLOR_ACCENT = RGBColor(0x2E, 0x75, 0xB6)   # medium blue
COLOR_MUTED = RGBColor(0x5A, 0x5A, 0x5A)


def set_cell_shading(cell, fill_hex: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill_hex)
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)


def add_horizontal_line(doc: Document) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(12)
    p_pr = p._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "2E75B6")
    p_bdr.append(bottom)
    p_pr.append(p_bdr)


def style_heading(paragraph, level: int) -> None:
    sizes = {1: 22, 2: 16, 3: 13}
    paragraph.paragraph_format.space_before = Pt(18 if level == 1 else 14)
    paragraph.paragraph_format.space_after = Pt(8)
    for run in paragraph.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(sizes.get(level, 12))
        run.font.bold = True
        run.font.color.rgb = COLOR_PRIMARY if level <= 2 else COLOR_ACCENT


def add_title_page(doc: Document) -> None:
    for _ in range(4):
        doc.add_paragraph()

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("SOKOL")
    run.font.name = "Calibri"
    run.font.size = Pt(36)
    run.font.bold = True
    run.font.color.rgb = COLOR_PRIMARY

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("Система управления проверками\nи аналитики для департамента внутреннего аудита")
    run.font.name = "Calibri"
    run.font.size = Pt(16)
    run.font.color.rgb = COLOR_MUTED

    doc.add_paragraph()
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta.add_run(f"Документация продукта\n{date.today().strftime('%d.%m.%Y')}")
    run.font.name = "Calibri"
    run.font.size = Pt(12)
    run.font.color.rgb = COLOR_MUTED

    doc.add_page_break()


def add_toc_placeholder(doc: Document) -> None:
    h = doc.add_heading("Содержание", level=1)
    style_heading(h, 1)

    items = [
        "1. О продукте",
        "2. Бизнес-ценность и применение",
        "3. Кому предназначена система",
        "4. Реализованный функционал",
        "5. Пользовательские истории",
        "6. Как пользоваться системой",
        "7. Роли и права доступа",
        "8. Аналитика и BI-инструменты",
        "9. Словарь терминов",
        "10. Что в разработке",
        "11. Техническая реализация",
        "12. Места для скриншотов",
        "Приложение А. Публикация в Confluence",
    ]
    for item in items:
        p = doc.add_paragraph(item, style="List Number")
        p.paragraph_format.left_indent = Cm(0.5)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(11)

    doc.add_page_break()


def add_section_about(doc: Document) -> None:
    h = doc.add_heading("1. О продукте", level=1)
    style_heading(h, 1)

    paragraphs = [
        (
            "SOKOL (Сокол) — внутренняя CRM-система с инструментами бизнес-аналитики (BI), "
            "разработанная для департамента внутреннего аудита (ДВА). Система объединяет в одном "
            "месте учёт проверок, контроль исполнения рекомендаций, аналитические дашборды и "
            "автоматизацию подготовки аудиторских документов."
        ),
        (
            "Вместо разрозненных Excel-файлов, электронной почты и ручного сбора отчётности "
            "сотрудники ДВА получают единую рабочую среду: от планирования проверки до мониторинга "
            "исполнения рекомендаций подразделениями банка."
        ),
        (
            "Система работает через веб-браузер — не требует установки программ на компьютер "
            "пользователя. Доступ защищён логином и паролем; данные хранятся на сервере организации."
        ),
    ]
    for text in paragraphs:
        p = doc.add_paragraph(text)
        p.paragraph_format.space_after = Pt(8)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(11)

    # Key capabilities table
    h2 = doc.add_heading("Ключевые возможности", level=2)
    style_heading(h2, 2)

    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0].cells
    hdr[0].text = "Область"
    hdr[1].text = "Что даёт пользователю"
    for cell in hdr:
        set_cell_shading(cell, "1A365D")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    rows = [
        ("Реестр проверок", "Единый каталог всех аудиторских мероприятий с фильтрами и экспортом"),
        ("Реестр рекомендаций", "Контроль сроков, статусов и исполнения требований к подразделениям"),
        ("Аналитика (BI)", "Дашборды для руководства: нагрузка аудиторов, исполнение, охват департаментов"),
        ("Планирование", "Какие подразделения проверены, где есть пробелы и «красные» рекомендации"),
        ("Инструменты Word", "Автоматическое формирование разделов АЗ и докладных записок"),
        ("Вложения", "Хранение приказов, программ, АЗ, ДЗ и подтверждающих документов"),
        ("Справочники", "Аудиторы, департаменты, виды проверок, оценки эффективности"),
    ]
    for area, benefit in rows:
        row = table.add_row().cells
        row[0].text = area
        row[1].text = benefit
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_business_value(doc: Document) -> None:
    h = doc.add_heading("2. Бизнес-ценность и применение", level=1)
    style_heading(h, 1)

    benefits = [
        (
            "Прозрачность портфеля проверок",
            "Руководитель ДВА видит все проверки в одном месте: статусы, сроки, ответственных, "
            "готовность документов (приказ, программа, АЗ, ДЗ). Не нужно запрашивать сводки у каждого аудитора.",
        ),
        (
            "Контроль исполнения рекомендаций",
            "Каждая рекомендация имеет срок, статус, уровень существенности и историю продлений. "
            "Система помогает вовремя выявлять просрочки и «красные» (высокосущественные) пункты.",
        ),
        (
            "Снижение ручного труда",
            "Импорт рекомендаций из аудиторского заключения, автоматическое формирование раздела II АЗ "
            "и докладной записки экономят часы рутинной работы с Word-документами.",
        ),
        (
            "Обоснованное планирование",
            "Раздел «Планирование» показывает охват департаментов проверками: какие подразделения "
            "уже проверены, какие — нет, где накопилось больше всего рекомендаций.",
        ),
        (
            "Аналитика для принятия решений",
            "BI-дашборды отвечают на вопросы: сколько проверок в работе, какой % рекомендаций исполнен, "
            "как распределена нагрузка между аудиторами, какие департаменты чаще получают замечания.",
        ),
        (
            "Единый источник данных",
            "Все сотрудники ДВА работают с одной базой. Исключаются расхождения между версиями "
            "таблиц и потеря информации при передаче файлов.",
        ),
    ]

    for title, text in benefits:
        h3 = doc.add_heading(title, level=3)
        style_heading(h3, 3)
        p = doc.add_paragraph(text)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(11)

    add_horizontal_line(doc)


def add_section_audience(doc: Document) -> None:
    h = doc.add_heading("3. Кому предназначена система", level=1)
    style_heading(h, 1)

    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "Роль"
    hdr[1].text = "Кто это"
    hdr[2].text = "Основные задачи в системе"
    for cell in hdr:
        set_cell_shading(cell, "1A365D")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    audience = [
        (
            "Аудитор",
            "Сотрудник ДВА, проводящий проверки",
            "Ведение проверок, создание рекомендаций, загрузка документов, "
            "обновление статусов исполнения, работа с аналитикой и инструментами Word",
        ),
        (
            "Руководитель проверки",
            "Аудитор, назначенный руководителем конкретного мероприятия",
            "Координация проверки, контроль сроков, заполнение оценок эффективности, "
            "подготовка АЗ и ДЗ",
        ),
        (
            "Руководитель ДВА",
            "Начальник департамента внутреннего аудита",
            "Просмотр аналитики и дашбордов ДВА, мониторинг портфеля, планирование охвата департаментов",
        ),
        (
            "Администратор",
            "Ответственный за сопровождение системы",
            "Управление справочниками, удаление записей, настройка пользователей (через администратора БД)",
        ),
    ]
    for role, who, tasks in audience:
        row = table.add_row().cells
        row[0].text = role
        row[1].text = who
        row[2].text = tasks
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_features(doc: Document) -> None:
    h = doc.add_heading("4. Реализованный функционал", level=1)
    style_heading(h, 1)

    modules = [
        (
            "4.1. Проверки",
            [
                "Реестр всех проверок с фильтрами по названию, типу, виду, статусу, руководителю, датам",
                "Быстрый фильтр «Мои» — только проверки, где вы руководитель",
                "Создание и редактирование карточки проверки",
                "Автоматическая генерация уникального ключа проверки (например, 26IVP01P1)",
                "Типы: плановая, внеплановая, контрольная (тематическая)",
                "Виды: ИТ, Корпо, Розница, Риски, Комплаенс и др. (из справочника)",
                "Статусы: Запланировано → В процессе → Завершено (определяются по датам)",
                "Учёт документов: приказ, программа, АЗ, ДЗ (номера и даты)",
                "Оценки эффективности по 4 направлениям: процессы, СВК, СУР, СВИК",
                "Загрузка файлов-вложений к проверке",
                "Импорт рекомендаций из файла аудиторского заключения (.docx)",
                "Экспорт списка в Excel, Word, PDF",
            ],
        ),
        (
            "4.2. Рекомендации",
            [
                "Реестр рекомендаций с привязкой к проверке",
                "Фильтры: аудитор, объект аудита, статус, срок, уровень существенности, индикатор",
                "Быстрый фильтр «Мои» — рекомендации, где вы аудитор или руководитель объекта",
                "Создание вручную или импорт из АЗ",
                "Уровни существенности: низкий (зелёный), средний (жёлтый), высокий (красный)",
                "Статусы: Исполнено, Не решено, На контроле, В процессе",
                "Контроль сроков: В срок, Срок нарушен, На контроле",
                "Контрольная зона: факт исполнения, снятие с контроля, перенос срока (до 2 раз)",
                "Вложения-подтверждения к рекомендации",
                "Экспорт списка в Excel, Word, PDF",
            ],
        ),
        (
            "4.3. Наблюдения",
            [
                "Демонстрационный реестр наблюдений из разделов АЗ",
                "Связи с рекомендациями (переход по ссылке)",
                "Полноценное создание и редактирование — в разработке",
            ],
        ),
        (
            "4.4. Аналитика (BI)",
            [
                "Вкладка «Проверки»: сводка KPI, динамика, виды и типы, карта департаментов, матрица оценок",
                "Вкладка «Рекомендации»: статусы, существенность, индикаторы, % исполнения и просрочек",
                "Вкладка «Мониторинг»: оперативный контроль сроков и статусов",
                "Вкладка «ДВА»: портфель, нагрузка аудиторов, готовность документов, treemap",
                "Фильтры: период (год/квартал/месяц), аудиторы, департаменты, статусы",
                "Экспорт выбранных дашбордов: Excel, PDF, Word, HTML",
            ],
        ),
        (
            "4.5. Планирование",
            [
                "Охват департаментов проверками (% проверенных подразделений)",
                "Рейтинг департаментов по числу проверок и рекомендаций",
                "«Красные» рекомендации (высокая существенность) по департаментам",
                "Фильтры по периоду и департаментам",
            ],
        ),
        (
            "4.6. Инструменты (автоматизация документов)",
            [
                "Формирование раздела II аудиторского заключения из наблюдений раздела III",
                "Формирование раздела II с гиперссылками на наблюдения",
                "Генерация докладной записки (ДЗ) из готового АЗ",
                "Парсинг рекомендаций из АЗ для импорта в реестр",
                "Генерация раздела I «Аудиторское мнение» с помощью ИИ (требует Ollama)",
            ],
        ),
        (
            "4.7. Настройки (только администратор)",
            [
                "Справочник аудиторов (ФИО)",
                "Справочник департаментов (объекты аудита)",
                "Справочник видов проверок",
                "Справочник видов аудита (код + название)",
                "Справочник оценок эффективности",
            ],
        ),
        (
            "4.8. Профиль и вход",
            [
                "Вход по логину и паролю",
                "Профиль: отображаемое имя, выбор аватара",
                "Безопасный выход из системы",
            ],
        ),
    ]

    for title, items in modules:
        h2 = doc.add_heading(title, level=2)
        style_heading(h2, 2)
        for item in items:
            p = doc.add_paragraph(item, style="List Bullet")
            for run in p.runs:
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_user_stories(doc: Document) -> None:
    h = doc.add_heading("5. Пользовательские истории", level=1)
    style_heading(h, 1)

    p = doc.add_paragraph(
        "Ниже — основные сценарии использования системы с точки зрения бизнес-пользователя. "
        "Каждая история описывает, что хочет получить пользователь и что система уже умеет."
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(11)

    stories = [
        (
            "US-01",
            "Просмотр списка проверок",
            "Как аудитор, я хочу видеть список всех проверок с возможностью фильтрации и сортировки, "
            "чтобы быстро находить нужное мероприятие.",
            "Реализовано: таблица с фильтрами, сортировкой, пагинацией и экспортом.",
        ),
        (
            "US-02",
            "Фильтр «Мои проверки»",
            "Как руководитель проверки, я хочу одним кликом видеть только свои проверки.",
            "Реализовано: кнопка «Мои» на вкладке Проверки.",
        ),
        (
            "US-03",
            "Создание проверки",
            "Как аудитор, я хочу создать новую проверку с автоматическим ключом и заполнить карточку.",
            "Реализовано: форма создания с автогенерацией ключа, выбором типа, вида, руководителя, дат.",
        ),
        (
            "US-04",
            "Редактирование проверки",
            "Как аудитор, я хочу обновлять данные проверки, прикреплять документы и оценки эффективности.",
            "Реализовано: полная форма редактирования, блок вложений, оценки СВК/СУР/СВИК.",
        ),
        (
            "US-05",
            "Экспорт проверок",
            "Как аудитор, я хочу выгрузить отфильтрованный список проверок в Excel или PDF.",
            "Реализовано: экспорт XLSX, DOCX, PDF из списка.",
        ),
        (
            "US-06",
            "Управление справочниками",
            "Как администратор, я хочу добавлять и редактировать аудиторов, департаменты и виды проверок.",
            "Реализовано: раздел Настройки с CRUD для всех справочников.",
        ),
        (
            "US-07",
            "Импорт рекомендаций из АЗ",
            "Как аудитор, я хочу загрузить аудиторское заключение и автоматически получить список рекомендаций.",
            "Реализовано: загрузка .docx → предпросмотр → добавление в проверку.",
        ),
        (
            "US-08",
            "Контроль рекомендаций",
            "Как аудитор, я хочу отслеживать статус, сроки и исполнение каждой рекомендации.",
            "Реализовано: реестр с фильтрами, контрольная зона, продления, снятие с контроля.",
        ),
        (
            "US-09",
            "Аналитика для руководства",
            "Как руководитель ДВА, я хочу видеть сводные дашборды по проверкам и рекомендациям.",
            "Реализовано: 4 вкладки аналитики с KPI, графиками и экспортом.",
        ),
        (
            "US-10",
            "Автоматизация документов",
            "Как аудитор, я хочу автоматически формировать раздел II АЗ и докладную записку.",
            "Реализовано: инструменты Word на вкладке «Инструменты».",
        ),
        (
            "US-11",
            "Планирование охвата",
            "Как руководитель ДВА, я хочу видеть, какие департаменты проверены, а какие — нет.",
            "Реализовано: раздел «Планирование» с охватом и «красными» рекомендациями.",
        ),
        (
            "US-12",
            "Просмотр наблюдений",
            "Как аудитор, я хочу видеть наблюдения из АЗ и связанные рекомендации.",
            "Частично: демо-таблица; полный CRUD — в разработке.",
        ),
        (
            "US-13",
            "Интеграция с Канцлер",
            "Как аудитор, я хочу обмениваться документами с системой электронного документооборота.",
            "В разработке: раздел «Канцлер» — заглушка.",
        ),
    ]

    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, text in enumerate(["ID", "История", "Описание", "Статус"]):
        hdr[i].text = text
        set_cell_shading(hdr[i], "1A365D")
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(9)

    for sid, title, desc, status in stories:
        row = table.add_row().cells
        row[0].text = sid
        row[1].text = title
        row[2].text = desc
        row[3].text = status
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(9)

    add_horizontal_line(doc)


def add_section_howto(doc: Document) -> None:
    h = doc.add_heading("6. Как пользоваться системой", level=1)
    style_heading(h, 1)

    workflows = [
        (
            "6.1. Вход в систему",
            [
                "Откройте адрес системы в браузере (например, http://localhost:5180).",
                "На странице «Вход» введите логин и пароль.",
                "Нажмите «Войти» — вы попадёте на вкладку «Проверки».",
                "Для выхода нажмите «Выйти» в правом верхнем углу.",
            ],
        ),
        (
            "6.2. Поиск и просмотр проверок",
            [
                "Перейдите в раздел «Проверки» в левом меню.",
                "Используйте фильтры в заголовках столбцов для поиска.",
                "Нажмите «Мои», чтобы увидеть только свои проверки.",
                "Нажмите «Редактировать» в строке для открытия карточки.",
                "Для выгрузки нажмите «Экспорт» и выберите формат (Excel, Word, PDF).",
            ],
        ),
        (
            "6.3. Создание новой проверки",
            [
                "На вкладке «Проверки» нажмите «Создать».",
                "Заполните обязательные поля: Название, Тип, Вид, Руководитель, Дата начала.",
                "Обратите внимание на автоматически сгенерированный Ключ.",
                "При необходимости укажите дату окончания, номера документов, оценки эффективности.",
                "Нажмите «Сохранить» — после сохранения станут доступны вложения и рекомендации.",
                "В блоке «Вложения» прикрепите файлы приказа, программы, АЗ, ДЗ.",
            ],
        ),
        (
            "6.4. Добавление рекомендаций",
            [
                "Откройте сохранённую проверку (Редактировать).",
                "Вариант А — вручную: «Добавить вручную» → заполните форму → «Сохранить».",
                "Вариант Б — из АЗ: «Загрузить из АЗ» → выберите файл .docx → проверьте таблицу → «Добавить в проверку».",
                "Все рекомендации также видны на вкладке «Рекомендации».",
            ],
        ),
        (
            "6.5. Контроль исполнения рекомендаций",
            [
                "Перейдите в «Рекомендации».",
                "Отфильтруйте по статусу, сроку или объекту аудита.",
                "Откройте карточку рекомендации (Редактировать).",
                "Обновите статус и дополнительный статус по срокам.",
                "В «Контрольной зоне» укажите дату исполнения, перенос срока или снятие с контроля.",
                "Прикрепите подтверждающие документы при необходимости.",
            ],
        ),
        (
            "6.6. Работа с аналитикой",
            [
                "Перейдите в «Аналитика».",
                "Выберите вкладку: Проверки, Рекомендации, Мониторинг или ДВА.",
                "Настройте фильтры слева: период, аудиторы, департаменты.",
                "Изучите карточки с KPI и графиками.",
                "Отметьте нужные карточки и нажмите «Экспорт» для выгрузки отчёта.",
            ],
        ),
        (
            "6.7. Планирование",
            [
                "Перейдите в «Планирование».",
                "Выберите период и при необходимости — департаменты.",
                "Оцените % охвата департаментов проверками.",
                "Обратите внимание на «красные» рекомендации — высокосущественные пункты.",
            ],
        ),
        (
            "6.8. Инструменты Word",
            [
                "Перейдите в «Инструменты».",
                "Выберите вкладку «АЗ» или «ДЗ».",
                "Выберите нужный инструмент (например, «Формирование раздела II»).",
                "Загрузите файл .docx.",
                "Дождитесь обработки и скачайте результат.",
            ],
        ),
    ]

    for title, steps in workflows:
        h2 = doc.add_heading(title, level=2)
        style_heading(h2, 2)
        for i, step in enumerate(steps, 1):
            p = doc.add_paragraph(f"{i}. {step}")
            p.paragraph_format.left_indent = Cm(0.5)
            for run in p.runs:
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_roles(doc: Document) -> None:
    h = doc.add_heading("7. Роли и права доступа", level=1)
    style_heading(h, 1)

    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, text in enumerate(["Действие", "Аудитор", "Администратор"]):
        hdr[i].text = text
        set_cell_shading(hdr[i], "1A365D")
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    permissions = [
        ("Просмотр проверок, рекомендаций, аналитики", "✓", "✓"),
        ("Создание и редактирование проверок и рекомендаций", "✓", "✓"),
        ("Загрузка и скачивание вложений", "✓", "✓"),
        ("Использование инструментов Word", "✓", "✓"),
        ("Просмотр справочников", "✓", "✓"),
        ("Удаление проверок, рекомендаций, вложений", "—", "✓"),
        ("Управление справочниками (Настройки)", "—", "✓"),
    ]
    for action, auditor, admin in permissions:
        row = table.add_row().cells
        row[0].text = action
        row[1].text = auditor
        row[2].text = admin
        for cell in row:
            for p in cell.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if cell != row[0] else WD_ALIGN_PARAGRAPH.LEFT
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(10)

    doc.add_paragraph()
    p = doc.add_paragraph(
        "Примечание: для входа в систему используйте логин и пароль, выданные администратором. "
        "В тестовой среде доступны учётные записи admin/admin (администратор) и auditor/auditor (аудитор)."
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run.font.italic = True
        run.font.color.rgb = COLOR_MUTED

    add_horizontal_line(doc)


def add_section_analytics(doc: Document) -> None:
    h = doc.add_heading("8. Аналитика и BI-инструменты", level=1)
    style_heading(h, 1)

    p = doc.add_paragraph(
        "Раздел «Аналитика» — это набор интерактивных дашбордов, которые помогают руководству ДВА "
        "принимать решения на основе данных. Все показатели рассчитываются по полной базе данных "
        "в реальном времени."
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(11)

    dashboards = [
        (
            "Проверки",
            "Сколько проверок запланировано, в работе и завершено. Распределение по видам и типам. "
            "Карта департаментов. Матрица оценок эффективности (СВК, СУР, СВИК, процессы).",
        ),
        (
            "Рекомендации",
            "Статусы исполнения, уровни существенности, индикаторы. Процент исполненных и просроченных. "
            "Распределение по объектам аудита и проверкам.",
        ),
        (
            "Мониторинг",
            "Оперативный срез: динамика сроков исполнения, текущие статусы. "
            "Для ежедневного контроля «горящих» рекомендаций.",
        ),
        (
            "ДВА",
            "Портфель проверок и рекомендаций по периодам. Нагрузка на каждого аудитора. "
            "Готовность документов (приказ, программа, АЗ, ДЗ заполнены или нет). "
            "Treemap распределения работы между аудиторами.",
        ),
        (
            "Планирование",
            "Охват департаментов (% проверенных подразделений). Рейтинг департаментов. "
            "«Красные» рекомендации — приоритетные для планирования следующего цикла.",
        ),
    ]

    for name, desc in dashboards:
        h3 = doc.add_heading(name, level=3)
        style_heading(h3, 3)
        p = doc.add_paragraph(desc)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_glossary(doc: Document) -> None:
    h = doc.add_heading("9. Словарь терминов", level=1)
    style_heading(h, 1)

    terms = [
        ("Проверка", "Аудиторское мероприятие — плановое, внеплановое или тематическое"),
        ("Ключ", "Уникальный идентификатор проверки, например 26IVP01P1"),
        ("Рекомендация", "Требование к подразделению устранить выявленное нарушение"),
        ("Наблюдение", "Вывод аудитора в разделе III аудиторского заключения"),
        ("Объект аудита", "Подразделение банка, которому выдана рекомендация"),
        ("АЗ", "Аудиторское заключение — итоговый документ по проверке"),
        ("ДЗ", "Докладная записка — приложение к АЗ с перечнем рекомендаций по объектам"),
        ("Раздел II", "Раздел АЗ с результатами проверки и таблицей рекомендаций"),
        ("Раздел III", "Раздел АЗ с наблюдениями аудитора"),
        ("ДВА", "Департамент внутреннего аудита"),
        ("СВК", "Система внутреннего контроля"),
        ("СУР", "Система управления рисками"),
        ("СВИК", "Система внутреннего контроля и аудита"),
        ("Существенность", "Уровень важности рекомендации: низкий, средний, высокий (красный)"),
        ("Индикатор", "Визуальный статус исполнения: не указан, в процессе, ожидает, не решено, исполнено"),
        ("Контрольная зона", "Блок в карточке рекомендации для отслеживания исполнения и снятия с контроля"),
        ("Охват департаментов", "Доля подразделений банка, по которым проведены проверки"),
    ]

    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "Термин"
    hdr[1].text = "Определение"
    for cell in hdr:
        set_cell_shading(cell, "1A365D")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    for term, definition in terms:
        row = table.add_row().cells
        row[0].text = term
        row[1].text = definition
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_roadmap(doc: Document) -> None:
    h = doc.add_heading("10. Что в разработке", level=1)
    style_heading(h, 1)

    p = doc.add_paragraph(
        "Система активно развивается. Ниже — функции, которые запланированы или находятся "
        "в стадии реализации. Целевая дата промышленного запуска (go-live) — 1 сентября 2026."
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(11)

    planned = [
        ("Наблюдения (полный модуль)", "Создание, редактирование и хранение наблюдений в базе данных"),
        ("Интеграция с Канцлер", "Обмен документами с системой электронного документооборота"),
        ("Корпоративная авторизация", "Вход через единую систему банка (Keycloak/OIDC)"),
        ("Экспорт планирования", "Выгрузка дашбордов планирования в Excel/PDF"),
        ("Смена пароля", "Возможность сменить пароль в профиле"),
        ("Аудиторское мнение (ИИ)", "Генерация раздела I АЗ с помощью искусственного интеллекта"),
    ]

    for title, desc in planned:
        p = doc.add_paragraph()
        run = p.add_run(f"• {title}: ")
        run.font.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run = p.add_run(desc)
        run.font.name = "Calibri"
        run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_technical(doc: Document) -> None:
    h = doc.add_heading("11. Техническая реализация", level=1)
    style_heading(h, 1)

    intro = (
        "Этот раздел предназначен для IT-специалистов, администраторов и разработчиков, "
        "которым нужен обзор архитектуры SOKOL без погружения в исходный код. "
        "Подробная техническая документация хранится в репозитории проекта."
    )
    p = doc.add_paragraph(intro)
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(11)

    # 11.1 Architecture
    h2 = doc.add_heading("11.1. Архитектура системы", level=2)
    style_heading(h2, 2)

    arch_paragraphs = [
        (
            "SOKOL построена по классической трёхуровневой схеме «клиент — сервер — база данных». "
            "Пользователь работает в веб-браузере; интерфейс (React SPA) обращается к REST API "
            "(FastAPI), который читает и записывает данные в PostgreSQL. Файлы-вложения "
            "(приказы, программы, АЗ, подтверждения) хранятся в объектном хранилище MinIO."
        ),
        (
            "Обработка Word-документов (формирование раздела II АЗ, докладной записки, "
            "парсинг рекомендаций) выполняется на сервере. Генерация раздела I «Аудиторское мнение» "
            "с помощью ИИ опционально подключается через локальный сервис Ollama."
        ),
    ]
    for text in arch_paragraphs:
        p = doc.add_paragraph(text)
        p.paragraph_format.space_after = Pt(6)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    # Architecture diagram as text table
    h3 = doc.add_heading("Схема компонентов", level=3)
    style_heading(h3, 3)

    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, text in enumerate(["Компонент", "Технология", "Назначение"]):
        hdr[i].text = text
        set_cell_shading(hdr[i], "1A365D")
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(10)

    components = [
        ("Веб-интерфейс (UI)", "React 19, TypeScript, Vite 7, Tailwind CSS", "Реестры, формы, аналитика, экспорт"),
        ("HTTP API", "Python 3.12, FastAPI, Pydantic v2", "Бизнес-логика, авторизация, REST-контракты"),
        ("База данных", "PostgreSQL 16", "Проверки, рекомендации, справочники"),
        ("Файловое хранилище", "MinIO (S3-совместимое)", "Вложения к проверкам и рекомендациям"),
        ("Генерация ИИ (опционально)", "Ollama + LLM (qwen3.5:35b)", "Раздел I «Аудиторское мнение»"),
    ]
    for comp, tech, purpose in components:
        row = table.add_row().cells
        row[0].text = comp
        row[1].text = tech
        row[2].text = purpose
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(9)

    doc.add_paragraph()
    flow = doc.add_paragraph(
        "Поток данных: Браузер → React (порт 5180) → FastAPI (порт 8800/8802) → PostgreSQL (5433) "
        "и MinIO. Запросы к /api/v1/* защищены JWT-токеном (Bearer)."
    )
    for run in flow.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run.font.italic = True

    # 11.2 Data model
    h2 = doc.add_heading("11.2. Основные сущности данных", level=2)
    style_heading(h2, 2)

    p = doc.add_paragraph(
        "Центральные объекты предметной области и их связи:"
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(10)

    entities = [
        ("Проверка (Check)", "Аудиторское мероприятие: ключ, название, тип, вид, статус, даты, документы, оценки эффективности"),
        ("Рекомендация (Recommendation)", "Требование к подразделению; привязана к проверке; срок, статус, существенность, контрольная зона"),
        ("Аудитор (Auditor)", "Справочник сотрудников ДВА"),
        ("Департамент / объект аудита", "Подразделение банка — целевой объект рекомендации"),
        ("Вид проверки, вид аудита, оценка эффективности", "Справочники для классификации и отчётности"),
        ("Вложение (Attachment)", "Файл в MinIO с метаданными в БД"),
    ]
    for name, desc in entities:
        p = doc.add_paragraph()
        run = p.add_run(f"{name}: ")
        run.font.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run = p.add_run(desc)
        run.font.name = "Calibri"
        run.font.size = Pt(10)

    # 11.3 API
    h2 = doc.add_heading("11.3. REST API", level=2)
    style_heading(h2, 2)

    api_paragraphs = [
        "Все операции доступны через REST API с префиксом /api/v1. Интерактивная документация (Swagger UI) "
        "доступна по адресу /docs на сервере API.",
        "Основные группы эндпоинтов:",
    ]
    for text in api_paragraphs:
        p = doc.add_paragraph(text)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    api_groups = [
        ("/auth", "Вход (login), профиль текущего пользователя (/me)"),
        ("/checks", "CRUD проверок, экспорт, импорт рекомендаций из АЗ"),
        ("/recommendations", "CRUD рекомендаций, контрольная зона, экспорт"),
        ("/analytics/{checks|recommendations|monitoring|dva|planning}", "Серверные агрегаты для BI-дашбордов"),
        ("/attachments", "Загрузка, скачивание и удаление вложений"),
        ("/settings/*", "Справочники (mutate — только admin)"),
        ("/tools/*", "Генерация и разбор DOCX (Раздел II, ДЗ, парсинг рекомендаций, аудиторское мнение)"),
    ]
    for prefix, desc in api_groups:
        p = doc.add_paragraph(f"• {prefix} — {desc}", style="List Bullet")
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    # 11.4 Security
    h2 = doc.add_heading("11.4. Безопасность и доступ", level=2)
    style_heading(h2, 2)

    security_items = [
        "Аутентификация: JWT-токен после успешного входа (POST /api/v1/auth/login).",
        "Авторизация: роли auditor и admin. Администратор может удалять записи и управлять справочниками.",
        "Все эндпоинты /api/v1/* (кроме health и login) требуют заголовок Authorization: Bearer <token>.",
        "CORS настраивается переменной SOKOL_CORS_ORIGINS (список разрешённых origin фронтенда).",
        "Планируется: корпоративная авторизация через Keycloak/OIDC.",
    ]
    for item in security_items:
        p = doc.add_paragraph(item, style="List Bullet")
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    # 11.5 Deployment
    h2 = doc.add_heading("11.5. Развёртывание", level=2)
    style_heading(h2, 2)

    p = doc.add_paragraph(
        "Система поддерживает два режима запуска:"
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(10)

    deploy_modes = [
        (
            "Docker (коробочный стек)",
            "docker compose up из корня репозитория. Поднимаются PostgreSQL, API и UI. "
            "Ollama запускается отдельно на хосте.",
        ),
        (
            "Локальная разработка",
            "Два процесса: uvicorn (API, порт 8802) и npm run dev (UI, порт 5180). "
            "PostgreSQL — локально или в Docker.",
        ),
    ]
    for title, desc in deploy_modes:
        p = doc.add_paragraph()
        run = p.add_run(f"{title}: ")
        run.font.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run = p.add_run(desc)
        run.font.name = "Calibri"
        run.font.size = Pt(10)

    # Ports table
    h3 = doc.add_heading("Порты и адреса", level=3)
    style_heading(h3, 3)

    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, text in enumerate(["Сервис", "Docker", "Локальная разработка", "Назначение"]):
        hdr[i].text = text
        set_cell_shading(hdr[i], "1A365D")
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(9)

    ports = [
        ("UI (React)", "5180", "5180", "Веб-интерфейс для пользователей"),
        ("API (FastAPI)", "8800", "8802", "REST API и Swagger (/docs)"),
        ("PostgreSQL", "5433", "5433", "База данных"),
        ("Ollama (опционально)", "11434", "11434", "LLM для аудиторского мнения"),
    ]
    for svc, docker, local, purpose in ports:
        row = table.add_row().cells
        row[0].text = svc
        row[1].text = docker
        row[2].text = local
        row[3].text = purpose
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(9)

    # 11.6 Frontend specifics
    h2 = doc.add_heading("11.6. Клиентская часть (UI)", level=2)
    style_heading(h2, 2)

    ui_items = [
        "Одностраничное приложение (SPA) на React 19 с маршрутизацией по вкладкам.",
        "Состояние серверных данных — TanStack Query; HTTP-клиент — Axios с Bearer interceptor.",
        "Аналитика: Recharts для графиков; экспорт — xlsx-js-style, docx, pdfmake, html-to-image.",
        "Единые токены оформления форм — src/constants/formLayout.ts.",
        "Профиль пользователя (имя, аватар) хранится в localStorage браузера.",
    ]
    for item in ui_items:
        p = doc.add_paragraph(item, style="List Bullet")
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    # 11.7 Integrations
    h2 = doc.add_heading("11.7. Интеграции и расширения", level=2)
    style_heading(h2, 2)

    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, text in enumerate(["Интеграция", "Статус", "Описание"]):
        hdr[i].text = text
        set_cell_shading(hdr[i], "1A365D")
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.name = "Calibri"
                run.font.size = Pt(9)

    integrations = [
        ("Ollama (LLM)", "Реализовано", "Генерация раздела I АЗ; требует локальный ollama serve"),
        ("MinIO (S3)", "Реализовано", "Хранение вложений; настраивается через SOKOL_MINIO_*"),
        ("Keycloak / OIDC", "В разработке", "Корпоративный SSO вместо локальных учётных записей"),
        ("Канцлер (ЭДО)", "В разработке", "Обмен документами с системой документооборота банка"),
    ]
    for name, status, desc in integrations:
        row = table.add_row().cells
        row[0].text = name
        row[1].text = status
        row[2].text = desc
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(9)

    # 11.8 Repo structure
    h2 = doc.add_heading("11.8. Структура репозитория", level=2)
    style_heading(h2, 2)

    repo_items = [
        "sokol/ — корень: docker-compose.yml, PLAN.md, DOCKER.md",
        "sokol-backend/ — FastAPI API, модели, CRUD, сервисы аналитики и DOCX, тесты",
        "sokol-frontend/ — React UI, компоненты, API-клиент, аналитика",
        "sokol-instruments/ — legacy Streamlit-прототип (не входит в основной стек)",
        "sokol-backend/docs/ — архитектура, API, БД, миграции, отчёты",
        "sokol-frontend/docs/ — UX, аналитика, runbook",
    ]
    for item in repo_items:
        p = doc.add_paragraph(item, style="List Bullet")
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    add_horizontal_line(doc)


def add_section_screenshots(doc: Document) -> None:
    h = doc.add_heading("12. Места для скриншотов", level=1)
    style_heading(h, 1)

    p = doc.add_paragraph(
        "Ниже — рекомендуемые места для вставки скриншотов интерфейса. "
        "Замените серые блоки-заглушки на актуальные изображения экранов системы (PNG или JPG, "
        "ширина 1200–1600 px для читаемости в Confluence)."
    )
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(11)

    screenshots = [
        ("Рис. 1. Страница входа в систему", "Экран авторизации с полями логин и пароль"),
        ("Рис. 2. Главное меню и список проверок", "Левое меню навигации и таблица проверок"),
        ("Рис. 3. Карточка проверки", "Форма создания/редактирования проверки"),
        ("Рис. 4. Список рекомендаций", "Таблица рекомендаций с цветовыми индикаторами"),
        ("Рис. 5. Карточка рекомендации", "Форма рекомендации с контрольной зоной"),
        ("Рис. 6. Аналитика — вкладка «Проверки»", "Дашборд с KPI и графиками"),
        ("Рис. 7. Аналитика — вкладка «ДВА»", "Портфель и нагрузка аудиторов"),
        ("Рис. 8. Планирование", "Охват департаментов и красные рекомендации"),
        ("Рис. 9. Инструменты Word", "Вкладка инструментов с загрузкой документов"),
        ("Рис. 10. Настройки — справочники", "Управление справочниками (для администратора)"),
    ]

    for caption, hint in screenshots:
        h3 = doc.add_heading(caption, level=3)
        style_heading(h3, 3)

        # Placeholder box
        table = doc.add_table(rows=1, cols=1)
        table.style = "Table Grid"
        cell = table.rows[0].cells[0]
        set_cell_shading(cell, "F0F0F0")
        cell.height = Cm(6)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(f"[ Вставьте скриншот: {hint} ]")
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.color.rgb = COLOR_MUTED
        run.font.italic = True

        doc.add_paragraph()


def add_section_confluence(doc: Document) -> None:
    h = doc.add_heading("Приложение А. Публикация в Confluence", level=1)
    style_heading(h, 1)

    intro = (
        "Документ подготовлен для загрузки в Jira Confluence. Ниже — рекомендуемый порядок "
        "публикации и советы по форматированию."
    )
    p = doc.add_paragraph(intro)
    for run in p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(11)

    steps = [
        (
            "Создание страницы",
            "В нужном пространстве Confluence создайте страницу «SOKOL — документация продукта» "
            "(или дочернюю страницу в разделе ДВА / IT).",
        ),
        (
            "Импорт документа",
            "Вариант 1 — импорт Word: «…» → Import → Word (.docx) → выберите этот файл. "
            "Confluence сохранит заголовки, таблицы и нумерованные списки. "
            "Вариант 2 — копирование: откройте .docx в Word и вставьте содержимое на страницу "
            "(Ctrl+A → Ctrl+C → Ctrl+V в редактор Confluence).",
        ),
        (
            "Скриншоты",
            "В разделе 12 замените серые блоки-заглушки на изображения интерфейса. "
            "В Confluence: перетащите PNG/JPG в место заглушки или используйте /image.",
        ),
        (
            "Макросы (опционально)",
            "Для оглавления на странице Confluence добавьте макрос Table of Contents после заголовка "
            "«Содержание». Для диаграмм архитектуры — макрос Mermaid или вставка PNG-схемы.",
        ),
        (
            "Метки (labels)",
            "Рекомендуемые метки страницы: sokol, dva, internal-audit, product-doc, bi.",
        ),
        (
            "Права доступа",
            "Ограничьте редактирование страницы группой владельцев продукта; просмотр — "
            "для сотрудников ДВА и заинтересованных подразделений.",
        ),
        (
            "Версионирование",
            "При обновлении документа измените дату на титульной странице, перегенерируйте .docx "
            "и обновите страницу Confluence (или создайте дочернюю «История изменений»).",
        ),
    ]

    for i, (title, text) in enumerate(steps, 1):
        h3 = doc.add_heading(f"Шаг {i}. {title}", level=3)
        style_heading(h3, 3)
        p = doc.add_paragraph(text)
        for run in p.runs:
            run.font.name = "Calibri"
            run.font.size = Pt(10)

    doc.add_paragraph()
    note = doc.add_paragraph(
        "Техническая документация для разработчиков (архитектура, API, БД, миграции) "
        "ведётся отдельно в репозитории Git и не дублируется на этой странице."
    )
    for run in note.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run.font.italic = True
        run.font.color.rgb = COLOR_MUTED


def build_document() -> Document:
    doc = Document()

    # Default font
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    # Page margins
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2)

    add_title_page(doc)
    add_toc_placeholder(doc)
    add_section_about(doc)
    add_section_business_value(doc)
    add_section_audience(doc)
    add_section_features(doc)
    add_section_user_stories(doc)
    add_section_howto(doc)
    add_section_roles(doc)
    add_section_analytics(doc)
    add_section_glossary(doc)
    add_section_roadmap(doc)
    add_section_technical(doc)
    add_section_screenshots(doc)
    add_section_confluence(doc)

    return doc


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = build_document()
    try:
        doc.save(str(OUTPUT))
        print(f"Saved: {OUTPUT}")
    except PermissionError:
        doc.save(str(OUTPUT_CONFLUENCE))
        print(f"Original file locked; saved copy: {OUTPUT_CONFLUENCE}")


if __name__ == "__main__":
    main()
