# Код-ревью backend

**Дата:** 4 сентября 2026  
**Оценка:** 8.9 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO

Готов к пилоту: CRUD, SQL-analytics, granular RBAC, FK-справочники, prod-guards. Промышленный контур упирается в Alembic. Контракты: [sokol-backend/docs](../sokol-backend/docs/README.md).

## Архитектура

```
app/api/v1/endpoints/  →  services/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX/XLSX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

`app/db/` смешивает seed/migrate/import. Схема без Alembic: `create_all` + идемпотентные `migrate_*` (`BOOTSTRAP_MIGRATIONS` в Docker).

## Блоки

| Блок | Оценка | Ограничение |
|------|--------|-------------|
| API / CRUD | **10** | Alembic вне CRUD |
| Ключ проверки | **10** | Mass-recalc только с бэкапом |
| Recommendations | **10** | Крупный batch без job/progress |
| Settings | **9** | `audit_types` не связан с `check_type` (КП/ВП/ПП ≠ planned/V/K); FK на labels, не UUID |
| Analytics | **9** | Читает `audit_object[]`, не junction |
| DOCX | **10** | Очередь с лимитом слотов; golden pipeline в unittest |
| Attachments | **8.5** | Check delete — admin; backup drill не подтверждён |
| Auth | **8.5** | Нет OIDC/audit log; Basic только development |
| БД / import | **6** | Нет Alembic; demo default on в Docker; import досоздаёт labels |
| Tests | **9** | ~200 unittest (+ DB integration в CI); нет Alembic/e2e бизнес-сценариев |

## Security (как в коде)

| Аспект | Поведение |
|--------|-----------|
| JWT secret в prod | default/короткий (<32 символов) блокирует старт |
| HTTP Basic | off в prod, пока не `SOKOL_ENABLE_BASIC_AUTH=true` |
| Demo / `--replace` | запрещены при `SOKOL_ENV=prod`; replace в prod только с `--confirm-prod-replace` |
| `sync_dictionaries` | в prod merge-only |

`audit-opinion` / Ollama в API нет.

## Открытые findings

### BE-01 · P0 · Нет Alembic

`init_db` + `migrate_*`. Entrypoint гоняет только `BOOTSTRAP_MIGRATIONS`. На UAT/prod нет history/rollback.

**Сделать:** baseline → `alembic upgrade head` в deploy; `create_all` только для ephemeral test. Fallback: подписанный runbook порядка `migrate_*`.

### BE-01a · P0 · Docker demo default on — частично

Prod-guard есть. Compose всё ещё `SOKOL_LOAD_DEMO_DATA:-1`. UAT/prod: `SOKOL_ENV=prod` и `SOKOL_LOAD_DEMO_DATA=0`.

### Import · P0/P1

CRUD валидирует справочники. `import_seed_data` делает `ensure_*` (досоздаёт). Нет `--dry-run` / reject report.

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
