# Код-ревью: sokol-backend

Снимок на **11.09.2026**. Разбор текущего кода FastAPI-сервиса (`sokol-backend/`), не исторический backlog из [HISTORY.md](HISTORY.md).

Контекст: внутренний инструмент аудита, доверенные пользователи одного департамента. Это смягчает часть рисков, но **не отменяет** дыры в авторизации, гонки и незакрытые миграции: они ломают продукт и у «своих».

**Итоговая оценка: 6.2 / 10**

Для пилота на контролируемом объёме — терпимо. Для UAT/prod с реальными аудиторами — закрыть High до показа.

| | |
|--|--|
| Стек | FastAPI 0.115 · SQLAlchemy 2 async · PostgreSQL 16 · MinIO · python-docx · openpyxl |
| Слои | endpoints → services → crud → models (CRUD = SQL/flush; commit/MinIO/валидация/хеш в service) |
| Тесты | 37 unittest-файлов, в основном моки; integration — флаг `SOKOL_RUN_DB_INTEGRATION_TESTS` |
| Нет | Alembic · OIDC · rate-limit · Prometheus/Sentry · Celery |

---

## Таблица оценок

| # | Блок | Оценка | Коротко |
|---|------|-------:|---------|
| 1 | Архитектура и слои | **10** | CRUD = SQL/flush; commit, MinIO, валидация и хеш пароля — в service |
| 2 | Безопасность | **4.0** | Auth есть, **authz на мутациях дырявая**; plaintext-пароли; CVE в multipart |
| 3 | Модель данных и миграции | **5.0** | Нет Alembic; bootstrap не покрывает все патчи; нет UNIQUE на sequence |
| 4 | API-дизайн | **7.0** | Единый `{detail}`, Pydantic v2; невалидная дата → 422; analytics → 500 |
| 5 | Бизнес-логика | **6.0** | Статусы продуманы; overlay, гонки serial/sequence, `extension_2_reason` |
| 6 | Аналитика и отчёты | **6.5** | SQL-агрегаты, очередь DOCX; `ANCHOR_YEARS`, zip-bomb, много round-trip |
| 7 | Файлы / MinIO | **5.0** | Sanitization ок; upload в RAM; delete до commit; bucket-per-check |
| 8 | Производительность | **5.0** | Full scan users на каждый JWT; scheduler грузит всю таблицу |
| 9 | Тесты | **5.5** | Unit по статусам/ключам; граница слоёв CRUD; authz-дыр тесты не ловят |
| 10 | Наблюдаемость | **7.5** | Request-id, access log, тип в `except`, счётчики на `/status`; нет Prometheus |
| 11 | Конфиг / devops / секреты | **5.0** | Prod-гарды JWT/demo есть; Docker demo-on, CORS `*` |
| 12 | Качество кода | **10** | Python 3.12; CRUD без commit/services; один пакет миграций; `OptionalDate` / один `UserRead` |

Среднее по блокам ≈ 6.2. Итог **6.2**: слои закрыты на контракт, безопасность и схема БД — ниже.

---

## Что сделано хорошо

- JWT роль **не** берётся из токена: `get_current_user` перечитывает пользователя из БД (`app/api/deps.py`). Деактивация работает сразу.
- Роутеры защищены `Depends(get_current_user)`, кроме `/`, `/status`, `/ready`, `/capabilities`, `POST /auth/login`.
- `require_admin` на DELETE проверки, мутациях справочников, `GET/POST /users`.
- `assert_app_startup_safe`: в prod слабый JWT и demo-load не стартуют.
- Статусы рекомендаций — отдельный модуль с тестами (`recommendation_status.py`, `test_recommendation_status.py`), TZ Москва.
- Словари — один factory (`dictionary_registry.py`), без копипасты endpoint-файлов.
- Tools стримят upload на диск (`save_upload_to_temp`), очередь DOCX ограничивает параллелизм.
- Имена файлов в object key санитизируются; слоты вложений — whitelist.
- Классического SQL injection нет: SQLAlchemy + параметризация. `eval`/`exec` нет.

---

## Сводка findings

### Critical

Классического RCE / SQLi / обхода login без учётки **нет**.

