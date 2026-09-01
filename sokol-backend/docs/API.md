# HTTP API

Базовый prefix: **`/api/v1`** (из `Settings.api_v1_prefix`).

Интерактивная документация: `http://127.0.0.1:8802/docs`.

Auth: **internal JWT** (Bearer). Публичны только `GET /`, `GET /api/v1/status`, `GET /api/v1/capabilities` и `POST /api/v1/auth/login`.  
`GET /api/v1/auth/me` и `POST /api/v1/auth/change-password` требуют авторизации (роутер `auth` публичный только для login).  
HTTP Basic принимается в `development` (и если `SOKOL_ENABLE_BASIC_AUTH=true`); в `SOKOL_ENV=prod` по умолчанию выключен. Деактивированные пользователи не проходят ни Bearer, ни Basic. Авторизация идёт по роли из БД, не только из JWT.

**Роли:** `auditor`, `department_head`, `admin`.  
`ADMIN_ROLES = {admin, department_head}` — всё, что проверяет `require_admin` / `user.is_admin`, доступно обеим ролям одинаково.

| Действие | `auditor` | `admin` / `department_head` |
|----------|-----------|-----------------------------|
| CRUD checks/recommendations (create/read/update) | ✅ | ✅ |
| `DELETE /checks/{id}` | ❌ | ✅ |
| `DELETE /recommendations/{id}` | только своя (`auditor` ↔ username) | ✅ |
| `POST /recommendations/batch-delete` | только свои ids | ✅ |
| Upload/delete attachment (recommendation) | только своя рекомендация | ✅ |
| Upload attachment (check) | ✅ | ✅ |
| `DELETE /attachments/{id}` (check) | ❌ | ✅ |
| Settings CRUD (mutate) | ❌ | ✅ |
| `GET/POST /users` | ❌ | ✅ |
| Analytics / tools | ✅ | ✅ |

Сопоставление «своей» рекомендации: поле `auditor` сравнивается с `username` через `person_match` (краткое/полное ФИО).

Логин: `POST /api/v1/auth/login` → `{ access_token, token_type: "bearer", role, username, display_name }`.  
Профиль: `GET /api/v1/auth/me` → `{ username, display_name, role }` (без `id`, без аватара).  
Пользователи: таблица `users` (seed/sync из канонического списка).  
`POST /api/v1/auth/change-password` — `{ current_password, new_password }` (min 4), ответ **204**.

Общий формат списков: `{ "items": [...], "total": N }`.

---

## Health

| Method | Path | Ответ |
|--------|------|--------|
| `GET` | `/api/v1/status` | `{ "status": "ok" }` |
| `GET` | `/api/v1/capabilities` | `{ "max_upload_mb", "max_upload_bytes" }` |
| `GET` | `/` | `{ "service": "SOKOL API", "version": "v1" }` |

---

## Checks — `/api/v1/checks`

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/checks` | создать (201, `CheckRead`) |
| `GET` | `/checks` | список |
| `GET` | `/checks/{check_id}` | одна запись |
| `PATCH` | `/checks/{check_id}` | частичное обновление |
| `DELETE` | `/checks/{check_id}` | 204; cascade на рекомендации; **admin only** |

**Query (`GET` list):**

| Параметр | Тип | Default | Notes |
|----------|-----|---------|-------|
| `skip` | int ≥ 0 | 0 | |
| `limit` | 1…10000 | 200 | |
| `search` | string | — | min_length 1 |
| `status` | enum | — | `not_started` \| `in_progress` \| `completed` |
| `check_type` | string | — | `planned` \| `unscheduled` \| `thematic` |

**Поля create/PATCH (основные):**  
`check_name`, `short_name?`, `check_type`, `check_view`, **`check_quarter`** (1–4, обязателен на create), `start_date`, `end_date?`, `check_leader`, `status`, `created_at`, `description?`, оценки эффективности (`process_effectiveness`, `svk_effectiveness`, `sur_effectiveness`, `svik_effectiveness`), документы приказа/программы/АЗ/ДЗ (`*_document_number`, `*_document_date`). `serial_number` не принимается от клиента: backend генерирует его на create и пересчитывает на PATCH при смене `start_date` / `check_quarter` / `check_leader` / `check_type`.

**Read:** `CheckRead` дополнительно возвращает `id`, `serial_number`, `created_at`.

**Валидация справочников (create/PATCH):** `check_leader` ∈ auditors, `check_view` ∈ check_kinds, непустые `*_effectiveness` ∈ effectiveness_ratings; иначе **400**. Физические FK не дают записать неизвестные labels.

---

## Analytics — `/api/v1/analytics`

Все агрегаты считаются на сервере по всей БД (без лимита list API). Ответы в camelCase. Отдельных таблиц аналитики нет.

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
| `auditors`, `departments` | list[str] | фильтры ФИО / объект аудита; **planning не принимает `auditors`** |

**Дополнительно для recommendations/monitoring:** `statuses`, `additionalStatuses`, `materialityLevels`.

Подробнее: [ANALYTICS.md](../../sokol-frontend/docs/ANALYTICS.md), [PLANNING.md](../../sokol-frontend/docs/PLANNING.md).

---

## Attachments — `/api/v1/attachments`

Метаданные в PostgreSQL, файлы в MinIO. См. [STORAGE.md](STORAGE.md).

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/attachments/storage/status` | `{ enabled, reachable, bucket_layout }` |
| `GET` | `/attachments` | список; обязательны `entity_type`, `entity_id`; опционально `slot` |
| `POST` | `/attachments` | multipart: `entity_type`, `entity_id`, `slot`, `file`; recommendation — владелец или admin; check — любой authenticated |
| `GET` | `/attachments/{id}/download` | скачивание |
| `DELETE` | `/attachments/{id}` | удаление object + row; recommendation — владелец или admin; check — **admin only** |

