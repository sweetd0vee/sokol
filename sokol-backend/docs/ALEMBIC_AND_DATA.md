# БД: миграции, данные, бэкапы

## Текущее состояние

| Тема | Сейчас |
|------|--------|
| Схема | `create_all` в `init_db.py` |
| Эволюция | `python -m app.db.migrate_*` |
| Alembic | **не внедрён** (цель — см. [PLAN.md](../../PLAN.md)) |

На shared/prod перед `--replace` и ручными migrate — **бэкап**.

## Инициализация

```powershell
cd sokol-backend
.\venv\Scripts\Activate.ps1

python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
python -m app.db.seed_auditors
python -m app.db.seed_departments
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
python -m app.db.seed_users
```

Seed users создаёт `Админ А.А.` (`admin`), `Ковалев С.С.` (`department_head`) и аудиторские логины. Пароли: `SOKOL_ADMIN_PASSWORD` (default `admin`) для admin/department_head, `SOKOL_DEFAULT_USER_PASSWORD` (default `auditor`) для аудиторов.

После pull с новыми полями — нужные `migrate_*`. На живой БД, которую поднимал Docker, уже прогнаны bootstrap-миграции:

```powershell
python -m app.db.migrate_auditor_codes
python -m app.db.migrate_check_quarter
python -m app.db.migrate_check_effectiveness
python -m app.db.migrate_attachments
python -m app.db.migrate_dictionary_uniqueness
python -m app.db.migrate_dictionary_foreign_keys
python -m app.db.migrate_recommendation_observation_name
python -m app.db.migrate_recommendation_indicator_on_control
python -m app.db.migrate_recommendation_additional_indicator
python -m app.db.migrate_analytics_indexes
# полный список — DATA_AND_DB.md
```

Docker entrypoint делает `init_db` + `BOOTSTRAP_MIGRATIONS` + seed справочников + `sync_dictionaries` (auditors/departments/users) автоматически.

## Загрузка данных

**Справочники** — идемпотентные `seed_*` (см. выше) или `python -m app.db.sync_dictionaries`.

**Excel → проверки/рекомендации** (файлы по умолчанию: `data/checks.xlsx`, `data/recommendations.xlsx`):

```powershell
python -m app.db.import_seed_data              # добавить новые serial_number
python -m app.db.import_seed_data --replace    # TRUNCATE — только с бэкапом!
# при SOKOL_ENV=prod нужен ещё --confirm-prod-replace
```

После импорта при MinIO: `python -m app.db.sync_check_buckets`.

**Демо без Excel:** `python -m app.db.seed_demo_data`

**Пересчёт ключей проверок:** `python -m app.db.recalculate_check_serial_numbers`

**Docker demo:** `SOKOL_LOAD_DEMO_DATA=1` (default в compose для development).  
При `SOKOL_ENV=prod` demo load и `SOKOL_SEED_REPLACE=1` падают до bootstrap.  
`sync_dictionaries` в prod — merge-only (не удаляет пользовательские auditors/departments/users). В development destructive prune включён по умолчанию (`SOKOL_DESTRUCTIVE_DICTIONARY_SYNC`).

## Порядок на новом стенде

1. Postgres (+ MinIO)
2. `init_db` + `migrate_*` (или `alembic upgrade head` после внедрения)
3. seed справочников + users
4. import или demo seed
5. `sync_check_buckets`
6. smoke: `/api/v1/status`, `/checks`, `/analytics/checks`

## Бэкапы

**Postgres:**

```powershell
$env:PGPASSWORD = "postgres"
pg_dump -h 127.0.0.1 -p 5433 -U postgres -d sokol_db -F c -f sokol_db.dump
```

**Restore:**

```powershell
pg_restore -h 127.0.0.1 -p 5433 -U postgres -d sokol_db --clean --if-exists sokol_db.dump
```

Dump **не** включает файлы MinIO — бэкапьте volume или `mc mirror`. После restore: `sync_check_buckets`, сверка `attachments`.

## Проверка БД

```powershell
python scripts/check_db_tables.py
docker compose exec db psql -U postgres -d sokol_db -c "SELECT COUNT(*) FROM checks;"
```

## Alembic (целевая модель)

1. Baseline revision → `alembic stamp head` на живой БД.
2. Новые изменения — только через revisions.
3. Убрать `create_all` из prod entrypoint.

Детали переноса `migrate_*.py` — в [PLAN.md](../../PLAN.md).

См. также: [DATA_AND_DB.md](DATA_AND_DB.md), [STORAGE.md](STORAGE.md).