Ближайшее к Critical — **полный IDOR на create/update/batch** при заявленной модели «аудитор правит своё». Если продукт сознательно «все аудиторы правят всё, DELETE только своё» — это High/product-decision. Против этой версии говорит ACL вложений: PATCH чужой рекомендации можно, загрузить к ней файл — нельзя. Модель прав **внутренне противоречива**.

### High

1. Любой залогиненный пользователь создаёт/меняет любые проверки и рекомендации, включая `POST /recommendations/batch` с `mode=replace`.
2. List/download вложений без ownership; upload на check — любой аудитор.
3. `verify_password` принимает legacy plaintext.
4. Alias не уникален → перехват логина.
5. `python-multipart==0.0.9` (CVE-2024-53981).
6. `BOOTSTRAP_MIGRATIONS` не включает живые патчи колонок/enum.
7. Нет UNIQUE `(check_id, sequence_number)` + `MAX+1` без lock.
8. Вложения читаются целиком в RAM (`await file.read()`).
9. CORS по умолчанию `*`; Docker `SOKOL_ENV=development`, demo=1, MinIO `change-me`.

### Medium / Low

Гонки serial, overlay статуса на любой PATCH, scheduler full-scan, `date.today()` vs Москва, analytics 500, dual ARRAY/junction, delete MinIO до commit, нет rate-limit, JWT 8ч без revoke, пароль от 4 символов, нет логов.

Полный каталог — ниже по блокам и в конце документа.

---

## 1. Архитектура и слои — 10 / 10

Контракт: `endpoints → services → crud → models`. Роутеры тонкие, `DomainError` → JSON `{detail}`.

CRUD — только SQL: `flush`, без `commit`, без MinIO, без Pydantic-схем, без `DomainError`, без `hash_password`. Service владеет UoW (`commit`/`rollback`), MinIO, валидацией словарей и хешем пароля. HTTP-endpoints не импортируют `app.crud`; `deps` ходит в `auth_service`. Границу держит `test_crud_layer_boundary`.

### M1. ~~CRUD знает про сервисы (инверсия)~~ — закрыто

CRUD не импортирует `app.services`. Overlay, канонизация, MinIO и каскад serial живут в service.

### M2. ~~Мёртвый путь удаления~~ — закрыто

`recommendations_crud.delete_recommendation` убран. Удаление только через service (с вложениями).

### L1. ~~Тонкий `checks_service`~~ — закрыто

`checks_service` оркестрирует валидацию, serial rewrite и MinIO. `crud_errors.py` удалён: импорт из `app.core.exceptions`.

### L2. ~~CRUD коммитит и валидирует~~ — закрыто

`users_crud` / `attachments_crud` больше не коммитят. Дубликаты справочников и `DictionaryRefError` по serial поднимает service. `ensure_user` принимает готовый `password_hash`; seed/sync коммитят сами.

---

## 2. Безопасность — 4.0 / 10

### H1. IDOR: мутации без владельца

Права проверяются на **delete** (и на rec-вложения). Create/update/batch — любой authenticated.

| Операция | Файл | Authz |
|----------|------|--------|
| `POST/PATCH /checks` | `endpoints/checks.py` | любой залогиненный |
| `POST/PATCH /recommendations` | `endpoints/recommendations.py` | любой |
| `POST /recommendations/batch` (в т.ч. replace) | тот же файл | любой — **wipe всех rec проверки** |
| `DELETE /checks/{id}` | `checks.py` | `require_admin` |
| `DELETE /recommendations/{id}` | `recommendations.py` | `user_can_manage_recommendation` |
| `POST /recommendations/batch-delete` | тот же | user передаётся |

`create_recommendation` / `update_recommendation` / `batch_recommendations` **не принимают user**. Аудитор может переписать чужие поля, сменить `auditor`, подменить статус, replace-batch'ем стереть чужие рекомендации.

Это не стыкуется с ACL вложений (`attachments_service.py`: upload на recommendation проверяет владельца, list/download — нет, upload на check — любой).

**Фикс:** те же проверки, что на delete, на create/update/batch; для check — лидер или admin; batch replace — admin или владелец проверки. Тест: «аудитор не PATCH чужое» — сейчас он **провалился бы**, и это правильно.

### H2. Вложения: list/download без ACL

```25:37:sokol-backend/app/api/v1/endpoints/attachments.py
@router.get("")
async def list_attachments_endpoint(...):
    return await attachments_service.list_attachments(...)  # user не передаётся
```

