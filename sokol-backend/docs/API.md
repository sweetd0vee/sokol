# HTTP API

Базовый prefix: **`/api/v1`** (из `Settings.api_v1_prefix`).

Интерактивная документация: `http://127.0.0.1:8802/docs` (порт из `run_dev.ps1`).

Auth: **отсутствует**. Все endpoints открыты.

Общий формат списков: `{ "items": [...], "total": N }`.

---

## Health

| Method | Path | Ответ |
|--------|------|--------|
| `GET` | `/api/v1/status` | статус сервиса |
| `GET` | `/` | `{ "service": "SOKOL API", "version": "v1" }` |

---

## Checks — `/api/v1/checks`

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/checks` | создать (201, `CheckRead`) |
| `GET` | `/checks` | список |
| `GET` | `/checks/{check_id}` | одна запись |
| `PATCH` | `/checks/{check_id}` | частичное обновление |
| `DELETE` | `/checks/{check_id}` | 204; cascade на рекомендации |

**Query (`GET` list):**

| Параметр | Тип | Default | Notes |
|----------|-----|---------|-------|
| `skip` | int ≥ 0 | 0 | |
| `limit` | 1…1000 | 200 | |
| `search` | string | — | min_length 1 |
| `status` | enum | — | `not_started` \| `in_progress` \| `completed` |
| `check_type` | string | — | |

**Поля create/read (основные):**  
`serial_number`, `check_name`, `check_type`, `check_view`, `start_date`, `end_date?`, `check_leader`, `status`, `created_at`, `description?`, документы приказа/программы/АЗ/ДЗ (`*_document_number`, `*_document_date`).

---

## Recommendations — `/api/v1/recommendations`

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/recommendations` | создать (201) |
| `GET` | `/recommendations` | список |
| `GET` | `/recommendations/{id}` | одна |
| `PATCH` | `/recommendations/{id}` | обновление |
| `DELETE` | `/recommendations/{id}` | 204 |

**Статусы (актуальные enum’ы модели):**

| Поле | Значения |
|------|----------|
| `status` | `completed`, `unresolved`, `on_control`, `in_progress` |
| `additional_status` | `on_time`, `deadline_violated`, `on_control` |

Дополнительно: `sequence_number`, `description`, `indicator`, `materiality_level`, поля продлений и снятия с контроля, `closure_*`.

Фильтры списка — см. endpoint/crud (`check_id`, `search`, статусы и т.д. в коде `recommendations.py`).

---

## Settings

### Auditors — `/api/v1/settings/auditors`

CRUD по UUID. Тело: `{ "full_name": "..." }`.

### Audit types — `/api/v1/settings/audit_types`

CRUD по UUID. Тело: `{ "code": "...", "name": "..." }`.

### Effectiveness ratings — `/api/v1/settings/effectiveness_ratings`

CRUD по UUID. Тело: `{ "label": "..." }`.

Паттерн везде: `POST`, `GET` (list + total), `GET/{id}`, `PATCH/{id}`, `DELETE/{id}`.

---

## Tools — `/api/v1/tools`

Все операции — `multipart/form-data`, поле **`file`** (`.docx`).

Лимит размера: `SOKOL_MAX_UPLOAD_MB` (default **100**).  
MIME: OOXML DOCX или `application/octet-stream`.  
Тяжёлая работа: `asyncio.to_thread`. Временные файлы чистятся через `BackgroundTasks`.

| Method | Path | Ответ | Поведение |
|--------|------|-------|-----------|
| `POST` | `/tools/section-ii` | `application/vnd...document` | Раздел II без гиперссылок; имя `*_section_ii.docx` |
| `POST` | `/tools/section-ii-links` | DOCX | То же + bookmarks/hyperlinks к наблюдениям; `*_section_ii_links.docx` |
| `POST` | `/tools/memorandum` | DOCX | ДЗ из АЗ с готовым Разделом II; `*_dz.docx` |
| `POST` | `/tools/parse-recommendations` | `application/json` | массив рекомендаций из таблицы Раздела II АЗ |
| `GET` | `/tools/audit-opinion/default-prompt` | JSON `{ "prompt": "..." }` | дефолтный промпт для раздела I |
| `GET` | `/tools/audit-opinion/models` | JSON `{ "models": [...], "default_model": "..." }` | список моделей Ollama; **502**, если Ollama недоступна |
| `POST` | `/tools/audit-opinion` | DOCX | раздел I «Аудиторское мнение»; имя `*_section_i.docx` |

**`POST /tools/audit-opinion`** — `multipart/form-data`:

| Поле | Тип | Описание |
|------|-----|----------|
| `file` | файл `.docx` | исходный АЗ |
| `prompt` | string (form) | опционально; пусто → дефолтный промпт |
| `model` | string (form) | опционально; пусто → `SOKOL_OLLAMA_MODEL` |

Ошибки Ollama → **502**. Timeout клиента на фронте: **600s** (остальные tools — 120s).

**`ParsedRecommendationItem`:**

```json
{
  "name": "текст рекомендации",
  "audit_object": "объект",
  "manager": "руководитель",
  "deadline": "YYYY-MM-DD или пустая строка"
}
```

Ошибки парсинга/валидации документа: **400** с `detail` (строка).  
Файл не создан: **500**. Слишком большой: **413**.

---

## Чего нет в API

- `/api/v1/analytics/*` — фронт (`fetchAnalyticsByPerson`) ожидает endpoint, backend его **не реализует**.
- Auth, upload вложений проверок, WebSocket, batch-import Excel через API.

---

## Соглашения об ошибках

- FastAPI validation → 422.
- Доменные «не найдено» → 404 с русским `detail`.
- DOCX business errors → 400.
- CORS: заголовок Origins из env; при `*` credentials отключены.
