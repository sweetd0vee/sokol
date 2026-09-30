# HTTP API

Prefix **`/api/v1`**. Swagger: `http://127.0.0.1:8802/docs` (Docker — порт 8800).

JWT Bearer. Публичны `GET /`, `/status`, `/ready`, `/metrics`, `/capabilities` и `POST /auth/login`. Роль берётся из БД. Login матчит `username` и `aliases`. Неактивные не проходят.

Роли: `auditor`, `department_head`, `admin`. `require_admin` пускает admin и department_head. «Своя» запись — `person_match` по руководителю проверки, аудитору рекомендации или `created_by`. Правила владения — [ARCHITECTURE.md](ARCHITECTURE.md).

| Действие | auditor | admin / department_head |
|----------|---------|-------------------------|
| Чтение checks, recommendations, analytics, tools, settings | да | да |
| Create check / recommendation | свои (автор или своя проверка) | да |
| Update / delete check, recommendation, вложения | свои | да |
| `POST /recommendations/batch` `replace` | только своя проверка | да |
| Settings mutate, `GET/POST /users` | нет | да |

`POST /auth/login` → `{ access_token, token_type, role, username, display_name }`. TTL — `SOKOL_JWT_EXPIRE_MINUTES` (480). `GET /auth/me` → `{ username, display_name, role }`. `POST /auth/change-password` `{ current_password, new_password }` (min 4) → **204**; неверный текущий или тот же новый → **400**.

Списки: `{ "items", "total" }`. Ответ несёт `X-Request-ID`. Необработанное исключение → **500** `{ "detail": "Внутренняя ошибка сервера." }` без traceback.

## Health

| Method | Path | Ответ |
|--------|------|--------|
| `GET` | `/status` | liveness и счётчики HTTP / очереди DOCX |
| `GET` | `/metrics` | Prometheus text, без auth |
| `GET` | `/ready` | `{ status, database }`; БД недоступна → **503** |
| `GET` | `/capabilities` | лимиты upload и очереди DOCX |
| `GET` | `/` | `{ service, version }` |

## Checks — `/checks`

`POST` 201, `GET` список и `/{id}`, `PATCH` (не меняет `created_at`), `DELETE` 204 (cascade рекомендаций и объектов MinIO).

List: `skip` (default 0), `limit` (1…10000, default 200), `search`, `status` (`not_started` \| `in_progress` \| `completed`), `check_type` (`planned` \| `unscheduled` \| `thematic`).

Create: `check_name`, `check_type`, `check_view`, `check_quarter` (1–4), `start_date`, `check_leader`, `status`, опционально даты и документы приказа / программы / АЗ / ДЗ, оценки эффективности. `serial_number` клиент не шлёт. Присланный `status` перезаписывается автостатусом (дата ДЗ → `completed`, начало в будущем → `not_started`, иначе `in_progress`). Неизвестный `check_leader` / `check_view` / оценка → **400**.

## Recommendations — `/recommendations`

| Method | Path | |
|--------|------|--|
| `POST` | `/recommendations` | проверка ищется по `serial_number` |
| `POST` | `/recommendations/batch` | `{ serial_number, mode: append\|replace, items }` 1…200; `replace` удаляет рекомендации и их объекты MinIO |
| `POST` | `/recommendations/batch-delete` | 204, 1…200 id |
| `GET` / `PATCH` / `DELETE` | `/recommendations`, `/{id}` | смена `serial_number` переносит на другую проверку |

List: `skip`, `limit` (как у checks), `search`, `serial_number`.

`status`: `completed`, `unresolved`, `on_control`, `in_progress`. `additional_status`: `on_time`, `deadline_violated`, `on_control`, `in_progress`. Ещё: `sequence_number` (сервер), `audit_object` (массив или строка с `,`/`;`), `deadline`, `execution_deadline`, `deadline_extensions` / `control_removals`. Автостатус — [RECOMMENDATION_INDICATORS.md](RECOMMENDATION_INDICATORS.md). Неизвестный аудитор или объект аудита, нет проверки → **400**. Сбой MinIO при delete → **502**.

## Analytics — `/analytics`

Агрегаты по всей БД, camelCase, отдельных таблиц нет. Конструктора на backend нет.

| `GET` | Основные блоки |
|-------|----------------|
| `/analytics/checks` | summary, динамика, виды, типы, карта департаментов, матрица эффективности |
| `/analytics/recommendations` | summary, период, существенность, статусы, карта, индикаторы, `checkLinks` |
| `/analytics/monitoring` | summary, доп. статусы, матрица, переносы, исполнено в ходе аудита |
| `/analytics/dva` | портфель, нагрузка и сроки аудиторов, документы, lifecycle |
| `/analytics/planning` | охват, «не решено», высокая существенность; в `filterOptions` нет `auditors` |

