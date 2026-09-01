# Данные и БД

PostgreSQL 16 · SQLAlchemy 2 async · `asyncpg` · порт хоста **5433**.

Схема: `create_all` (`init_db.py`) + ad-hoc `migrate_*.py`. Alembic — в плане ([ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)).

## Сущности

| Таблица | PK | Связи |
|---------|-----|-------|
| `checks` | int | → recommendations (cascade) |
| `recommendations` | int | FK `check_id` |
| `auditors`, `departments`, `check_kinds`, `effectiveness_ratings`, `audit_types` | UUID | справочники; labels/code уникальны |
| `recommendation_audit_objects` | `(recommendation_id, department_name)` | FK на recommendations и departments |
| `attachments` | int | entity + bucket `check-{serial}` |

Справочники хранят допустимые значения. В checks/recommendations те же строки, но с физическими FK на unique labels (`ON UPDATE CASCADE`, `ON DELETE RESTRICT` / `SET NULL` для оценок).

**Validation на API** (`dictionary_validation.py` + FK):

- `check_leader`, `auditor` ∈ `auditors.full_name`
- `check_view` ∈ `check_kinds.label`
- `*_effectiveness` ∈ `effectiveness_ratings.label` (пустое → `NULL`)
- `audit_object` канонизируется по `departments`; пишется массив и junction
- `manager` — свободный текст
- удаление in-use значения и «Не указан» → ошибка справочника (**409**)

Import/seed сначала `ensure_*` недостающие labels, затем вставляет строки и junction.

## Enum'ы

**CheckStatus:** `not_started`, `in_progress`, `completed`

**RecommendationStatus:** `completed`, `unresolved`, `on_control`, `in_progress`

**RecommendationAdditionalStatus:** `on_time`, `deadline_violated`, `on_control`

В БД пишутся **values**, не имена членов enum.

## Ключ проверки

`serial_number` — уникален, генерируется и пересчитывается на backend (`check_key.py`) из года начала, кода аудитора, квартала, типа и порядкового номера. Frontend не отправляет ключ в create/update payload, а показывает значение из ответа API. При смене даты начала, квартала, руководителя или типа проверки backend обновляет ключ и синхронизирует `recommendations.serial_number` / `attachments.check_serial_number`.

## Пакет `app/db`

| Каталог / модуль | Назначение |
|------------------|------------|
| `session.py`, `init_db.py` | async engine, `create_all` |
| `catalogs/` | канонические списки (аудиторы, департаменты, виды, типы, оценки, users) |
| `seeds/` | идемпотентный insert справочников |
| `migrations/` | ad-hoc SQL/data patches; `run_bootstrap_migrations()` — порядок Docker |
| `bootstrap.py` | Docker entrypoint и presentation demo |
| корневые `seed_*` / `migrate_*` | CLI (`python -m app.db.…`), реэкспорт |

## Seed и import

| Модуль | Назначение |
|--------|------------|
| `seed_auditors`, `seed_audit_types`, `seed_check_kinds`, `seed_effectiveness_ratings` | справочники |
| `import_seed_data.py` | Excel → checks/recommendations |
| `seed_demo_data.py` | синтетика |
| `sync_check_buckets.py` | MinIO buckets |

Команды: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

## Migrate-скрипты

`migrate_recommendation_*`, `migrate_check_*`, `migrate_attachments`, `migrate_dictionary_uniqueness`, `migrate_dictionary_foreign_keys` — запуск вручную или из Docker entrypoint при обновлении живой БД.

## Ограничения

Нет soft-delete и audit log. `check_type` (`planned`/`unscheduled`/`thematic`) — код ключа проверки, не FK на `audit_types` (КП/ВП/ПП). Enum ALTER на prod — только с бэкапом.

Вложения: [STORAGE.md](STORAGE.md).