Слоты check: `order`, `program`, `az`, `dz`, `dz_appendix`.  
Слоты recommendation: `recommendation_files`, `control_removal_files`.

Ошибки: слот/пустое тело → **400**; слишком большой файл → **413**; неподдерживаемый MIME → **415**; MinIO недоступен → **502**; нет прав → **403**.

---

## Recommendations — `/api/v1/recommendations`

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/recommendations` | создать (201) |
| `POST` | `/recommendations/batch` | atomic append/replace для проверки (201, `{ items, total }`); `mode` = `append` \| `replace`, до 200 items |
| `POST` | `/recommendations/batch-delete` | удалить несколько ids в одной transaction (204, 1…200 ids); та же модель владения, что и `DELETE /{id}` |
| `GET` | `/recommendations` | список |
| `GET` | `/recommendations/{id}` | одна |
| `PATCH` | `/recommendations/{id}` | обновление |
| `DELETE` | `/recommendations/{id}` | 204; admin — любая; auditor — только своя |

**Query (`GET` list):** `skip` (≥0, default 0), `limit` (1…10000, default 200), `search?`, `serial_number?`.

**Статусы (актуальные enum’ы модели):**

| Поле | Значения |
|------|----------|
| `status` | `completed`, `unresolved`, `on_control`, `in_progress` |
| `additional_status` | `on_time`, `deadline_violated`, `on_control` |

Дополнительно: `sequence_number`, `description`, `observation_name`, `indicator` (default `не указан`), **`additional_indicator`** (default `не указан`), `materiality_level` (default `средний`), `audit_object: list[str]`, поля продлений и снятия с контроля, `deadline_extensions` / `control_removals` (`{date?, comment?}`), `closure_*`.

**Валидация справочников (create/PATCH):** `auditor` ∈ auditors; иначе **400**.  
`manager` (руководитель объекта аудита) — свободный текст, без проверки по справочнику.  
`audit_object` канонизируется по `departments`; неизвестное подразделение → **400**.

`search` ищет по названию рекомендации, названию наблюдения, описанию, объекту аудита, аудитору, руководителю и ключу проверки.

---

## Settings

Паттерн везде: `POST`, `GET` (list + total), `GET/{id}`, `PATCH/{id}`, `DELETE/{id}`.  
List query: `skip` (default 0), `limit` (1…200, default 50), `search?`.  
Мутации — **admin only**. Дубликаты labels → **409** (кроме `audit_types`).  
Удаление значения, которое используется в checks/recommendations → **409**.  
Системный департамент «Не указан» нельзя удалить или переименовать → **409**.  
Переименование аудитора/вида/оценки/департамента каскадно обновляет FK (`ON UPDATE CASCADE`); массив `recommendations.audit_object` синхронизируется отдельно.

### Auditors — `/api/v1/settings/auditors`

CRUD по UUID. Тело: `{ "full_name": "...", "code": "ABC" }`.  
`code` — ровно **3 латинские буквы** `[A-Za-z]`, нормализуется в uppercase; уникален. Используется в `serial_number` проверки.

### Audit types — `/api/v1/settings/audit_types`

CRUD по UUID. Тело: `{ "code": "...", "name": "..." }`. Дубликаты `code`/`name` API не отклоняет 409.

### Check kinds — `/api/v1/settings/check_kinds`

CRUD по UUID. Тело: `{ "label": "..." }`. Справочник «Виды проверок».

### Effectiveness ratings — `/api/v1/settings/effectiveness_ratings`

CRUD по UUID. Тело: `{ "label": "..." }`.

### Departments — `/api/v1/settings/departments`

CRUD по UUID. Тело: `{ "name": "..." }`.

### Users — `/api/v1/users`

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/users` | список (admin); query `skip`, `limit` 1…200 (default 50) |
| `POST` | `/users` | создать пользователя с ролью `auditor` (admin); любая другая роль → **400**; дубликат username → **409**. При создании также upsert'ится запись в `auditors` (`full_name` = username, `code` = инициалы). PATCH/DELETE нет. |

