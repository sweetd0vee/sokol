# Код-ревью backend

**Общая оценка:** 8.1 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO  
**Смысл оценки:** backend уже выглядит как рабочий API для пилота, но промышленная готовность упирается в миграции, оставшийся auth hardening, lifecycle файлов в MinIO и защиту import/seed операций.

## Архитектура

```
app/api/v1/endpoints/  →  services/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

**Плюсы:** плоская структура, async I/O, DOCX в thread pool, централизованный auth на роутерах.

**Минусы:** `app/db/` смешивает seed/migrate/import; дублирование section_ii в `sokol-instruments/`.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| API routing / CRUD | **10 / 10** | Роуты разделены по доменам, orchestration вынесен в services, есть pagination, validation, роли и lifecycle tests | Остались только платформенные задачи вне CRUD: миграции/import/prod guards |
| Checks / ключ проверки | **10 / 10** | `serial_number` генерируется backend-only; PATCH и mass recalc синхронизируют recommendations/attachments и MinIO buckets | Нужен production runbook для ручного mass-recalc |
| Recommendations | **10 / 10** | Статусы, фильтры, связи с проверками, atomic batch append/replace и cleanup вложений закрывают основной lifecycle | Для больших bulk batches может понадобиться отдельный job/progress UI |
| Settings / справочники | **8 / 10** | Общий CRUD для словарей, admin-only mutations, validation в доменных create/PATCH | Нет FK на доменные поля, часть связей строковая |
| Analytics | **7.5 / 10** | Серверные агрегаты по checks/recommendations/monitoring/dva/planning согласованы с UI | In-memory подход нормален для пилота, но не для большого портфеля |
| DOCX reports | **8 / 10** | Раздел II, links, memorandum и parser вынесены в services и хорошо тестируются | Нет очереди, streaming upload и golden DOCX CI |
| Attachments / MinIO | **8 / 10** | Есть metadata model, storage service, upload/list/download/delete API, compensation и serial bucket migration | Нужны policy, backup/restore и общий storage UX |
| Auth / RBAC | **7 / 10** | JWT Bearer закрывает API; Bearer lookup читает пользователя/роль из БД и проверяет `is_active`; роли `auditor`/`admin` применены на delete/settings | Basic fallback всегда включён; нет OIDC/audit log |
| БД / миграции / import | **5 / 10** | `create_all`, seed и import позволяют быстро поднять dev/pilot | Нет Alembic baseline; Docker по умолчанию грузит demo data; часть `migrate_*.py` не входит в entrypoint |
| Tests | **8.5 / 10** | 116 backend unittest/regression tests, auth/attachments/dictionaries/analytics, lifecycle tests и DB-backed checks CRUD integration | Нужны Alembic/import integration и e2e бизнес-сценарии |

## Security

| Аспект | Статус |
|--------|--------|
| JWT Bearer | ✅ |
| PBKDF2 пароли | ✅ |
| DELETE / settings | admin only ✅ |
| Bearer role из БД + `is_active` | ✅ |
| Default JWT secret в dev | ⚠️ override на prod |
| HTTP Basic fallback | ⚠️ отключить/feature-flag на prod |

## API

- Pagination checks/recommendations: skip/limit ✅
- Dictionary validation на create/update ✅
- Analytics: in-memory по всей БД — OK до ~1k записей
- Attachments + MinIO ✅
- Recommendations batch append/replace ✅

### Ключ проверки ✅

`checks_crud.py`: create генерирует unique serial; PATCH пересчитывает при смене `start_date` / `check_leader` / `check_type`; каскад на `recommendations.serial_number`, `attachments.check_serial_number`, `attachments.bucket`; MinIO objects переносятся в bucket нового serial.

## DOCX tools

| Tool | Статус |
|------|--------|
| Раздел II (+ links) | ✅ реализовано, ~70+ parser tests |
| Докладная / parse-recommendations | ✅ |

`audit-opinion` не считается частью текущего API: endpoint/routes отсутствуют и уже не описаны в `docs/API.md`. Оставшиеся `SOKOL_OLLAMA_*` — backlog/env-хвост, не готовая функция.

## БД

- Схема: `create_all` + `migrate_*.py` — **нет Alembic** (P0).
- Import `--replace` опасен на prod.
- Entrypoint: init → migrate → seed → optional demo.

## Тесты

`py -3.12 -m unittest discover -s tests`: 116 тестов, OK (2 skipped). Новые regression tests покрывают Bearer lookup, recommendation batch API, delete cleanup, serial lifecycle storage migration и устаревший service-layer mock в auth/RBAC. DB-backed integration уже есть для checks CRUD; дальше нужны Alembic/import integration и e2e бизнес-сценарии.

## Подробные findings

### BE-01 · P0 · Нет Alembic baseline

**Где:** `app/db/init_db.py`, `app/db/migrate_*.py`, `sokol-backend/docker/app/entrypoint.sh`, `tests/test_checks_crud_integration.py`.

**Симптом:** dev/test/Docker bootstrap поднимают схему через `Base.metadata.create_all()`, а изменения накатываются отдельными скриптами `migrate_*.py`. В `entrypoint.sh` вызывается только часть миграций: `migrate_check_effectiveness`, `migrate_attachments`, `migrate_dictionary_uniqueness`, `migrate_recommendation_observation_name`. Остальные `migrate_*.py` могут не попасть на стенд автоматически. В `tests/test_checks_crud_integration.py` схема также создаётся напрямую из metadata.

**Риск:** на UAT/prod невозможно надёжно воспроизвести историю схемы, проверить порядок миграций и откатить неудачное изменение. Разные окружения могут иметь разные наборы колонок/индексов, хотя код уже ожидает новые поля.

**Как исправить:**

1. Добавить Alembic в backend dependencies.
2. Создать baseline revision по текущему состоянию моделей.
3. Зафиксировать, какие существующие `migrate_*.py` считаются уже применёнными.
4. В deploy/runbook заменить `init_db/create_all` для prod на `alembic upgrade head`.
5. Оставить `create_all` только для локального ephemeral dev/test, если это действительно нужно.

**Тесты:** пустая PostgreSQL БД → `alembic upgrade head` → приложение стартует; повторный `upgrade head` не меняет схему; новая миграция имеет downgrade или явно documented no-downgrade.

### BE-01a · P0 · Docker по умолчанию грузит demo data

**Где:** `sokol-backend/docker/app/entrypoint.sh`, `sokol-backend/docker/app/docker-compose.yml`, `app/db/import_seed_data.py`.

**Симптом:** compose задаёт `SOKOL_LOAD_DEMO_DATA: ${SOKOL_LOAD_DEMO_DATA:-1}`. Entry point при пустой таблице `checks` запускает `import_seed_data()`. Если включить `SOKOL_SEED_REPLACE=1`, `import_seed_data(replace=True)` делает `TRUNCATE TABLE recommendations, checks RESTART IDENTITY CASCADE`.

**Риск:** на пустом UAT/prod контейнер может сам загрузить demo Excel. При ошибочном `SOKOL_SEED_REPLACE=1` рабочие проверки и рекомендации будут очищены.

**Как исправить:**

1. Поменять default `SOKOL_LOAD_DEMO_DATA` в compose/entrypoint на `0`.
2. В `startup_validation.py` добавить prod guard: `SOKOL_ENV=prod` несовместим с demo load и seed replace.
3. Для demo стенда оставить явный opt-in в `.env.demo`.
4. В runbook написать, что prod import только через dry-run + backup + confirm.

**Тесты:** prod + `SOKOL_LOAD_DEMO_DATA=1` падает до старта; prod + `SOKOL_SEED_REPLACE=1` падает; default compose env не включает demo load.

### BE-02 · P1 · Bearer auth доверял role из JWT — закрыто

**Где:** `app/api/deps.py`, `tests/test_auth_rbac.py`.

**Было:** `get_current_user` декодировал token и возвращал `CurrentUser` из полей `sub`, `role`, `display_name`. База пользователей не читалась для Bearer-запроса.

**Исправлено:** Bearer-ветка берёт из JWT только `sub`, читает пользователя через `get_user_by_username(session, username)`, проверяет `user is not None` и `user.is_active`, затем формирует `CurrentUser` из БД. `role` и `display_name` в token остались неавторитетными.

**Тесты:** добавлены regression tests: валидный JWT деактивированного пользователя возвращает 401; пользователь с token роли admin, но ролью auditor в БД, получает 403 на admin endpoint.

### BE-03 · P1 · HTTP Basic fallback включён всегда

**Где:** `app/api/deps.py`, `app/core/config.py`.

**Симптом:** `get_current_user` принимает и Bearer, и Basic credentials. Basic не ограничен dev/test окружением.

**Риск:** появляется второй способ входа, который легко забыть при hardening. Он не нужен frontend login flow и усложняет аудит доступа.

**Как исправить:** добавить `SOKOL_ENABLE_BASIC_AUTH`; по умолчанию разрешить в development/test, запретить в prod. В `get_current_user` не проверять `_basic`, если flag выключен.

**Тесты:** при prod config Basic получает 401, Bearer продолжает работать.

### BE-04 · P1 · Delete recommendation оставлял orphan attachments — закрыто

**Где:** `app/crud/recommendations_crud.py`, `app/api/v1/endpoints/recommendations.py`, `app/models/attachments.py`, `app/services/storage/minio_storage.py`.

**Было:** `delete_recommendation` удалял recommendation и renumber, но не трогал attachments.

**Исправлено:** `recommendations_service.delete_recommendation` вызывает `attachments_service.delete_attachments_for_entity`, удаляет MinIO objects и rows, затем удаляет recommendation и renumber в одной transaction. Storage failure маппится в 502.

**Тесты:** service/API regression tests на cleanup и 502 mapping.

### BE-05 · P1 · Смена serial_number не переносила MinIO bucket — закрыто

**Где:** `app/crud/checks_crud.py`, `app/services/storage/minio_storage.py`, `app/db/recalculate_check_serial_numbers.py`.

**Было:** при PATCH проверки код обновлял `recommendations.serial_number` и `attachments.check_serial_number`, но `Attachment.bucket` оставался старым.

**Исправлено:** добавлен `MinioStorage.copy_check_bucket_objects`; PATCH serial копирует objects в bucket нового serial, обновляет `attachments.bucket`, commit-ит изменения и удаляет старый bucket. Mass recalc использует тот же primitive.

**Тесты:** regression test фиксирует storage copy/delete и cascade execution.

### BE-06 · P1 · Upload мог оставить object без DB row — закрыто

**Где:** `app/api/v1/endpoints/attachments.py`.

**Было:** endpoint загружал файл в MinIO, затем создавал `Attachment` row. Если DB commit падал после upload, object оставался orphan.

**Исправлено:** `attachments_service.upload_attachment` при исключении после upload вызывает `storage.delete_object(stored.bucket, stored.object_key)` и логирует cleanup failure отдельно.

**Тесты:** покрыто lifecycle regression набором.

### BE-07 · P1 · Import/seed replace опасен для рабочей БД

**Где:** `app/db/import_seed_data.py`, `app/db/seed_demo_data.py`, `app/db/bootstrap_presentation_demo.py`.

**Симптом:** `--replace` делает `TRUNCATE TABLE recommendations, checks RESTART IDENTITY CASCADE`. `bootstrap_presentation_demo` по умолчанию вызывает replace.

**Риск:** запуск не в той среде стирает рабочие проверки и рекомендации. Сейчас защита только организационная.

**Как исправить:** запретить replace при `SOKOL_ENV=prod` без явного `--confirm-prod-replace`; добавить dry-run, отчёт сколько строк будет удалено/создано, и backup warning.

**Тесты:** prod replace без confirm падает; dry-run не меняет БД; replace требует database name с `test/demo` в тестовом сценарии.

### BE-07a · P1 · `sync_dictionaries` удаляет пользовательские справочники на старте

**Где:** `app/db/sync_dictionaries.py`, `sokol-backend/docker/app/entrypoint.sh`.

**Симптом:** `sync_auditors`, `sync_departments`, `sync_users` сравнивают БД с каноническими списками `AUDITORS`/`DEPARTMENTS`. Всё, чего нет в списках, удаляется. Entry point вызывает sync при каждом старте контейнера.

**Риск:** администратор может добавить аудитора, подразделение или пользователя через UI/API, а после рестарта контейнера запись исчезнет. Checks/recommendations хранят строковые ссылки, поэтому исторические данные могут остаться с “висячими” значениями.

**Как исправить:**

1. Для prod сделать sync merge-only: добавлять недостающие системные записи, но не удалять пользовательские.
2. Destructive sync оставить только для dev/demo через explicit flag.
3. Перед удалением проверять использование в checks/recommendations и писать отчёт.
4. Для users вместо delete рассмотреть `is_active=false` с audit trail.

**Тесты:** добавить auditor/department/user через API, запустить prod bootstrap sync, запись остаётся; destructive sync работает только с dev/demo flag.

### BE-08 · P2 · Analytics in-memory масштабируется только для пилота

**Где:** `app/services/analytics/*`, `app/api/v1/endpoints/analytics.py`.

**Симптом:** аналитические сервисы возвращают полезные агрегаты, но значимая часть расчётов держится в Python-слое после выборки данных.

**Риск:** при росте портфеля проверки/рекомендации начнут тормозить dashboards и экспорты; pagination в CRUD не решает analytics.

**Как исправить:** самые тяжёлые агрегаты перенести в SQL `GROUP BY`; добавить индексы по датам, статусам, serial/check_id; для dashboard использовать cache с invalidation после CRUD.

**Тесты:** performance fixture на 5k/20k rows; snapshot агрегатов до/после SQL rewrite.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Alembic |
| P0 | Guard demo import на prod |
| P0 | Demo import off by default в Docker |
| P1 | HTTP Basic fallback prod flag |
| P1 | Prod-safe sync dictionaries |
| P2 | Analytics SQL aggregates при росте данных |
| P3 | Consolidate sokol-instruments |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
