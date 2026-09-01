# Данные и БД

PostgreSQL 16 · SQLAlchemy 2 async · `asyncpg` · порт хоста **5433**.

Схема: `create_all` (`init_db.py`) + ad-hoc `migrate_*.py`. Alembic — в плане ([ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)).

## Сущности

| Таблица | PK | Связи |
|---------|-----|-------|
| `checks` | int | → recommendations (cascade) |
| `recommendations` | int | FK `check_id` |
| `auditors` | UUID | unique `full_name`, unique `code` (3 латинские буквы) |
| `departments`, `check_kinds`, `effectiveness_ratings`, `audit_types` | UUID | справочники; labels/code уникальны (кроме `audit_types`) |
| `recommendation_audit_objects` | `(recommendation_id, department_name)` | FK на recommendations и departments |
| `attachments` | int | entity + bucket `check-{serial}` |
| `users` | UUID | unique `username`; роли `admin` / `department_head` / `auditor` |

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

**Role** (`users.role`): `admin`, `department_head`, `auditor`

В БД пишутся **values**, не имена членов enum.

## Ключ проверки

`serial_number` — уникален, генерируется и пересчитывается на backend (`check_key.py`):

```text
{YY}{AUDITOR_CODE}{QUARTER}{P|V|K}{N}
```

Пример: `26KVS3P1` — год, код руководителя из `auditors.code`, квартал, тип (`planned`→P, `unscheduled`→V, `thematic`→K), порядковый номер среди проверок того же руководителя/типа/года (квартал в счётчик не входит).

Frontend не отправляет ключ в create/update payload. При смене даты начала, квартала, руководителя или типа проверки backend обновляет ключ и синхронизирует `recommendations.serial_number` / `attachments.check_serial_number`. Массовый пересчёт: `python -m app.db.recalculate_check_serial_numbers`.

## Пакет `app/db`

| Каталог / модуль | Назначение |
|------------------|------------|
| `session.py`, `init_db.py` | async engine, `create_all` |
| `catalogs/` | канонические списки (аудиторы+коды, департаменты, виды, типы, оценки, users) |
| `seeds/` | идемпотентный insert справочников и users |
| `migrations/` | ad-hoc SQL/data patches; `run_bootstrap_migrations()` — порядок Docker |
| `bootstrap.py` | Docker entrypoint и presentation demo |
| корневые `seed_*` / `migrate_*` | CLI (`python -m app.db.…`), реэкспорт |

## Seed и import

| Модуль | Назначение |
|--------|------------|
| `seed_auditors`, `seed_departments`, `seed_audit_types`, `seed_check_kinds`, `seed_effectiveness_ratings`, `seed_users` | справочники и логины |
| `sync_dictionaries` | выровнять auditors/departments/users с catalogs (в prod — merge-only) |
| `import_seed_data.py` | Excel → checks/recommendations |
| `seed_demo_data.py` | синтетика |
| `sync_check_buckets.py` | MinIO buckets |

Команды: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

## Migrate-скрипты

На живой БД после pull — нужные `python -m app.db.migrate_*`. Docker entrypoint гоняет **подмножество** (`BOOTSTRAP_MIGRATIONS`):

1. `migrate_auditor_codes`
2. `migrate_check_quarter`
3. `migrate_check_effectiveness`
4. `migrate_attachments`
5. `migrate_dictionary_uniqueness`
6. `migrate_dictionary_foreign_keys`
7. `migrate_recommendation_observation_name`
8. `migrate_recommendation_indicator_on_control`
9. `migrate_recommendation_additional_indicator`
10. `migrate_analytics_indexes`

Остальные (`migrate_check_short_name`, `migrate_recommendation_fields`, closure lists, audit_object array/canonical, statuses, materiality, …) нужны только для старых стендов, которые поднимались до появления этих полей в `create_all`.

## Ограничения

Нет soft-delete и audit log. `check_type` (`planned`/`unscheduled`/`thematic`) — код ключа проверки, не FK на `audit_types` (КП/ВП/ПП). Enum ALTER на prod — только с бэкапом. Аватары пользователей в БД не хранятся.

Вложения: [STORAGE.md](STORAGE.md).