Тело create: `{ "username", "password", "role"?: "auditor", "display_name"?, "aliases"?: [] }`.  
Ответ: `{ id, username, display_name, role, aliases, is_active }`.

---

## Tools — `/api/v1/tools`

DOCX-операции — `multipart/form-data`, поле **`file`** (`.docx`).  
Файл контроля — тот же upload плюс form-поля; шаблон отдаётся как XLSX.

Лимит размера: `SOKOL_MAX_UPLOAD_MB` (default **100**).  
MIME DOCX: OOXML DOCX или `application/octet-stream`.  
Тяжёлая работа: `asyncio.to_thread`. Upload пишется на диск чанками; результат отдаётся `FileResponse`. Временные файлы чистятся после ответа.

| Method | Path | Ответ | Поведение |
|--------|------|-------|-----------|
| `POST` | `/tools/section-ii` | DOCX | Раздел II без гиперссылок; имя `*_section_ii.docx` |
| `POST` | `/tools/section-ii-links` | DOCX | То же + bookmarks/hyperlinks к наблюдениям; `*_section_ii_links.docx` |
| `GET` | `/tools/control-file-template` | XLSX | Пустой шаблон файла контроля |
| `POST` | `/tools/control-file` | XLSX | Файл контроля из АЗ; form: `file`, `check_leader`, `check_date`; имя `*_control.xlsx` |
| `POST` | `/tools/memorandum` | DOCX | ДЗ из АЗ с готовым Разделом II; `*_dz.docx` |
| `POST` | `/tools/parse-recommendations` | JSON | массив рекомендаций из таблицы Раздела II АЗ |

**`ParsedRecommendationItem`:**

```json
{
  "name": "текст рекомендации",
  "observation_name": "название наблюдения",
  "audit_object": ["объект"],
  "manager": "руководитель",
  "deadline": "YYYY-MM-DD или пустая строка"
}
```

`audit_object` канонизируется по справочнику `departments`.

Ошибки парсинга/валидации документа: **400** с `detail` (строка).  
Файл не создан: **500**. Слишком большой: **413**. Шаблон контроля отсутствует: **404**.

---

## Чего нет в API

- OIDC / Keycloak (есть internal JWT + RBAC).
- Alembic HTTP; schema — `create_all` + CLI `migrate_*.py`.
- WebSocket, batch-import Excel через HTTP API (import — CLI `app.db.import_seed_data`).
- CRUD наблюдений.
- Profile / avatar (аватары только на фронте).
- Users PATCH/DELETE / смена роли через API.
- `POST /tools/audit-opinion` (backlog).
- Drill-down / сохранённые серверные отчёты аналитики.

---

## Соглашения об ошибках

- FastAPI validation → 422.
- Доменные «не найдено» → 404 с русским `detail`.
- Нет прав на рекомендацию/вложение → 403.
- Дубликат справочника / in-use / защищённое значение / username → 409.
- DOCX/XLSX business errors и неизвестные labels → 400.
- Слишком большой upload → 413.
- Неподдерживаемый MIME вложения → 415.
- Сбой MinIO → 502.
- CORS: заголовок Origins из env; при `*` credentials отключены.
