# HTTP API

Базовый prefix: **`/api/v1`**. Swagger: `http://127.0.0.1:8802/docs`.

Auth: **JWT Bearer**. Публичны `GET /`, `GET /api/v1/status`, `GET /api/v1/capabilities`, `POST /api/v1/auth/login`.  
`GET /auth/me` и `POST /auth/change-password` требуют авторизации.  
HTTP Basic: в non-prod включён по умолчанию; при `SOKOL_ENV` ∈ `{prod, production}` выключен, пока не `SOKOL_ENABLE_BASIC_AUTH=true`.  
Роль берётся из БД при каждом запросе, не из JWT. Неактивные пользователи (и login по `aliases`) не проходят. Login матчит `username` и `aliases`.

**Роли:** `auditor`, `department_head`, `admin`.  
`ADMIN_ROLES = {admin, department_head}` — всё, что проверяет `require_admin`, доступно обеим.

| Действие | `auditor` | `admin` / `department_head` |
|----------|-----------|-----------------------------|
| CRUD checks/recommendations (create/read/update) | ✅ | ✅ |
| `DELETE /checks/{id}` | ❌ | ✅ |
| `DELETE /recommendations/{id}` и `POST .../batch-delete` | только свои (`auditor` ↔ username) | ✅ |
| Upload/delete attachment (recommendation) | только своя | ✅ |
| Upload attachment (check) | ✅ | ✅ |
| `DELETE /attachments/{id}` (check) | ❌ | ✅ |
| Settings mutate | ❌ | ✅ |
| Settings GET | ✅ | ✅ |
| `GET/POST /users` | ❌ | ✅ |
| Analytics / tools | ✅ | ✅ |

«Своя» рекомендация: `recommendations.auditor` сравнивается с `username` через `person_match`.

Логин: `POST /auth/login` → `{ access_token, token_type: "bearer", role, username, display_name }`. TTL: `SOKOL_JWT_EXPIRE_MINUTES` (default 480).  
`GET /auth/me` → `{ username, display_name, role }` (без id и аватара).  
`POST /auth/change-password` — `{ current_password, new_password }` (min 4), **204**. Неверный текущий или совпадение с новым → **400**.

Списки: `{ "items": [...], "total": N }`.

---

## Health

| Method | Path | Ответ |
|--------|------|--------|
| `GET` | `/api/v1/status` | `{ "status": "ok" }` |
| `GET` | `/api/v1/capabilities` | `{ "max_upload_mb", "max_upload_bytes", "docx_max_concurrent", "docx_max_queue", "docx_queue_wait_seconds" }` |
| `GET` | `/` | `{ "service": "SOKOL API", "version": "v1" }` |

---

## Checks — `/api/v1/checks`

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/checks` | 201 `CheckRead` |
| `GET` | `/checks` | список |
| `GET` | `/checks/{id}` | одна |
| `PATCH` | `/checks/{id}` | частичное; `created_at` не меняется |
| `DELETE` | `/checks/{id}` | 204; cascade rec + вложения MinIO; **admin** |

**Query list:** `skip` (≥0, default 0), `limit` (1…10000, default 200), `search?` (min 1; имя / руководитель / ключ), `status?` (`not_started` \| `in_progress` \| `completed`), `check_type?` (`planned` \| `unscheduled` \| `thematic`).

**Create:** `check_name`, `short_name?`, `check_type` (строка ≤32; в ключе: `planned`→P, `unscheduled`→V, `thematic`→K, иначе пустой type-code), `check_view`, **`check_quarter`** (1–4), `start_date`, `end_date?`, `check_leader`, `status`, `created_at?` (default сегодня), `description?`, `*_effectiveness?`, документы приказа/программы/АЗ/ДЗ. `serial_number` клиент не шлёт: backend генерирует и пересчитывает при смене `start_date` / `check_quarter` / `check_leader` / `check_type` (синхронизация rec serial + MinIO bucket).

**Read:** те же поля + `id`, `serial_number`, `created_at`.

Неизвестный `check_leader` / `check_view` / непустая оценка ∉ ratings → **400**.

---

## Recommendations — `/api/v1/recommendations`

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/recommendations` | 201; проверка ищется по `serial_number` |
| `POST` | `/recommendations/batch` | atomic append/replace для проверки; body `{ serial_number, mode: append\|replace, items: [...] }`, 1…200 items; `serial_number` item'ов перезаписывается с проверки; 201 `{ items, total }`. **Ownership не проверяется** (в отличие от DELETE / batch-delete). `mode=replace` удаляет существующие рекомендации **и их MinIO-вложения** |
| `POST` | `/recommendations/batch-delete` | 204, 1…200 ids; та же модель владения, что `DELETE` |
| `GET` | `/recommendations` | список |
| `GET` | `/recommendations/{id}` | одна |
| `PATCH` | `/recommendations/{id}` | смена `serial_number` переносит рекомендацию на другую проверку |
| `DELETE` | `/recommendations/{id}` | 204; auditor — только своя |