Download тоже без user. Upload на check не проверяет лидера. Любой аудитор скачивает файлы любой проверки.

### H3. Plaintext password fallback

```50:53:sokol-backend/app/core/security.py
def verify_password(plain_password: str, stored: str) -> bool:
    if stored.startswith(_PBKDF2_PREFIX):
        return _verify_pbkdf2(plain_password, stored)
    return _verify_legacy_plaintext(plain_password, stored)
```

Тест фиксирует `verify_password("admin", "admin")`. Утечка `users.password_hash` = готовые пароли для несмигрированных строк. В prod plaintext должен **отказывать**, не сравнивать. После успешного login — rehash в PBKDF2.

PBKDF2-HMAC-SHA256 120k слабее argon2id/bcrypt. Для внутреннего пилота приемлемо после отключения plaintext.

### H4. Коллизия aliases

`get_user_by_username` (`users_crud.py`) грузит **всех** пользователей и матчит username **или** alias. Первый по `ORDER BY username` побеждает. Уникального индекса на aliases нет (`users.aliases` — свободная VARCHAR). Alias `"admin"` у аудитора может перехватить логин админа (у seed-админа alias как раз `admin`).

**Фикс:** нормализованный unique по username+каждому alias; lookup через SQL, не Python-loop.

### H5. `python-multipart==0.0.9`

CVE-2024-53981 (DoS на multipart, исправлен в ≥0.0.18). Tools и attachments принимают multipart. **Фикс:** поднять до актуального, прогнать upload-тесты.

### H6. CORS `*` и дефолтные секреты

Пустой `SOKOL_CORS_ORIGINS` → `["*"]` (`parse_cors_origins`). `allow_credentials` при `*` выключается, но любой origin может дергать API с украденным Bearer.

Дефолты: `sokol_jwt_secret = "sokol-dev-jwt-secret-change-me"`, `sokol_admin_password = "admin"`, `sokol_default_user_password = "auditor"`. Prod-гард проверяет **только** JWT, не CORS, не admin password, не MinIO keys.

Compose (`docker/app/docker-compose.yml`): `SOKOL_ENV` default `development`, `SOKOL_LOAD_DEMO_DATA:-1`, MinIO `change-me`, порты Postgres/MinIO наружу.

### M3. Нет rate-limit / lockout на `/auth/login`

PBKDF2 120k + brute force = CPU DoS + подбор `admin`/`auditor`.

### M4. JWT: HS256, TTL 480 мин, нет `jti` / revocation

Смена пароля **не** инвалидирует старые токены.

### M5. HTTP Basic

Включён в development по умолчанию; в prod можно включить `SOKOL_ENABLE_BASIC_AUTH=true` без отдельного гарда. Браузер может показать native login prompt.

### M6. Password policy

`min_length=4` (`schemas/auth.py`, `schemas/users.py`). Нет сложности.

### M7. `person_match` слишком широкий для authz

```30:33:sokol-backend/app/core/person_match.py
    if not user_initials:
        return True
```

Username `"Иванов"` матчит `"Иванов А.А."`. Нет связи `users.id ↔ auditors.id` — права завязаны на строку ФИО. Однофамильцы без инициалов получают чужой DELETE.

### M8. Нет row-level фильтрации list/get/analytics

Любой аудитор видит все проверки, рекомендации, файлы и агрегаты. Для «один отдел» это может быть product-decision — тогда зафиксировать в [ARCHITECTURE.md](ARCHITECTURE.md). Сейчас документация говорит про «свою» рекомендацию только для delete.

### M9. Header injection в `Content-Disposition`

`app/api/http.py` вставляет `original_name` в `filename*` через `quote`, но ASCII-fallback идёт в кавычки без стрипа `"`, `\r`, `\n`.

### M10. Lookalike-логин

`normalize_login` + `LATIN_TO_CYRILLIC` склеивает `P`/`Р` и т.д. — коллизии логинов плюс aliases.

### L2. Прочее

- `Role(user.role)` в `deps.py` → 500 на мусор в VARCHAR `users.role` (нет PG enum).
- Нет `TrustedHostMiddleware`.
- MinIO `secure=False` по умолчанию.
- Публичные `/`, `/status`, `/capabilities`, `/docs`, `/openapi.json`. Capabilities утекает лимиты upload/очереди — для внутреннего ок.
- `hmac.compare_digest` в PBKDF2: битый hash другой длины → `ValueError` → 500 на логине, не 401.
- OpenAPI в Docker на `0.0.0.0`.

