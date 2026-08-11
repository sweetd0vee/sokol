# Alembic, данные и резервные копии

Практическое руководство по схеме БД, загрузке данных и бэкапам для `sokol-backend`.  
Актуально на **август 2026**.

---

## 1. Текущее состояние (как есть)

| Тема | Сейчас |
|------|--------|
| Миграции | **Alembic ещё не внедрён** |
| Создание схемы | `Base.metadata.create_all` в `app/db/init_db.py` |
| Эволюция схемы | ad-hoc `python -m app.db.migrate_*` |
| Данные | seed справочников + Excel import / demo |
| Бэкапы | нет штатных скриптов в репозитории — делаются через `pg_dump` |

Это нормально для ранней разработки, но **опасно для shared/prod**: нельзя надёжно откатить схему, нельзя гарантировать одинаковый порядок ALTER на всех стендах.

Целевая модель описана ниже (раздел 2–3). До внедрения Alembic используйте раздел 4–7 как runbook для текущих скриптов.

---

## 2. Целевая модель: как должны работать миграции

### 2.1 Принципы

1. **Схема меняется только через Alembic** (`alembic upgrade head` / `downgrade`).
2. **`create_all` запрещён в prod** (оставить только для unit-тестов на SQLite/пустой БД, если нужно).
3. Одна ревизия = один логический шаг (таблица / колонка / enum / индекс).
4. У каждой ревизии есть **`upgrade()` и `downgrade()`**, где это разумно.
5. Data-migration (перекодировка enum, backfill) — отдельная ревизия или явный data-скрипт с пометкой `one-shot`, вызванный из revision.
6. Перед миграцией на shared-стенде — **бэкап** (раздел 7).

### 2.2 Что куда класть

```
sokol-backend/
├── alembic.ini                 # url из env / sqlalchemy.url
├── alembic/
│   ├── env.py                  # async engine, target_metadata = Base.metadata
│   ├── script.py.mako
│   └── versions/
│       ├── 20260811_0001_baseline.py
│       ├── 20260811_0002_check_short_name.py
│       └── …
├── app/db/
│   ├── init_db.py              # после Alembic: тонкая обёртка или deprecated
│   ├── seed_*.py               # справочники (идемпотентные)
│   ├── import_seed_data.py     # Excel → checks/recommendations
│   └── migrate_*.py            # DEPRECATED: оставить только как справку / удалить после переноса
```

### 2.3 Первый запуск Alembic на уже живой БД (baseline)

Если БД уже создана через `create_all` + ручные migrate:

```powershell
cd sokol-backend
.\venv\Scripts\Activate.ps1

# 1) Установить зависимость (добавить в requirements.txt)
pip install alembic

# 2) Инициализация (один раз)
alembic init alembic

# 3) В alembic/env.py:
#    - импортировать все модели (чтобы Base.metadata был полным)
#    - брать DATABASE_URL из Settings
#    - для async: использовать run_sync / async template

# 4) Сгенерировать baseline от текущих моделей
alembic revision --autogenerate -m "baseline"

# 5) ВАЖНО: на существующей БД НЕ применять SQL baseline повторно.
#    Только пометить, что текущая схема = head:
alembic stamp head
```

На **чистой** БД:

```powershell
alembic upgrade head
```

### 2.4 Обычный цикл разработки схемы

```powershell
# 1. Изменили SQLAlchemy-модель в app/models/
# 2. Сгенерировали ревизию
alembic revision --autogenerate -m "add_check_short_name"

# 3. Открыли файл в alembic/versions/ — проверили SQL глазами
#    (autogenerate часто пропускает rename, enum ALTER, server_default)
# 4. Применили локально
alembic upgrade head

# 5. Проверили откат (на копии БД!)
alembic downgrade -1
alembic upgrade head
```

### 2.5 Правила для PostgreSQL enum

Статусы рекомендаций уже менялись вручную — это самый хрупкий участок.

Правильный паттерн в revision:

```python
def upgrade() -> None:
    # 1) ADD VALUE нельзя в транзакции в старых PG — проверить версию
    op.execute("ALTER TYPE recommendationstatus ADD VALUE IF NOT EXISTS 'on_control'")
    # 2) data migrate отдельно
    op.execute("UPDATE recommendations SET status = 'on_control' WHERE status = 'legacy_value'")

def downgrade() -> None:
    # Postgres не умеет просто удалить значение enum —
    # обычно: создать новый тип, привести колонку, дропнуть старый.
    ...
```

Никогда не делайте «тихие» `UPDATE` статусов в обход ревизии на shared-среде.

