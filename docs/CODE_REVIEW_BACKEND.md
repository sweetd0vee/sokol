# Код-ревью backend

**Общая оценка:** 8.6 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO  
**Смысл оценки:** backend готов для пилота на больших таблицах по analytics и основному CRUD; granular RBAC рекомендаций и batch-delete закрывают типовые ошибки импорта; промышленная готовность упирается в Alembic, prod guards для import/seed и auth hardening.

## Архитектура

```
app/api/v1/endpoints/  →  services/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

**Плюсы:** плоская структура, async I/O, DOCX в thread pool, централизованный auth на роутерах.

**Минусы:** `app/db/` смешивает seed/migrate/import.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| API routing / CRUD | **10 / 10** | Роуты разделены по доменам, orchestration вынесен в services, есть pagination, validation, роли и lifecycle tests | Остались только платформенные задачи вне CRUD: миграции/import/prod guards |
| Checks / ключ проверки | **10 / 10** | `serial_number` генерируется backend-only; PATCH и mass recalc синхронизируют recommendations/attachments и MinIO buckets | Нужен production runbook для ручного mass-recalc |
| Recommendations | **10 / 10** | Статусы, фильтры, связи с проверками, atomic batch append/replace, cleanup вложений, batch-delete для отмены импорта, granular RBAC на delete | Для очень больших bulk batches может понадобиться job/progress UI |
| Settings / справочники | **10 / 10** | Общий CRUD для словарей, admin-only mutations, validation в доменных create/PATCH, FK на labels и junction для `audit_object` | Переименование каскадирует строки; удаление in-use даёт 409 |
| Analytics | **8.5 / 10** | Фильтры и агрегаты checks/recommendations/monitoring/dva/planning считаются в PostgreSQL (`GROUP BY`, conditional counts); индексы по датам/статусам/аудиторам | Planning-department matching и effectiveness matrix всё ещё требуют точечной выборки строк |
| DOCX reports | **8 / 10** | Раздел II, links, memorandum и parser вынесены в services и хорошо тестируются | Нет очереди, streaming upload и golden DOCX CI |
| Attachments / MinIO | **8.5 / 10** | Metadata model, storage service, upload/list/download/delete API, compensation, serial bucket migration; upload/delete recommendation attachments с проверкой владельца | Check attachments delete — admin only; нужны policy, backup/restore |
| Auth / RBAC | **8 / 10** | JWT Bearer, lookup роли/`is_active` из БД; admin users API; `person_match` + `recommendation_access` для auditor-owned recommendations и вложений | Basic fallback всегда включён; нет OIDC/audit log |
| БД / миграции / import | **5 / 10** | `create_all`, seed и import позволяют быстро поднять dev/pilot; analytics indexes в entrypoint | Нет Alembic baseline; Docker по умолчанию грузит demo data; часть `migrate_*.py` не входит в entrypoint |
| Tests | **9 / 10** | 139 test cases (+ person_match, RBAC delete, batch-delete service); DB-backed checks CRUD integration | Нужны Alembic/import integration и e2e бизнес-сценарии |

## Security

| Аспект | Статус |
|--------|--------|
| Default JWT secret в dev | ⚠️ override на prod |
| HTTP Basic fallback | ⚠️ отключить/feature-flag на prod |

## DOCX tools
Раздел II (+ links) и докладная/parse-recommendations используются в DOCX-инструментах.

`audit-opinion` не считается частью текущего API: endpoint/routes отсутствуют и уже не описаны в `docs/API.md`. Оставшиеся `SOKOL_OLLAMA_*` — backlog/env-хвост, не готовая функция.

## БД

- Схема: `create_all` + `migrate_*.py` — **нет Alembic** (P0).
- Import `--replace` опасен на prod.
- Entrypoint: init → migrate (в т.ч. `migrate_analytics_indexes`) → seed → optional demo.

## Подробные findings

### BE-01 · P0 · Нет Alembic baseline

**Где:** `app/db/init_db.py`, `app/db/migrate_*.py`, `sokol-backend/docker/app/entrypoint.sh`, `tests/test_checks_crud_integration.py`.

**Симптом:** dev/test/Docker bootstrap поднимают схему через `Base.metadata.create_all()`, а изменения накатываются отдельными скриптами `migrate_*.py`. В `entrypoint.sh` вызывается только часть миграций: `migrate_check_effectiveness`, `migrate_attachments`, `migrate_dictionary_uniqueness`, `migrate_recommendation_observation_name`, `migrate_analytics_indexes`. Остальные `migrate_*.py` могут не попасть на стенд автоматически. В `tests/test_checks_crud_integration.py` схема также создаётся напрямую из metadata.

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


### BE-03 · P1 · HTTP Basic fallback включён всегда

**Где:** `app/api/deps.py`, `app/core/config.py`.

**Симптом:** `get_current_user` принимает и Bearer, и Basic credentials. Basic не ограничен dev/test окружением.

**Риск:** появляется второй способ входа, который легко забыть при hardening. Он не нужен frontend login flow и усложняет аудит доступа.

**Как исправить:** добавить `SOKOL_ENABLE_BASIC_AUTH`; по умолчанию разрешить в development/test, запретить в prod. В `get_current_user` не проверять `_basic`, если flag выключен.

**Тесты:** при prod config Basic получает 401, Bearer продолжает работать.


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

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Alembic |
| P0 | Guard demo import на prod |
| P0 | Demo import off by default в Docker |
| P1 | HTTP Basic fallback prod flag |
| P1 | Prod-safe sync dictionaries |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
