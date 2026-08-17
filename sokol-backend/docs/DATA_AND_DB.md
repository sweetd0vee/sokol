# Данные и БД

PostgreSQL 16 · SQLAlchemy 2 async · `asyncpg` · порт хоста **5433**.

Схема: `create_all` (`init_db.py`) + ad-hoc `migrate_*.py`. Alembic — в плане ([ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)).

## Сущности

| Таблица | PK | Связи |
|---------|-----|-------|
| `checks` | int | → recommendations (cascade) |
| `recommendations` | int | FK `check_id` |
| `auditors`, `audit_types`, `check_kinds`, `effectiveness_ratings` | UUID | справочники (без FK на домен) |
| `attachments` | int | entity + bucket `check-{serial}` |

Справочники хранят допустимые значения; в checks/recommendations — строки (ФИО, вид проверки и т.д.).

**Validation на API** (`dictionary_validation.py`):

- `check_leader`, `auditor` ∈ `auditors.full_name`
- `check_view` ∈ `check_kinds.label`
- `*_effectiveness` ∈ `effectiveness_ratings.label`
- `manager` — свободный текст

Import/seed обходят validation.

## Enum'ы

**CheckStatus:** `not_started`, `in_progress`, `completed`

**RecommendationStatus:** `completed`, `unresolved`, `on_control`, `in_progress`

**RecommendationAdditionalStatus:** `on_time`, `deadline_violated`, `on_control`

В БД пишутся **values**, не имена членов enum.

## Ключ проверки

`serial_number` — уникален, генерируется и пересчитывается на backend (`check_key.py`) из года начала, кода аудитора, квартала, типа и порядкового номера. Frontend не отправляет ключ в create/update payload, а показывает значение из ответа API. При смене даты начала, квартала, руководителя или типа проверки backend обновляет ключ и синхронизирует `recommendations.serial_number` / `attachments.check_serial_number`.

## Seed и import

| Модуль | Назначение |
|--------|------------|
| `seed_auditors`, `seed_audit_types`, `seed_check_kinds`, `seed_effectiveness_ratings` | справочники |
| `import_seed_data.py` | Excel → checks/recommendations |
| `seed_demo_data.py` | синтетика |
| `sync_check_buckets.py` | MinIO buckets |

Команды: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

## Migrate-скрипты

`migrate_recommendation_*`, `migrate_check_*`, `migrate_attachments`, `migrate_materiality_required` — запуск вручную или из Docker entrypoint при обновлении живой БД.

## Ограничения

Нет soft-delete и audit log. Analytics грузит все записи в память процесса. Enum ALTER на prod — только с бэкапом.

Вложения: [STORAGE.md](STORAGE.md).