Общее: `universeTotal` / `filteredTotal`, `granularity`, `filterOptions`. Query: `granularity` (`year` \| `quarter` \| `month`), `years` / `quarters` / `months` (OR), `auditors`, `departments`. Recommendations и monitoring также принимают `statuses`, `additionalStatuses`, `materialityLevels` — в UI этих фильтров нет. UI — [ANALYTICS.md](ANALYTICS.md).

## Attachments — `/attachments`

Metadata в Postgres, байты в MinIO. Layout — [DATA.md](DATA.md).

| Method | Path |
|--------|------|
| `GET` | `/attachments/storage/status` → `{ enabled, reachable, bucket_layout }` |
| `GET` | `/attachments?entity_type=&entity_id=` (`slot` необязателен) |
| `POST` | multipart `entity_type`, `entity_id`, `slot`, `file` |
| `GET` | `/attachments/{id}/download` |
| `DELETE` | `/attachments/{id}` |

Слоты check: `order`, `program`, `az`, `dz`, `dz_appendix`. Слоты recommendation: `recommendation_files`, `control_removal_files`. Upload и delete требуют тех же прав, что update сущности.

Ошибки: слот или пустое тело → **400**; размер → **413**; MIME → **415**; MinIO не настроен → **503**; сбой MinIO → **502**; нет прав → **403**.

## Settings и users

Один factory, пять prefix: `POST`, `GET`, `GET/{id}`, `PATCH/{id}`, `DELETE/{id}`. List: `skip`, `limit` 1…200 (default 50), `search`. Чтение — любой вошедший, мутации — admin. Дубликат label, in-use и «Не указан» → **409** (у `audit_types` дубликаты не 409).

| Prefix | Тело |
|--------|------|
| `/settings/auditors` | `{ full_name, code }` — `code` ровно 3 латинские буквы |
| `/settings/audit_types` | `{ code, name }` |
| `/settings/check_kinds`, `/effectiveness_ratings` | `{ label }` |
| `/settings/departments` | `{ name }` |

`GET/POST /users` — admin. Create только с ролью `auditor`, иначе **400**; дубликат username → **409**. Пароль min 4. PATCH/DELETE users нет. Ответ без `password_hash`.

## Tools — `/tools`

Вход DOCX — поле `file`, лимит `SOKOL_MAX_UPLOAD_MB` (100). Очередь слотов; переполнение или timeout ожидания → **503** и `Retry-After`. Правила разбора — [REPORTS.md](REPORTS.md).

| Method | Path | Результат |
|--------|------|-----------|
| `POST` | `/tools/section-ii` | `*_section_ii.docx` |
| `POST` | `/tools/section-ii-links` | `*_section_ii_links.docx` |
| `GET` | `/tools/control-file-template` | XLSX |
| `POST` | `/tools/control-file` | XLSX; form `file`, `check_leader`, `check_date` |
| `POST` | `/tools/memorandum` | `*_dz.docx` |
| `POST` | `/tools/parse-recommendations` | JSON черновиков рекомендаций |

Парсинг → **400**, нет шаблона контроля → **404**, слишком большой файл → **413**.

## Лимиты

| Что | Значение |
|-----|----------|
| `GET /checks`, `/recommendations` | default 200, max 10 000. UI забирает 10 000 и пагинирует на клиенте; отдельного предупреждения, что в БД больше, нет |
| users и справочники | default 50, max 200 |
| batch рекомендаций | 1…200 |
| upload | `SOKOL_MAX_UPLOAD_MB`, default 100. Пока `/capabilities` не пришли, UI считает 100 |
| DOCX | одновременно `SOKOL_DOCX_MAX_CONCURRENT` (2), в очереди ещё `SOKOL_DOCX_MAX_QUEUE` (8), ждать слот `SOKOL_DOCX_QUEUE_WAIT_SECONDS` (180). Клиент tools ждёт 10 минут |
| JWT | 480 минут. 401 вне login → logout |
| кэш аналитики / capabilities / MinIO status | 60 с / 5 мин / 15 с |

## Ошибки

| Код | Когда |
|-----|--------|
| 400 | домен, неизвестный label, пароль, битый DOCX |
| 401 | нет или битый токен, неверный login |
| 403 | нет прав на запись или вложение |
| 404 | не найдено |
| 409 | дубликат справочника, in-use, username |
| 413 / 415 | размер / MIME |
| 502 | сбой MinIO |
| 503 | MinIO не настроен, очередь DOCX полна, БД не ready |

| Симптом | Куда смотреть |
|---------|----------------|
| UI не видит API | dev **8802**, Docker **8800** |
| CORS | `SOKOL_CORS_ORIGINS`, рестарт API |
| 503 на вложении | не заданы `SOKOL_MINIO_*` |
| 502 на вложении | MinIO не запущен или объекта нет |
| 503 на tools | очередь DOCX, повторить позже |
| DOCX «висит» | размер, очередь, вёрстка АЗ, логи backend |
