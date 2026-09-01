# Генерация и разбор документов

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`.

## Общие правила

- DOCX-инструменты принимают только `.docx`, лимит `SOKOL_MAX_UPLOAD_MB` (default 100).
- Файл контроля отдаёт/принимает XLSX на выходе; вход по-прежнему АЗ в `.docx`.
- Upload стримится в temp чанками → `asyncio.to_thread` → `FileResponse` + cleanup.

## Раздел II ✅

**Endpoints:** `POST /tools/section-ii`, `POST /tools/section-ii-links`

OOXML (ZIP/XML): парсинг Раздела III → таблица после Раздела I. Модули: `section_ii/docx_parser`, `table_builder`, `bookmark_utils`, …

## Докладная ✅

**Endpoint:** `POST /tools/memorandum`  
**Связанный:** `POST /tools/parse-recommendations` — JSON для импорта на форме проверки.

Элемент parse-recommendations: `{ name, observation_name, audit_object: [str], manager, deadline }`.  
`audit_object` канонизируется по справочнику подразделений.

## Файл контроля ✅

| Method | Path | Поведение |
|--------|------|-----------|
| `GET` | `/tools/control-file-template` | Скачать пустой XLSX-шаблон (`data/файл контроля шаблон (шапка).xlsx`) |
| `POST` | `/tools/control-file` | Собрать файл контроля из АЗ |

`POST` — multipart: `file` (АЗ `.docx`), `check_leader`, `check_date`. Дата принимается как `YYYY-MM-DD` или `DD.MM.YYYY` и пишется в шаблон как `DD.MM.YYYY`. Результат: `*_control.xlsx`.

Код: `services/reports/control_file/` (`generator.py`, `parser.py`, `title_parser.py`). Использует таблицу Раздела II АЗ.

## Audit opinion — backlog ❌

Контракт `POST /tools/audit-opinion` не входит в текущий `API.md`: код, routes и UI отсутствуют. LLM/Ollama не подключены.

До реализации — не документировать как рабочий endpoint.

## Ограничения

CPU-bound в thread pool · XML всё ещё в RAM во время парсинга · результаты не в storage · хрупкость к нестандартной вёрстке АЗ.