### 2.6 Docker / entrypoint после внедрения

Сейчас `docker/app/entrypoint.sh` делает:

1. wait DB (+ optional MinIO)
2. `init_db()` (`create_all`)
3. `migrate_check_effectiveness` + `migrate_attachments`
4. seed справочников
5. `sync_check_buckets`
6. optional Excel demo (`SOKOL_LOAD_DEMO_DATA`)

Целевой entrypoint:

```sh
alembic upgrade head
python -m app.db.seed_auditors   # или единый seed_all
# … остальные seed
# optional import_seed_data
```

`create_all` и `migrate_*.py` убрать из bootstrap.

---

## 3. Перенос существующих `migrate_*.py` в Alembic

| Скрипт | Что делает | Как переносить |
|--------|------------|----------------|
| `migrate_recommendation_fields.py` | sequence_number, description, materiality | revision + `IF NOT EXISTS` / nullable defaults |
| `migrate_recommendation_statuses.py` | enum статусов | отдельная enum-revision |
| `migrate_recommendation_closure.py` | поля закрытия | ADD COLUMN |
| `migrate_recommendation_closure_lists.py` | JSON `deadline_extensions`, `control_removals` | ADD COLUMN JSONB |
| `migrate_recommendation_indicators.py` | remap indicator | **data** revision |
| `migrate_materiality_required.py` | default materiality | UPDATE + ALTER |
| `migrate_check_effectiveness.py` | process/svk/sur/svik | ADD COLUMN |
| `migrate_check_short_name.py` | `short_name` | ADD COLUMN |
| `migrate_attachments.py` | таблица `attachments` | CREATE TABLE + индексы |

Порядок переноса:

1. Baseline stamp на стенде, где все migrate уже применены.
2. Новые изменения — только Alembic.
3. Пометить `migrate_*.py` как deprecated в docstring.
4. После 1–2 стабильных релизов — удалить файлы.

Проверка «уже применено» в старых скриптах часто через `information_schema` — в Alembic это не нужно: версия хранится в `alembic_version`.

---

## 4. Инициализация БД сегодня (без Alembic)

### 4.1 Postgres

Локально обычно:

```text
postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db
```

Порт **5433** на хосте → 5432 в контейнере (корневой / backend compose).

### 4.2 Создание таблиц

```powershell
cd sokol-backend
.\venv\Scripts\Activate.ps1
# DATABASE_URL уже в .secrets/sokol.env
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
```

`create_all` **не изменяет** существующие колонки. После pull с новыми полями запускайте нужные migrate:

```powershell
python -m app.db.migrate_check_effectiveness
python -m app.db.migrate_check_short_name
python -m app.db.migrate_attachments
# и другие migrate_* при необходимости
```

### 4.3 Bootstrap в Docker

`entrypoint.sh` уже делает init + ключевые migrate + seed. Для демо-данных:

| Env | Смысл |
|-----|--------|
| `SOKOL_LOAD_DEMO_DATA=1` | импорт Excel после seed |
| `SOKOL_SEED_REPLACE=1` | `TRUNCATE checks, recommendations` перед импортом |

---

## 5. Как правильно загружать данные

### 5.1 Справочники (идемпотентно)

```powershell
python -m app.db.seed_auditors
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
```

Справочники **не связаны FK** с `checks` / `recommendations`: в доменных таблицах хранятся строки (ФИО, вид и т.д.), а справочники кормят UI-select.

### 5.2 Excel → проверки и рекомендации

Файлы по умолчанию: `sokol-backend/data/checks.xlsx`, `recommendations.xlsx`  
(листы: `checks`, `recommendations`).

```powershell
# Добавить недостающие строки (не трогает уже существующие serial_number)
python -m app.db.import_seed_data

# Полная замена доменных данных (ОПАСНО: TRUNCATE CASCADE)
python -m app.db.import_seed_data --replace
```

Свои пути:

```powershell
python -m app.db.import_seed_data --checks path\to\checks.xlsx --recommendations path\to\recs.xlsx
```

**Правила безопасной загрузки:**

1. На shared/prod **не** используйте `--replace`, пока нет свежего бэкапа.
2. Сначала прогоните на копии БД.
3. Проверьте уникальность `serial_number` проверок.
4. Рекомендации без известного `serial_number` проверки не привяжутся — смотрите лог импорта.
5. После импорта при включённом MinIO: `python -m app.db.sync_check_buckets`.

### 5.3 Генерация Excel

```powershell
python scripts/generate_seed_excel.py
python scripts/generate_import_templates.py
python scripts/generate_weighted_demo_excel.py
```

