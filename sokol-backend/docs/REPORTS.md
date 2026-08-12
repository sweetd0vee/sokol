# Генерация и разбор документов

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`.

## Общие правила

- Только `.docx`, лимит `SOKOL_MAX_UPLOAD_MB` (default 100).
- Файл в память → temp → `asyncio.to_thread` → cleanup.

## Раздел II ✅

**Endpoints:** `POST /tools/section-ii`, `POST /tools/section-ii-links`

OOXML (ZIP/XML): парсинг Раздела III → таблица после Раздела I. Модули: `section_ii/docx_parser`, `table_builder`, `bookmark_utils`, …

## Докладная ✅

**Endpoint:** `POST /tools/memorandum`  
**Связанный:** `POST /tools/parse-recommendations` — JSON для импорта на форме проверки.

## Audit opinion (Ollama) — planned ❌

В `API.md` и env (`SOKOL_OLLAMA_*`) описан контракт `POST /tools/audit-opinion`, но **код не реализован** (`app/services/reports/audit_opinion/` отсутствует). UI тоже нет.

До реализации — не документировать как рабочий endpoint.

## Ограничения

CPU-bound на worker · upload в RAM · результаты не в storage · хрупкость к нестандартной вёрстке АЗ.
