# БД: init, данные, бэкапы

Схема: `create_all` + `python -m app.db.migrate_*`. Alembic **не внедрён**. Модель: [DATA_AND_DB.md](DATA_AND_DB.md). Перед `--replace` и ручными migrate на shared/prod — **бэкап**.

## Пути к данным

| Что | Где |
|-----|-----|
| Excel seed (`checks.xlsx`, `recommendations.xlsx`) | корневой `sokol/data/` (или `SOKOL_DATA_DIR`) |
| Шаблон файла контроля, картинки существенности | `sokol-backend/data/` |
| Резолв путей | `app/utils/paths.py` (`get_repo_data_dir`, `SOKOL_DATA_DIR`) |

## Инициализация

```bash
cd sokol-backend
source venv/bin/activate   # Windows: .\venv\Scripts\Activate.ps1

python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
python -m app.db.seed_auditors
python -m app.db.seed_departments
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
python -m app.db.seed_users
```

`seed_users`: `Админ А.А.` (`admin`, alias `admin`), `Ковалев С.С.` (`department_head`), аудиторы. Пароли: `SOKOL_ADMIN_PASSWORD` (default `admin`) для admin/department_head, `SOKOL_DEFAULT_USER_PASSWORD` (default `auditor`) для аудиторов. Lookup логина матчит `username` и `aliases`.

После pull с новыми полями — нужные `migrate_*`. Docker entrypoint уже гоняет `BOOTSTRAP_MIGRATIONS` (список в [DATA_AND_DB.md](DATA_AND_DB.md)).

Альтернатива seed справочников: `python -m app.db.sync_dictionaries`.

## Загрузка данных

**Excel → checks/recommendations** (файлы из корневого `data/` или явные пути):

```bash
python -m app.db.import_seed_data              # добавить новые serial_number
python -m app.db.import_seed_data --replace    # TRUNCATE — только с бэкапом
# при SOKOL_ENV=prod|production нужен ещё --confirm-prod-replace
python -m app.db.import_seed_data --checks PATH --recommendations PATH
```

Неизвестные labels import **досоздаёт**. После импорта при MinIO: `python -m app.db.sync_check_buckets`.

| Команда | Назначение |
|---------|------------|
| `python -m app.db.seed_demo_data` | синтетика без Excel |
| `python -m app.db.bootstrap_presentation_demo` | сгенерировать Excel + import (`--replace` по умолчанию) |
| `python -m app.db.seed_demo_attachments` | демо-файлы во все слоты одной проверки и её рекомендации (нужен живой MinIO) |
| `python -m app.db.recalculate_check_serial_numbers` | пересчёт ключей и связанных serial/buckets |

`--check-id` / `--replace` у `seed_demo_attachments` — выбрать проверку и перезалить слоты.

Полезные скрипты в `sokol-backend/scripts/`: генераторы Excel/demo (`generate_*_excel.py`, `generate_import_templates.py`, `generate_seed_excel.py`), `import_catalog_excel.py`, `check_db_tables.py`, `delete_check_by_name.py`.

**Docker demo:** `SOKOL_LOAD_DEMO_DATA` в entrypoint default **on** (если checks уже есть и нет `SOKOL_SEED_REPLACE` — skip). Compose обычно `SOKOL_LOAD_DEMO_DATA:-1`.  
`SOKOL_ENV=prod` / `production` запрещает demo load; `--replace` без `--confirm-prod-replace` тоже.  
`sync_dictionaries` в prod — merge-only. В development destructive prune включён по умолчанию (`SOKOL_DESTRUCTIVE_DICTIONARY_SYNC`).

## Новый стенд

1. Postgres (+ MinIO)
2. `init_db` + bootstrap-миграции (или вручную `migrate_*`)
3. seed справочников + users
4. import / demo seed
5. `sync_check_buckets`; опционально `seed_demo_attachments`
6. smoke: `/api/v1/status`, `/checks`, `/analytics/checks`

## Бэкапы

```bash
export PGPASSWORD=postgres
pg_dump -h 127.0.0.1 -p 5433 -U postgres -d sokol_db -F c -f sokol_db.dump
pg_restore -h 127.0.0.1 -p 5433 -U postgres -d sokol_db --clean --if-exists sokol_db.dump
```

Dump **не** включает MinIO — бэкапьте volume или `mc mirror` ([docs/MINIO.md](../../docs/MINIO.md)). После restore: `sync_check_buckets`, сверка `attachments`.

```bash
python scripts/check_db_tables.py
```