**Query list:** `skip`, `limit` (как checks), `search?`, `serial_number?`.  
Search: название, наблюдение, описание, объект аудита, аудитор, руководитель, ключ проверки.

| Поле | Значения |
|------|----------|
| `status` | `completed`, `unresolved`, `on_control`, `in_progress` |
| `additional_status` | `on_time`, `deadline_violated`, `on_control`, `in_progress` |

Ещё: `sequence_number` (сервер), `description`, `observation_name`, `indicator` / `additional_indicator` (default `не указан`), `materiality_level` (default `средний`), `audit_object: list[str]` (строка с `,`/`;` тоже принимается), `deadline` (срок контроля), `execution_deadline` (срок исполнения), продления и снятие с контроля, `deadline_extensions` / `control_removals` (`{date?, comment?}`), `closure_*`.

Открытые рекомендации (`on_control` / `in_progress`) пересчитываются от этих дат при create/update и ежедневно в 00:05 Europe/Moscow. `completed` / `unresolved` и `on_time` / `deadline_violated` не трогаются.

`auditor` ∈ auditors, иначе **400**. `manager` — свободный текст. `audit_object` канонизируется по `departments`; неизвестное → **400**. Нет проверки → **400**. Сбой MinIO при delete/replace → **502**.

---

## Analytics — `/api/v1/analytics`

Агрегаты по всей БД, без лимита list API. Ответы в **camelCase** (`serialization_alias`). Отдельных таблиц нет. Конструктор дашбордов на backend **нет**. Схемы: `app/schemas/analytics.py`.

| Method | Path | Что в ответе (основные блоки) |
|--------|------|----------------|
| `GET` | `/analytics/checks` | `summary`, `completionShare`, `periodSeries`, `viewDistribution`, `typeDistribution`, `departmentMap`, `effectivenessMatrix`, `filterOptions` |
| `GET` | `/analytics/recommendations` | `summary` (+ `withExtensions`, `withCompletionDate`, `completionRate`, `violationRate`), `periodSeries` (в т.ч. `low`/`medium`/`high`, `cumulativeCompleted`), `materialityDistribution`, `statusDistribution`, `additionalStatusDistribution`, `viewDistribution`, `materialityMatrix`, `objectDistribution`, индикаторы, `checkLinks` |
| `GET` | `/analytics/monitoring` | `summary`, `periodSeries`, `additionalStatusDistribution`, `statusMatrix`, `deadlineExtensionsByCheck`, `completedDuringAuditByCheck`, `filterOptions` |
| `GET` | `/analytics/dva` | `universeChecksTotal` / `universeRecommendationsTotal` (+ filtered), `checkSummary`, `recommendationSummary`, `completionShare`, `averageCheckDurationDays`, `portfolioSeries`, `auditorLoad` / `auditorImpact` / `auditorExecution` / `auditorTimeliness` / `auditorDocuments`, `auditorMatrix`, treemap'ы, `departmentMap`, `documentReadiness`, `checkLifecycle` |
| `GET` | `/analytics/planning` | `coverage` (rates, donut, covered/uncovered, `checksByDepartment`), `unresolvedByDepartment`, `highMaterialityByDepartment` (красные рекомендации, доля от рекомендаций департамента, проверки), `highMaterialityTotal`, universe/filtered totals; **без** `auditors` в `filterOptions` |

Все ответы: `universeTotal` / `filteredTotal` (у dva/planning — отдельно checks и recommendations), `granularity`, `filterOptions` (`auditors?`, `departments`, `anchorDates`).

**Query:** `granularity` (`year` \| `quarter` \| `month`, default `year`); `years`, `quarters`, `months` — ключи (`2025`, `2025-Q1`, `2025-08`), OR между измерениями; `auditors`, `departments`.  
Recommendations/monitoring: `statuses` / `additional_statuses` / `materiality_levels` (есть camelCase-алиасы `additionalStatuses`, `materialityLevels`).