---

## 3. Модель данных и миграции — 5.0 / 10

**Нет Alembic.** Комментарий в `app/db/migrations/__init__.py`: «until Alembic is adopted». Схема = `Base.metadata.create_all` + ad-hoc патчи.

### H7. Bootstrap неполный

`BOOTSTRAP_MIGRATIONS` **не** включает как минимум:

- `CHECK_SHORT_NAME`
- `RECOMMENDATION_FIELDS`
- `RECOMMENDATION_AUDIT_OBJECT_ARRAY`
- `RECOMMENDATION_CLOSURE` / `RECOMMENDATION_CLOSURE_LISTS`
- `MATERIALITY_REQUIRED`
- `recommendation_audit_object_canonical.migrate`

Новые инсталлы спасает `create_all`. Старые БД при одном Docker bootstrap могут остаться без колонок / значений enum, пока кто-то вручную не прогонит `python -m app.db.migrations --all`. Таблицы версий патчей нет.

### H8. Нет UNIQUE `(check_id, sequence_number)`

`Recommendation.sequence_number` — обычный Integer. `get_next_sequence_number` = `MAX+1` без `FOR UPDATE` / advisory lock. Два параллельных POST → одинаковый номер.

Serial проверки: UNIQUE есть, retry IntegrityError **2 раза**, потом 500 (`checks_crud.create_check`).

### M11. Два источника правды для объектов аудита

ARRAY `recommendations.audit_object` **и** junction `recommendation_audit_objects`. Analytics фильтрует по ARRAY (`overlap`), FK — по junction. Нет CHECK, что ARRAY ⊆ junction.

### M12. `attachments` без FK на checks/recommendations

`entity_type` + `entity_id` — логическая ссылка. Сирота, если удаление не через service. Нет CHECK `entity_type IN ('check','recommendation')`.

### M13. FK на человекочитаемые лейблы

`auditors.full_name`, `departments.name` с `ON UPDATE CASCADE`. Переименование каскадит по всей БД. `Auditor.code` UNIQUE(3) — два аудитора с одинаковыми инициалами не влезут.

### M14. `users.role` не enum в Postgres

`is_active` есть, API деактивации/PATCH нет.

### L3. `CheckStatus` SAEnum без `values_callable`

Рекомендации — с `values_callable`. Риск names vs values (`NOT_STARTED` vs `not_started`) при смене SQLAlchemy.

### L4. `date.today()` vs Москва

`checks_crud.py` / `recommendations_crud.py` пишут `created_at = date.today()` в TZ сервера. Scheduler считает по `MOSCOW_TZ`. Расхождение около полуночи, если контейнер в UTC.

---

## 4. API-дизайн — 7.0 / 10

Плюсы: Pydantic v2, list `{items, total}`, словари единообразны, 401/403 на русском, `DomainError` → `{"detail": ...}`.

### M15. Pagination

`/checks`, `/recommendations`: default 200, **le=10000**. `/users` le=200, но `list_users_page` грузит всех в память и слайсит.

### M16. ~~Невалидные даты → `None`~~ — закрыто

Пустая строка по-прежнему `None` (очистка поля). Мусор вроде `"32.13.2026"` даёт **422**.

### L5. ~~Два `UserRead`~~ — закрыто

Одна схема `schemas.users.UserRead`; `/auth/me` отдаёт её (id, aliases, is_active). Фронт роль по-прежнему берёт из login.

### M17. Analytics query params не валидируются

`analytics_deps.py`: `years/quarters/months: list[str]`.  
`sql_filters.py`: `int(value)`, `split("-Q", 1)`. Мусор → `ValueError` → **500**, не 422.

### M18. IntegrityError не мапится

Кроме dictionary_service и retry serial. Гонка unique serial / username → 500.

### L6. Search `ilike %user%`

`%` / `_` не экранируются (wildcard injection, не SQLi).

### L7. Create recommendation требует `status`

Overlay его перезапишет для не-terminal. Контракт врёт клиенту.

---

## 5. Бизнес-логика — 6.0 / 10

