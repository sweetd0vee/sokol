# Генерация и разбор документов

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`. Нужна авторизация.

## Общие правила

- Вход DOCX: только `.docx`, лимит `SOKOL_MAX_UPLOAD_MB` (default 100). Upload стримится в temp чанками → `asyncio.to_thread` → `FileResponse` + cleanup.
- Файл контроля: вход АЗ `.docx`, выход XLSX.

## Раздел II

`POST /tools/section-ii` и `/tools/section-ii-links` — OOXML (ZIP/XML): парсинг Раздела III → таблица после Раздела I. Ссылки: bookmarks/hyperlinks к наблюдениям. Имена: `*_section_ii.docx` / `*_section_ii_links.docx`.

Модули: `section_ii/docx_parser`, `table_builder`, `bookmark_utils`, …

## Докладная

`POST /tools/memorandum` — ДЗ из АЗ (`*_dz.docx`). Объекты аудита канонизируются по `departments`.

`POST /tools/parse-recommendations` — JSON для формы проверки:

```json
{ "name": "...", "observation_name": "...", "audit_object": ["..."], "manager": "...", "deadline": "YYYY-MM-DD" }
```

`audit_object` канонизируется по справочнику; неизвестное подразделение → **400**.

## Файл контроля

| Path | Поведение |
|------|-----------|
| `GET /tools/control-file-template` | пустой XLSX (`data/файл контроля шаблон (шапка).xlsx`) |
| `POST /tools/control-file` | из АЗ; form: `file`, `check_leader`, `check_date` |

Дата: `YYYY-MM-DD` или `DD.MM.YYYY`, в шаблон пишется `DD.MM.YYYY`. Результат: `*_control.xlsx`. Код: `services/reports/control_file/`.

## Ошибки

Парсинг/валидация документа → **400**. Файл не создан → **500**. Слишком большой → **413**. Шаблон контроля отсутствует → **404**.

`POST /tools/audit-opinion` нет (backlog). LLM не подключён.

Ограничения: CPU-bound в thread pool · XML в RAM · результаты не в MinIO · хрупкость к нестандартной вёрстке АЗ.
