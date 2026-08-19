# Генерация и разбор документов

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`.

## Общие правила

- Только `.docx`, лимит `SOKOL_MAX_UPLOAD_MB` (default 100).
- Upload стримится в temp чанками → `asyncio.to_thread` → `FileResponse` + cleanup.

## Раздел II ✅

**Endpoints:** `POST /tools/section-ii`, `POST /tools/section-ii-links`

OOXML (ZIP/XML): парсинг Раздела III → таблица после Раздела I. Модули: `section_ii/docx_parser`, `table_builder`, `bookmark_utils`, …

## Докладная ✅

**Endpoint:** `POST /tools/memorandum`  
**Связанный:** `POST /tools/parse-recommendations` — JSON для импорта на форме проверки.

## Audit opinion — backlog ❌

Контракт `POST /tools/audit-opinion` не входит в текущий `API.md`: код, routes и UI отсутствуют. LLM/Ollama не подключены.

До реализации — не документировать как рабочий endpoint.

## Ограничения

CPU-bound в thread pool · XML всё ещё в RAM во время парсинга · результаты не в storage · хрупкость к нестандартной вёрстке АЗ.