Статусная машина продуманная: terminal/manual не трогать, ежедневно 00:05 МСК. Тесты `test_recommendation_status.py` сильные.

### M19. `execution_deadline` почти не участвует в автоматике

`overlay_computed_status_fields` считает срок исполнения через `control_zone_execution_date(actual_completion, deadline_extensions, extension_1_date, extension_2_reason)`, **не** через колонку `execution_deadline`. Клиент пишет одно поле, scheduler читает другое. Два «срока исполнения». Зафиксировано в [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md), но в API это выглядит как баг.

### M20. `extension_2_reason` парсится как дата

```123:126:sokol-backend/app/services/recommendation_status.py
for raw in (extension_1_date, extension_2_reason):
    parsed = _as_date(raw)
```

Колонка — VARCHAR reason. Import кладёт туда дату. Если reason похож на ISO — ложный срок зоны контроля.

### M21. Overlay на каждом PATCH

Любой PATCH (хоть `name`) пересчитывает status/indicator, если не terminal. Ручной `on_control` после дедлайна сбросится в `in_progress`.

### M22. Scheduler грузит всю таблицу

```33:34:sokol-backend/app/services/recommendation_status_refresh.py
        result = await session.execute(select(Recommendation))
        for recommendation in result.scalars():
```

Нет фильтра «только открытые», нет батчей, нет `skip_locked`. Два реплики API = два scheduler'а (`status_scheduler_enabled` default True). Distributed lock нет.

### M23. Batch replace и MinIO

Удаляет rec+files по одной, потом insert. Rollback сессии не откатывает уже удалённые объекты MinIO.

### L8. `control_file` дата

Принимает `D.MM.YYYY` и ISO; `1.09.2026` ок, `1.9.2026` нет (`instruments_reports.py`).

---

## 6. Аналитика и отчёты — 6.5 / 10

Плюсы: фильтры в SQL, GIN по `audit_object`, `ANALYTICS_INDEXES`, парсеры вынесены, `docx_queue` режет параллелизм.

### M24. 10–15 sequential round-trip на dashboard

`build_recommendations_analytics` / `build_dva_analytics` / `build_checks_analytics` — последовательные `await`. Нет `asyncio.gather`, нет одного SQL.

### M25. `load_effectiveness_matrix_rows` грузит все Check ORM

Рост числа проверок = жирная матрица в JSON.

### M26. `CHECK_LINKS_LIMIT = 12`

Молча обрезает связи проверка↔рекомендации.

### M27. `ANCHOR_YEARS = (2025, 2026)`

Захардкожено в `analytics/constants.py`. `pad_anchor_dates` всегда добавляет 2025-01-01 и 2026-01-01. В 2027 фильтры будут врать.

### M28. DOCX: только расширение, не magic bytes

`validate_docx_upload` проверяет `.docx`. Дальше `zipfile` + XML без лимита uncompressed size. Очередь 2+8 смягчает, один 100MB zip-bomb ест CPU/RAM. Нет проверки `PK\x03\x04`.

### L9. `except Exception` в генераторах

`section_ii/docx_generator.py` глотает причину (~строка 626). Огромные parser-модули (600+ строк).

---

## 7. Файлы / MinIO — 5.0 / 10

Плюсы: basename sanitization, UUID в ключе, compensate-delete при фейле insert, `to_thread` вокруг sync MinIO, whitelist слотов.

### H9. Upload в RAM

```50:50:sokol-backend/app/api/v1/endpoints/attachments.py
    payload = await file.read()
```

Лимит 100MB × N запросов. Tools стримят на диск — вложения нет.

### M29. Delete MinIO до commit БД

`delete_attachment`: object remove, потом delete row. Фейл commit = файл мёртв, строка жива. Обратное: delete check глотает ошибку bucket (`checks_crud.py`).

### M30. Один bucket на проверку

`check_bucket_name` режет до 63 символов → коллизии после sanitize. MinIO плохо масштабирует тысячи buckets. `list_buckets()` на каждый `ping()`.

### M31. MIME trust

`ALLOWED_CONTENT_TYPES` включает `application/octet-stream` и zip. Content-Type с клиента. Можно залить exe как octet-stream.

### L10. `get_storage` `@lru_cache`

Смена env без рестарта не подхватится. Docker `minio/minio:latest` — непинный тег.

Path traversal в object key: слот из whitelist, filename sanitised — **OK**.

