# Генерация и разбор документов

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`. Общий upload: `app/api/uploads.py`. Нужна авторизация. Очередь слотов: `docx_queue.py`.

## Общие правила

- Вход DOCX: только `.docx`, лимит `SOKOL_MAX_UPLOAD_MB` (default 100). Upload стримится в temp чанками → очередь слотов (`docx_queue`: `SOKOL_DOCX_MAX_CONCURRENT` / `SOKOL_DOCX_MAX_QUEUE` / `SOKOL_DOCX_QUEUE_WAIT_SECONDS`) → `asyncio.to_thread` → `FileResponse` + cleanup.
- Переполнение / timeout очереди → **503** (+ `Retry-After`). Лимиты отдаёт `GET /capabilities`.
- Файл контроля: вход АЗ `.docx`, выход XLSX. Если таблицы Раздела II нет, парсер берёт наблюдения раздела III (shared parsers с memorandum).

## Раздел II

`POST /tools/section-ii` и `/tools/section-ii-links` — OOXML (ZIP/XML): парсинг Раздела III → таблица после Раздела I. Ссылки: bookmarks/hyperlinks к наблюдениям (`observation_links`, `heading_detection`). Имена: `*_section_ii.docx` / `*_section_ii_links.docx`.

Модули: `ooxml`, `docx_package`, `section_ii/document_xml`, `run_slices`, `docx_parser`, `table_builder`, `bookmark_utils`, `materiality_images`.

## Докладная

`POST /tools/memorandum` — ДЗ из АЗ (`*_dz.docx`). Объекты аудита канонизируются по `departments`. Парсеры: `section_ii_table_parser`, `memorandum_doc_parser`. Картинки существенности — `get_materiality_images_dir()`.

`POST /tools/parse-recommendations` — JSON для формы проверки (`az_import.py`):

```json
{ "name": "...", "observation_name": "...", "audit_object": ["..."], "manager": "...", "deadline": "YYYY-MM-DD" }
```

`observation_name` может быть пустой строкой. `audit_object` канонизируется по справочнику; неизвестное подразделение → **400**.

## Файл контроля

| Path | Поведение |
|------|-----------|
| `GET /tools/control-file-template` | пустой XLSX (`get_control_file_template_path()` → `sokol-backend/data/файл контроля шаблон (шапка).xlsx`) |
| `POST /tools/control-file` | из АЗ; form: `file`, `check_leader`, `check_date` |

Дата: `YYYY-MM-DD` или `DD.MM.YYYY`, в шаблон пишется `DD.MM.YYYY`. Результат: `*_control.xlsx`. Код: `services/reports/control_file/` (`generator`, `parser`, `responsible`, `title_parser`).

## Ошибки

Парсинг/валидация документа → **400**. Файл не создан → **500**. Слишком большой → **413**. Шаблон контроля отсутствует → **404**. Очередь полна → **503**.

Ограничения: CPU-bound в thread pool под лимитом слотов · XML в RAM · результаты не в MinIO · нестандартная вёрстка АЗ может разобраться неполно, но content-control и таблица/наблюдения имеют запасные пути.
