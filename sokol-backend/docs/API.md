# HTTP API

Базовый prefix: **`/api/v1`** (из `Settings.api_v1_prefix`).

Интерактивная документация: `http://127.0.0.1:8802/docs` (порт из `run_dev.ps1`).

Auth: **internal JWT** (Bearer). Публичны только `GET /`, `GET /api/v1/status` и `GET /api/v1/capabilities`.  
Роли: `auditor` (домен read/write), `admin` (справочники mutate + все DELETE).

Логин: `POST /api/v1/auth/login` → `{ access_token, role, username, display_name }`.  
Профиль: `GET /api/v1/auth/me`.

Пользователи: env `SOKOL_AUTH_USERS` (JSON) или локальные defaults `Админ А.А.`/`admin`, `Аудитор А.А.`/`auditor`.

Общий формат списков: `{ "items": [...], "total": N }`.

---

## Health

| Method | Path | Ответ |
|--------|------|--------|
| `GET` | `/api/v1/status` | статус сервиса |
| `GET` | `/api/v1/capabilities` | runtime capabilities: `max_upload_mb`, `max_upload_bytes` |
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

**Поля create/PATCH (основные):**  
`check_name`, `short_name?`, `check_type`, `check_view`, `start_date`, `end_date?`, `check_leader`, `status`, `created_at`, `description?`, оценки эффективности (`process_effectiveness`, `svk_effectiveness`, `sur_effectiveness`, `svik_effectiveness`), документы приказа/программы/АЗ/ДЗ (`*_document_number`, `*_document_date`). `serial_number` не принимается от клиента: backend генерирует его на create и пересчитывает на PATCH при смене `start_date` / `check_leader` / `check_type`.

**Read:** `CheckRead` дополнительно возвращает `id`, `serial_number`, `created_at`.

**Валидация справочников (create/PATCH):** `check_leader` ∈ auditors, `check_view` ∈ check_kinds, непустые `*_effectiveness` ∈ effectiveness_ratings; иначе **400**.

---

## Analytics — `/api/v1/analytics`

Все агрегаты считаются на сервере по всей БД (без лимита list API). Ответы в camelCase.

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/analytics/checks` | вкладка «Проверки» |
| `GET` | `/analytics/recommendations` | вкладка «Рекомендации» |
| `GET` | `/analytics/monitoring` | вкладка «Мониторинг» (срез исполнения сроков) |
| `GET` | `/analytics/dva` | вкладка «ДВА» |
| `GET` | `/analytics/planning` | раздел «Планирование» |

**Общие query:**

| Параметр | Тип | Notes |
|----------|-----|--------|
| `granularity` | `year` \| `quarter` \| `month` | default `year` |
| `years`, `quarters`, `months` | list[str] | ключи периодов (`2025`, `2025-Q1`, `2025-08`); OR между измерениями |
| `auditors`, `departments` | list[str] | фильтры ФИО / объект аудита |

**Дополнительно для recommendations/monitoring:** `statuses`, `additionalStatuses`, `materialityLevels`.

Подробнее: [ANALYTICS.md](../../sokol-frontend/docs/ANALYTICS.md), [PLANNING.md](../../sokol-frontend/docs/PLANNING.md).

---

## Attachments — `/api/v1/attachments`

Метаданные в PostgreSQL, файлы в MinIO. См. [STORAGE.md](STORAGE.md).

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/attachments/storage/status` | доступность хранилища |
| `GET` | `/attachments` | список (`entity_type`, `entity_id`) |
| `POST` | `/attachments` | multipart upload |
| `GET` | `/attachments/{id}/download` | скачивание |
| `DELETE` | `/attachments/{id}` | удаление object + row |

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

Дополнительно: `sequence_number`, `description`, `observation_name`, `indicator`, `materiality_level`, поля продлений и снятия с контроля, `closure_*`.

**Валидация справочников (create/PATCH):** `auditor` ∈ auditors; иначе **400**.  
`manager` (руководитель объекта аудита) — свободный текст, без проверки по справочнику.

Фильтры списка — см. endpoint/crud (`check_id`, `search`, статусы и т.д. в коде `recommendations.py`). `search` ищет по названию рекомендации, названию наблюдения, описанию, объекту аудита, аудитору, руководителю и ключу проверки.

---

## Settings

### Auditors — `/api/v1/settings/auditors`

CRUD по UUID. Тело: `{ "full_name": "..." }`.

### Audit types — `/api/v1/settings/audit_types`

CRUD по UUID. Тело: `{ "code": "...", "name": "..." }`.

### Check kinds — `/api/v1/settings/check_kinds`

CRUD по UUID. Тело: `{ "label": "..." }`. Справочник «Виды проверок».

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

- OIDC / Keycloak (есть internal JWT + RBAC).
- Alembic HTTP; schema — `create_all` + CLI `migrate_*.py`.
- WebSocket, batch-import Excel через HTTP API (import — CLI `app.db.import_seed_data`).
- CRUD наблюдений.
- Drill-down / сохранённые серверные отчёты аналитики.
- Смена пароля / управление пользователями через API (пользователи из env).

---

## Соглашения об ошибках

- FastAPI validation → 422.
- Доменные «не найдено» → 404 с русским `detail`.
- DOCX business errors → 400.
- CORS: заголовок Origins из env; при `*` credentials отключены.