---

## 8. Производительность — 5.0 / 10

| Место | Проблема |
|-------|----------|
| `get_user_by_username` | `SELECT * FROM users` + Python loop **на каждый JWT** |
| `find_dictionary_duplicate_by_label` | полный scan справочника |
| `list_users_page` | все users в RAM |
| `refresh_recommendation_statuses` | все recommendations |
| `existing_key_seeds` / serial | все checks при create |
| analytics | десятки SQL подряд |
| attachments download | весь объект в bytes |
| engine | `pool_pre_ping=True`, нет явных `pool_size` / `pool_recycle` |
| uvicorn | 1 worker в Dockerfile; горизонталь → N scheduler'ов |
| search | leading `%` → seq scan |
| list | limit 10000 |

`expire_on_commit=False` — ок для API, риск stale objects в длинной сессии. Кэша справочников нет.

---

## 9. Тесты — 5.0 / 10

Сильные: `test_recommendation_status.py`, `test_person_match.py`, `test_startup_validation.py`, `test_check_key.py`, parser goldens, `test_auth_rbac.py` (публичный status, 401 без токена, admin-only users/delete check).

### Пробелы (баги этого ревью **не покрыты**)

- Нет теста «аудитор не PATCH чужую рекомендацию / не batch-replace» — потому что сейчас **может**.
- Нет теста CORS / plaintext-off в prod / alias collision.
- Analytics `years=abc` → 500 не пойман.
- Invalid date → None не пойман.
- Integration `test_checks_crud_integration.py` требует `sokol_test` + флаг; без флага CI не видит гонки sequence.
- Почти каждый тест делает `os.environ.setdefault("DATABASE_URL", ...)` из‑за import-time engine.
- Scheduler выключен через `PYTEST_CURRENT_TEST` — loop не тестируется.
- Нет zip-bomb / 100MB upload / multipart CVE regression.

---

## 10. Наблюдаемость — 7.5 / 10

**Закрыто 10.09.2026.** Было 3.0: не было `logging` setup, request-id, server-side лога `DomainError`; `except Exception` глотал тип.

Сейчас:

- `configure_logging()` на старте: логгеры `app.*`, текст в development, JSON в prod (`SOKOL_LOG_JSON`).
- `RequestContextMiddleware`: `X-Request-ID` (входной или UUID), access log `http_request METHOD path status duration`, in-process счётчики.
- `DomainError` / 422 логируются с `[ExceptionType]`. 5xx с `__cause__` — traceback; 503 без причины (MinIO выключен) — одна строка ERROR.
- Необработанные исключения: лог `[TypeName]`, клиенту **500** `{detail: "Внутренняя ошибка сервера."}` без internals.
- `log_caught_exception` / `format_caught_error` в tools, attachments, cascade, scheduler, rec service — тип на строке сообщения.
- `GET /api/v1/status` — liveness + `uptime_seconds`, `requests_total`, `requests_4xx`, `requests_5xx`.
- `GET /api/v1/ready` — `SELECT 1` с таймаутом 2 с, иначе 503.

Остаётся Low: нет Prometheus/OpenTelemetry/Sentry, `/ready` не пингует MinIO (для этого `/attachments/storage/status` под auth).

---

## 11. Конфиг / devops / секреты — 5.0 / 10

Хорошо: `assert_app_startup_safe`; секреты в `.secrets/sokol.env`; destructive dictionary sync в prod выключен; Docker entrypoint ждёт DB/MinIO.

| Severity | Что |
|----------|-----|
| High | Compose: `SOKOL_ENV=development`, demo=1, MinIO `change-me`, порты 5433/9000/9001/8800 наружу |
| High | `SOKOL_LOAD_DEMO_DATA` default **True** в `bootstrap.py`, **False** в `main.py` — разные смыслы |
| Medium | Нет Alembic в CI/entrypoint — `create_all` + subset патчей |
| Medium | `CMD uvicorn --host 0.0.0.0` без `--proxy-headers`, без TLS |
| Medium | `minio:latest`, volume на хосте |
| Low | Settings читает `.env` + `.secrets/sokol.env` при import; пустой `DATABASE_URL` создаёт engine до assert |
| Low | Mailhog в compose API не использует |
| Low | JWT length 32 — минимум длины, не энтропия (`"x"*32` проходит) |

