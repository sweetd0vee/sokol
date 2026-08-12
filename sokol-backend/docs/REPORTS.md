# Генерация и разбор документов

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`.

## Общие правила

- Только `.docx`, лимит `SOKOL_MAX_UPLOAD_MB` (default 100).
- Файл в память → temp → `asyncio.to_thread` → cleanup.

## Раздел II

**Endpoints:** `POST /tools/section-ii`, `POST /tools/section-ii-links`

**Оркестратор:** `section_ii/docx_generator.process_document()`

Вставляет таблицу Раздела II после Раздела I, парся наблюдения из Раздела III. Работает через ZIP/XML (не python-docx) — сохраняет титул и оглавление.

**Шаги:**

1. Копия исходного DOCX
2. Удаление ранее сгенерированного Раздела II
3. Парсинг наблюдений Раздела III
4. Опционально — bookmarks `SokolObs*` (режим hyperlinks)
5. Вставка heading + table XML + иконки материальности
6. Валидация prefix / границ страниц

**Модули:** `docx_parser`, `docx_blocks`, `field_parser`, `table_builder`, `xml_utils`, `bookmark_utils`, `observation_links`, `heading_detection`.

**Тесты:** `test_section_ii_parser.py`, `test_bookmark_utils.py`, `test_observation_links.py`.

## Докладная записка

**Endpoint:** `POST /tools/memorandum`

АЗ с готовым Разделом II → новый DOCX через python-docx. Без Раздела II — **400**.

**Связанный парсинг:** `POST /tools/parse-recommendations` — JSON для импорта рекомендаций на форме проверки.

## Раздел I (Ollama)

**Endpoints:**

- `GET /tools/audit-opinion/default-prompt`
- `GET /tools/audit-opinion/models`
- `POST /tools/audit-opinion`

Наблюдения → Ollama chat → правка раздела I в DOCX.

**Env:** `SOKOL_OLLAMA_URL`, `SOKOL_OLLAMA_MODEL`, `SOKOL_OLLAMA_TIMEOUT_S`.

Без Ollama — **502**. Frontend timeout: 600s.

## Ограничения

- CPU-bound на HTTP worker, нет очереди/прогресса.
- Upload целиком в RAM.
- Результаты не сохраняются в storage.
- Хрупкость к нестандартной вёрстке АЗ.