### 5.4 Синтетическое демо без Excel

```powershell
python -m app.db.seed_demo_data
```

### 5.5 Рекомендуемый порядок на новом стенде

```text
1. Поднять Postgres (+ MinIO при необходимости)
2. alembic upgrade head   # или init_db + migrate_* пока нет Alembic
3. seed справочников
4. import_seed_data (без --replace) ИЛИ seed_demo_data
5. sync_check_buckets
6. smoke: GET /api/v1/status, GET /checks, GET /analytics/checks
```

---

## 6. Проверка состояния БД

```powershell
python scripts/check_db_tables.py
```

Вручную через `psql` (Docker):

```powershell
docker compose exec db psql -U postgres -d sokol_db -c "\dt"
docker compose exec db psql -U postgres -d sokol_db -c "SELECT COUNT(*) FROM checks;"
docker compose exec db psql -U postgres -d sokol_db -c "SELECT * FROM alembic_version;"  # после внедрения
```

---

## 7. Резервные копии и восстановление

### 7.1 Логический бэкап (рекомендуется)

**Dump только схемы + данных PostgreSQL:**

```powershell
# из хоста, порт 5433
$env:PGPASSWORD = "postgres"
pg_dump -h 127.0.0.1 -p 5433 -U postgres -d sokol_db -F c -f "sokol_db_$(Get-Date -Format yyyyMMdd_HHmm).dump"
```

Или из контейнера:

```powershell
docker compose exec -T db pg_dump -U postgres -d sokol_db -F c > sokol_db.dump
```

**Plain SQL** (удобно читать глазами, больше размер):

```powershell
pg_dump -h 127.0.0.1 -p 5433 -U postgres -d sokol_db -f sokol_db.sql
```

### 7.2 Восстановление

```powershell
# custom format (-F c)
$env:PGPASSWORD = "postgres"
pg_restore -h 127.0.0.1 -p 5433 -U postgres -d sokol_db --clean --if-exists sokol_db.dump
```

Для plain SQL:

```powershell
psql -h 127.0.0.1 -p 5433 -U postgres -d sokol_db -f sokol_db.sql
```

Перед restore на occupied DB убедитесь, что приложение остановлено (нет активных соединений) или используйте `--clean`.

### 7.3 MinIO / вложения

PostgreSQL-дамп **не** содержит файлов из бакетов. Для полного бэкапа:

```powershell
# пример: mc mirror (MinIO Client)
mc alias set local http://127.0.0.1:9000 minioadmin minioadmin
mc mirror local/ backups/minio/
```

Или архивируйте volume Docker, где лежит MinIO data.

Порядок полного DR:

1. Восстановить Postgres.
2. Восстановить MinIO buckets.
3. `alembic upgrade head` (если схема бэкапа старше кода — осторожно).
4. `python -m app.db.sync_check_buckets` — создать недостающие бакеты.
5. Сверить `attachments` ↔ объекты в storage.

### 7.4 Когда делать бэкап

| Событие | Обязательно |
|---------|-------------|
| Перед `import_seed_data --replace` | да |
| Перед Alembic upgrade на shared | да |
| Перед ручным `migrate_*.py` на shared | да |
| Перед крупным ALTER enum | да |
| Ежедневно на prod (когда появится) | да + offsite копия |

### 7.5 Что не является бэкапом

- Git-репозиторий (нет прод-данных).
- Excel seed-файлы (шаблон/демо, не снимок БД).
- Volume snapshot без процедуры restore-теста.

Раз в квартал (лучше чаще) делайте **пробное восстановление** на пустой Postgres.

---

## 8. Чеклист перед выкладкой схемы

- [ ] Локально: `alembic upgrade head` на чистой БД проходит.
- [ ] Локально: `alembic downgrade -1` + `upgrade head` (если revision откатываема).
- [ ] Autogenerate diff просмотрен вручную.
- [ ] Data-migration идемпотентна или защищена условием.
- [ ] Снят бэкап целевой БД.
- [ ] После upgrade: seed справочников не ломается; smoke API ок.
- [ ] Документы `DATA_AND_DB.md` / этот файл обновлены при смене процедуры.

---

## 9. Связанные документы

| Документ | Тема |
|----------|------|
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модели, enum’ы, ER |
| [STORAGE.md](STORAGE.md) | MinIO и attachments |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Локальный запуск |
| [PLAN.md](../../PLAN.md) | Playbook B (Alembic) |
| [DOCKER.md](../../DOCKER.md) | Compose, тома Postgres/MinIO |