---

## 12. Качество кода — 10 / 10

Читаемый Python 3.12, мало `Any` в домене. TODO/FIXME в app почти нет.

Слои выпрямлены: CRUD не импортирует services и не коммитит (есть `test_crud_layer_boundary`). `users_crud` / `attachments_crud` — `flush`; UoW в service, create auditor+user — одна транзакция. Миграции — один пакет `app/db/migrations` (`python -m app.db.migrations`), без shim-файлов `migrate_*.py`. Схемы: один `UserRead`, общий `ListResponse` / `OptionalDate` (`parse_optional_date`), closure-поля рекомендаций без копипасты валидаторов, `normalize_audit_object_input` / `split_audit_object_values` в `dictionary_text`. Serial rewrite checks идёт через `check_serial_cascade`. `get_db_session` типизирован как `AsyncGenerator`; dictionary router принимает Pydantic-схемы; `control_zone_execution_date` типизирован.

Pydantic v1 артефактов в app нет.

---

## Каталог ошибок (что чинить)

| ID | Sev | Где | Что сломано | Фикс |
|----|-----|-----|-------------|------|
| B-H1 | High | `endpoints/checks.py`, `endpoints/recommendations.py` | Create/update/batch без владельца | Authz как на delete; тест на 403 |
| B-H2 | High | `attachments_service.py` | List/download без ACL; check-upload любой | Передавать user; те же правила, что delete |
| B-H3 | High | `core/security.py` | Plaintext verify | В prod отказ; login → rehash |
| B-H4 | High | `users_crud.py`, `models/users.py` | Alias не уникален, full scan | Unique aliases; SQL lookup |
| B-H5 | High | `requirements.txt` | `python-multipart==0.0.9` | ≥0.0.18 |
| B-H6 | High | `config.py`, compose | CORS `*`, demo-on, `change-me` | Prod: явный origin, `SOKOL_ENV=prod`, demo=0 |
| B-H7 | High | `db/migrations/__init__.py` | Неполный bootstrap | Все патчи + таблица версий или Alembic |
| B-H8 | High | `models/recommendations.py`, crud | Нет UNIQUE sequence, MAX+1 | Unique + `FOR UPDATE` |
| B-H9 | High | `endpoints/attachments.py` | `file.read()` в RAM | Стрим как в tools |
| B-M1 | Done | CRUD ↔ services | Инверсия слоёв | UoW в service; CRUD без импорта services |
| B-M2 | Done | `schemas/recommendations.py` | Битая дата → 422 | `parse_optional_date` |
| B-M3 | Med | `sql_filters.py` | Мусорный period → 500 | Валидация в deps |
| B-M4 | Med | `recommendation_status.py` | `extension_2_reason` как дата | Не парсить reason |
| B-M5 | Med | overlay PATCH | Сброс ручного статуса | Overlay только если даты изменились |
| B-M6 | Med | scheduler | Full table, multi-replica | Фильтр открытых + lock |
| B-M7 | Med | analytics constants | `ANCHOR_YEARS` 2025–2026 | Динамика от данных |
| B-M8 | Med | MinIO delete | До commit | После commit / outbox |
| B-M9 | Med | `http.py` | Header injection | Стрип CR/LF/`"` |
| B-M10 | Med | login | Нет rate-limit | Slowdown / lockout |
| B-M11 | Med | JWT | Нет revoke | Короткий access + blacklist/`iat` |
| B-M12 | Med | ARRAY + junction | Рассинхрон | Один источник или CHECK |
| B-M13 | Med | attachments model | Нет FK | FK или cleanup job |
| B-M14 | Med | tools upload | Нет magic bytes / zip bomb | Лимит uncompressed |
| B-M15 | Med | IntegrityError | 500 | Map → 409 |
| B-M16 | Med | `person_match` | Surname-only = match | Требовать инициалы |
| B-M17 | Med | `date.today()` | Не Москва | `today_moscow()` |
| B-L1 | Done | `UserRead` | Одна схема, `/me` полный | `schemas.users.UserRead` |
| B-L8 | Done | `migrate_*.py` shims | Две кучи патчей | Один пакет `python -m app.db.migrations` |
| B-L9 | Done | `users_crud` commit | UoW в CRUD | flush; commit в service |
| B-L2 | Low | `/ready` | Не пингует MinIO | Опционально; вложения: `/attachments/storage/status` |
| B-L3 | Low | ilike | Wildcard injection | Escape `%` `_` |
| B-L4 | Low | CheckStatus enum | Без `values_callable` | Как у rec |
| B-L5 | Low | OpenAPI | Публичен в Docker | Выключить в prod |
| B-L6 | Low | password min 4 | Слабая политика | 8+ |
| B-L7 | Done | logging | Request-id + тип в логе | Сделано 10.09.2026 |