UI-контракт: [ANALYTICS.md](../../sokol-frontend/docs/ANALYTICS.md), [PLANNING.md](../../sokol-frontend/docs/PLANNING.md).

---

## Attachments — `/api/v1/attachments`

Метаданные в PostgreSQL, файлы в MinIO. См. [STORAGE.md](STORAGE.md).

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/attachments/storage/status` | `{ enabled, reachable, bucket_layout }` |
| `GET` | `/attachments` | обязательны `entity_type`, `entity_id`; `slot?` |
| `POST` | `/attachments` | 201 `{ attachment }`; multipart `entity_type`, `entity_id`, `slot`, `file` |
| `GET` | `/attachments/{id}/download` | байты + `Content-Disposition` |
| `DELETE` | `/attachments/{id}` | 204 |

Слоты check: `order`, `program`, `az`, `dz`, `dz_appendix`.  
Слоты recommendation: `recommendation_files`, `control_removal_files`.

Ошибки: слот/пустое тело → **400**; слишком большой → **413**; MIME → **415**; MinIO не настроен → **503**; сбой MinIO → **502**; нет прав → **403**.

---

## Settings

Паттерн: `POST`, `GET` (list + total), `GET/{id}`, `PATCH/{id}`, `DELETE/{id}`.  
List: `skip` (default 0), `limit` (1…200, default 50), `search?`.  
Чтение — любой authenticated. Мутации — **admin**. Дубликаты labels → **409** (кроме `audit_types`). In-use delete и «Не указан» → **409**. Переименование каскадно обновляет FK; массив `audit_object` синхронизируется отдельно.

| Prefix | Тело |
|--------|------|
| `/settings/auditors` | `{ full_name, code }` — `code` ровно 3 латинские буквы, uppercase, unique |
| `/settings/audit_types` | `{ code, name }` — 409 на дубликаты нет |
| `/settings/check_kinds` | `{ label }` |
| `/settings/effectiveness_ratings` | `{ label }` |
| `/settings/departments` | `{ name }` |

### Users — `/api/v1/users`

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/users` | admin; `skip`/`limit` 1…200 (default 50); пагинация в памяти |
| `POST` | `/users` | admin; только роль `auditor` иначе **400**; дубликат username → **409**. При create пытается добавить строку в `auditors` (`full_name` = username, `code` = инициалы); дубликат аудитора игнорируется. PATCH/DELETE нет |

Create: `username`, `password` (min 4), опционально `role` (`auditor`), `display_name`, `aliases`.  
Ответ: `{ id, username, display_name, role, aliases, is_active }`.

---

## Tools — `/api/v1/tools`

DOCX — multipart поле **`file`**. Лимит `SOKOL_MAX_UPLOAD_MB` (default 100). Тяжёлая работа в `asyncio.to_thread` под очередью слотов. Переполнение очереди → **503**. Подробно: [REPORTS.md](REPORTS.md).

| Method | Path | Ответ |
|--------|------|--------|
| `POST` | `/tools/section-ii` | DOCX `*_section_ii.docx` |
| `POST` | `/tools/section-ii-links` | DOCX `*_section_ii_links.docx` |
| `GET` | `/tools/control-file-template` | XLSX шаблон |
| `POST` | `/tools/control-file` | XLSX; form `file`, `check_leader`, `check_date` |
| `POST` | `/tools/memorandum` | DOCX `*_dz.docx` |
| `POST` | `/tools/parse-recommendations` | JSON массив `{ name, observation_name, audit_object, manager, deadline }` |

---

## Чего нет

OIDC · Alembic HTTP · WebSocket · batch Excel через HTTP (CLI `import_seed_data`) · CRUD наблюдений · profile/avatar · users PATCH/DELETE · drill-down / сохранённые серверные отчёты.

---

## Ошибки

| Код | Когда |
|-----|--------|
| 422 | FastAPI validation |
| 400 | DOCX/XLSX, неизвестные labels, неверный пароль при смене |
| 401 | нет/битый токен, неверный login |
| 403 | нет прав на рекомендацию/вложение |
| 404 | не найдено (русский `detail`) |
| 409 | дубликат справочника / in-use / «Не указан» / username |
| 413 | слишком большой upload |
| 415 | MIME вложения |
| 503 | MinIO не настроен; очередь DOCX tools переполнена |
| 502 | сбой MinIO / операция с объектом |

CORS: origins из env; при `*` credentials отключены.
