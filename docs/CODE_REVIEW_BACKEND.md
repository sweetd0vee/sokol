# Код-ревью backend

**Дата:** 19 августа 2026  
**Общая оценка:** 8.7 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO  
**Смысл оценки:** backend готов для пилота: CRUD, analytics SQL, granular RBAC, FK-справочники и prod-guards на destructive bootstrap закрывают основные операционные дыры. Промышленный контур по-прежнему упирается в Alembic.

## Архитектура

```
app/api/v1/endpoints/  →  services/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

**Плюсы:** плоская структура, async I/O, DOCX в thread pool, централизованный auth, доменные services, физические FK на labels справочников.

**Минусы:** `app/db/` смешивает seed/migrate/import; схема без Alembic.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| API routing / CRUD | **10 / 10** | Роуты по доменам, orchestration в services, pagination, validation, роли, lifecycle tests | Платформенные задачи вне CRUD: Alembic |
| Checks / ключ проверки | **10 / 10** | `serial_number` backend-only; PATCH и mass recalc синхронизируют recommendations/attachments и MinIO buckets | Нужен production runbook для ручного mass-recalc |
| Recommendations | **10 / 10** | Статусы, фильтры, связи с проверками, atomic batch, cleanup вложений, batch-delete, granular RBAC, junction `recommendation_audit_objects` | Для очень больших bulk batches может понадобиться job/progress UI |
| Settings / справочники | **9 / 10** | Общий CRUD, admin-only mutations, unique labels, FK + `ON UPDATE CASCADE`, 409 на in-use/protected «Не указан» | `audit_types` не связан с `checks.check_type` (это другой код: КП/ВП/ПП vs planned/unscheduled/thematic); связи всё ещё строковые labels, не UUID |
| Analytics | **8.5 / 10** | Фильтры и агрегаты в PostgreSQL; индексы по датам/статусам/аудиторам | Planning-department matching и effectiveness matrix требуют точечной выборки; analytics читает массив `audit_object`, не junction |
| DOCX reports | **8 / 10** | Раздел II, links, memorandum и parser вынесены в services и тестируются | Нет очереди, streaming upload и golden DOCX CI |
| Attachments / MinIO | **8.5 / 10** | Metadata model, storage service, upload/list/download/delete, compensation, serial bucket migration | Check attachments delete — admin only; нужны policy, backup/restore |
| Auth / RBAC | **8.5 / 10** | JWT Bearer, lookup роли/`is_active` из БД; admin users API; `person_match` + `recommendation_access`; HTTP Basic выключен в prod по умолчанию; deactivated user не проходит Basic | Нет OIDC/audit log; Basic остаётся вторым контуром в development |
| БД / миграции / import | **6 / 10** | `create_all`, seed, import; FK-миграция; prod запрещает demo load и `--replace` без confirm; sync справочников в prod merge-only | Нет Alembic baseline; Docker в development по умолчанию грузит demo; часть `migrate_*.py` не в entrypoint |
| Tests | **9 / 10** | **172** test cases (2 skipped): CRUD, RBAC, Basic auth, dictionary FK/in-use, prod guards, analytics, DOCX | Нужны Alembic/import integration и e2e бизнес-сценарии |

## Security

| Аспект | Статус |
|--------|--------|
| Default JWT secret в prod | блокирует старт |
| HTTP Basic | выключен в prod, если не задан `SOKOL_ENABLE_BASIC_AUTH=true` |
| Demo load / seed replace | запрещены при `SOKOL_ENV=prod` |
| Destructive dictionary sync | в prod merge-only |

## DOCX tools

Раздел II (+ links) и докладная/parse-recommendations используются в DOCX-инструментах.

`audit-opinion` не входит в API: endpoint/routes отсутствуют. LLM не подключён.

## БД

- Схема: `create_all` + `migrate_*.py` — **нет Alembic** (P0).
- FK: `checks.check_leader/check_view/*_effectiveness`, `recommendations.auditor`, `recommendation_audit_objects`.
- Import `--replace` в prod только с `--confirm-prod-replace`.
- Entrypoint: init → migrate (в т.ч. uniqueness + dictionary FKs + analytics indexes) → seed → optional demo (не в prod).

## Подробные findings

### BE-01 · P0 · Нет Alembic baseline — открыт

**Где:** `app/db/init_db.py`, `app/db/migrate_*.py`, `docker/app/entrypoint.sh`.

**Симптом:** схема через `create_all()` + ad-hoc `migrate_*.py`. Entrypoint вызывает не все migrate-скрипты.

**Риск:** UAT/prod не воспроизводят историю схемы, нет rollback.

**Как исправить:** Alembic baseline, `upgrade head` в deploy, `create_all` только для ephemeral dev/test.

### BE-01a · P0 · Docker demo load — частично закрыт

**Где:** `docker/app/entrypoint.sh`, `docker/app/docker-compose.yml`, `app/core/startup_validation.py`.

**Сделано:** при `SOKOL_ENV=prod` `SOKOL_LOAD_DEMO_DATA` и `SOKOL_SEED_REPLACE` падают до bootstrap и до старта API. Compose задаёт `SOKOL_ENV=development` по умолчанию.

**Осталось:** compose default `SOKOL_LOAD_DEMO_DATA=1` сохранён для локального Docker; prod-стенд обязан ставить `SOKOL_ENV=prod` и `SOKOL_LOAD_DEMO_DATA=0`.

### BE-03 · P1 · HTTP Basic — закрыт

`SOKOL_ENABLE_BASIC_AUTH`: в development включён, в prod выключен. Deactivated user не проходит Basic. Тесты в `test_auth_rbac.py`.

### BE-07 · P1 · Import/seed replace — закрыт для prod

`assert_seed_replace_safe_for_env`: prod без `--confirm-prod-replace` падает. Покрыто unit-тестами.

### BE-07a · P1 · Destructive sync — закрыт для prod

`sync_auditors` / `sync_departments` / `sync_users` в prod не удаляют пользовательские записи. In-use labels не удаляются и в development. Dev может выключить delete через `SOKOL_DESTRUCTIVE_DICTIONARY_SYNC=0`.

## Findings

| Приоритет | Finding | Статус |
|-----------|---------|--------|
| P0 | Alembic | открыт |
| P0 | Guard demo import на prod | закрыт (через `SOKOL_ENV=prod`) |
| P0 | Demo import off by default в Docker | частично: default 1 в development compose |
| P1 | HTTP Basic fallback prod flag | закрыт |
| P1 | Prod-safe sync dictionaries | закрыт |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