---

## Подводные камни

1. **`DATABASE_URL` обязателен при import `app.main`** — даже для unit-тестов. Драйвер именно `postgresql+asyncpg://`.
2. **Нет Alembic.** Схема = модели + ручные патчи. Docker прогоняет **не все**. После `create_all` на свежей БД `ADD VALUE` в enum может no-op.
3. **Два файла секретов:** `.env` и `.secrets/sokol.env`. Compose `.env` в `docker/app/`. Легко править не тот.
4. **CORS:** пустая переменная = `*`. Локально фронт 5180 — нужен явный `SOKOL_CORS_ORIGINS`.
5. **Demo:** entrypoint грузит Excel, если checks=0. На «чистой» БД с `SOKOL_ENV=development` зальёт demo. Default флага в bootstrap **True**, в `main.py` assert — **False**.
6. **Логины seed:** `Админ А.А.` / `admin` (alias `admin`), аудиторы = ФИО / `auditor`. Не email.
7. **JWT 8 часов**, смена пароля старые токены не убивает.
8. **Basic auth в dev** — native browser prompt.
9. **Статусы rec** пересчитываются scheduler'ом **и** на каждом create/update. Ручной статус живёт только если terminal (`completed`/`unresolved`) или additional manual (`on_time`/`deadline_violated`).
10. **`execution_deadline` в API ≠ то, что крутит автоматика** (control zone / extensions).
11. **Ключ проверки** только сервер; клиентский `serial_number` на create игнорируется (`pop` в CRUD).
12. **Смена лидера/даты/типа/auditor.code** переписывает serial + копирует MinIO bucket. Падение на середине = расхождение DB/MinIO.
13. **Словари:** удаление лейбла в FK → 409. Переименование каскадит. `Не указан` создаётся сам. Import Excel **досоздаёт** неизвестные labels, UI — нет.
14. **Вложения** только если заданы все три MinIO env; иначе 503. Один bucket `check-{serial}`.
15. **Tools DOCX:** очередь 2 concurrent / 8 queue / 180s wait → 503 + `Retry-After`.
16. **Тесты** ждут `SOKOL_JWT_SECRET` и фейковый `DATABASE_URL`; integration — отдельная `sokol_test`.
17. **`department_head` = admin** (`ADMIN_ROLES`): удаление проверок, словари, пользователи.
18. **Через API нельзя создать admin** — только auditor (`create_auditor_user`). Админы из seed/sync.
19. **Нет API** deactivate/PATCH user.
20. **Analytics period:** `years=2026`, `quarters=2026-Q1`, `months=2026-01`. Иначе 500.
21. **Порты:** Postgres 5433, API локально 8802 / Docker 8800.
22. **`DEPARTMENT_HEAD` и `require_admin`** — если продукт хотел «руководитель видит, не удаляет», сейчас он удаляет.

---

## Приоритетный план

1. **P0.** Authz на create/update/batch/attachments list+download+check-upload. Тест 403.
2. **P0.** Plaintext verify off в prod; unique aliases; CORS не `*` в prod; `python-multipart≥0.0.18`.
3. **P0.** Alembic **или** полный упорядоченный bootstrap + таблица версий. UNIQUE sequence + lock.
4. **P1.** Валидировать analytics periods; IntegrityError → 409.
5. **P1.** Стриминг upload; MinIO delete после commit; один bucket + prefix вместо bucket-per-check.
6. **P1.** `get_user_by_username` по индексу, не full scan. Rate-limit login.
7. **P2.** Prometheus/Sentry по желанию. Scheduler: только открытые + lock. Динамические anchor years.
8. **P2.** Password min 8; argon2; `/me` как источник роли для UI.

Связанные доки: [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [DATA_AND_DB.md](DATA_AND_DB.md), [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md), [CI.md](CI.md).
