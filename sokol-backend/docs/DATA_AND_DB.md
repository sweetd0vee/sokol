# Данные и БД

## Стек

- PostgreSQL 16 (Docker: host **5433** → container 5432).
- SQLAlchemy 2.0 async + `asyncpg`.
- Миграции: **Alembic ещё не внедрён**. Схема создаётся через `Base.metadata.create_all` в `app/db/init_db.py`.
- Эволюция полей — ad-hoc скрипты `app/db/migrate_*.py`.
- Практический runbook (Alembic target, seed, бэкапы): **[ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)**.
- Object storage вложений: MinIO — **[STORAGE.md](STORAGE.md)**.

## Session

`app/db/session.py`: `create_async_engine(settings.database_url)`, `async_sessionmaker`, dependency `get_db_session()`.

`DATABASE_URL` обязателен (см. `.secrets/sokol.env`).

## ER-диаграмма

```mermaid
erDiagram
  checks ||--o{ recommendations : "cascade delete"
  checks ||--o{ attachments : "by serial / entity"

  checks {
    int id PK
    string serial_number UK
    string check_name
    string short_name
    string check_type
    string check_view
    date start_date
    date end_date
    string check_leader
    check_status status
    date created_at
    text description
    string process_effectiveness
    string svk_effectiveness
    string sur_effectiveness
    string svik_effectiveness
    string order_document_number
    date order_document_date
    string program_document_number
    date program_document_date
    string az_document_number
    date az_document_date
    string dz_document_number
    date dz_document_date
  }

  recommendations {
    int id PK
    int check_id FK
    string serial_number
    int sequence_number
    text name
    text description
    string indicator
    string materiality_level
    string audit_object
    date deadline
    string auditor
    string manager
    recommendation_status status
    recommendation_additional_status additional_status
    date created_at
    date actual_completion_date
    json deadline_extensions
    json control_removals
    string closure_verification_status
    text closure_information
  }

  attachments {
    int id PK
    string entity_type
    int entity_id
    string slot
    string check_serial_number
    string bucket
    string object_key
    string original_name
    string content_type
    int size_bytes
    date created_at
  }

  auditors {
    uuid id PK
    string full_name
  }

  audit_types {
    uuid id PK
    string code
    string name
  }

  check_kinds {
    uuid id PK
    string label
  }

  effectiveness_ratings {
    uuid id PK
    string label
  }
```

Справочники **не связаны** FK с checks/recommendations: ФИО аудитора, тип проверки и т.п. хранятся как строки в основных таблицах; справочники питают UI-select’ы.

`attachments` ссылается на сущность логически (`entity_type` + `entity_id`) и на ключ проверки (`check_serial_number` → bucket `check-{serial}`).

## Enum’ы

### `CheckStatus`

| Value | Смысл |
|-------|--------|
| `not_started` | не начата |
| `in_progress` | в работе |
| `completed` | завершена |

### `RecommendationStatus`

| Value | Смысл |
|-------|--------|
| `completed` | исполнена |
| `unresolved` | не устранена |
| `on_control` | на контроле |
| `in_progress` | в работе |

### `RecommendationAdditionalStatus`

| Value | Смысл |
|-------|--------|
| `on_time` | в срок |
| `deadline_violated` | нарушение срока |
| `on_control` | на контроле |

SQLAlchemy для recommendation enum’ов использует `values_callable` → в БД пишутся **values**, не имена членов.

## Ключ проверки (`serial_number`)

Генерируется на фронте (`utils/checkKey.ts`) и дублируется логикой `app/utils/check_key.py` для seed/import. Уникален в `checks`. У рекомендаций `serial_number` — ссылка на ключ проверки (строка), плюс `check_id` FK и `sequence_number` внутри проверки.

## Seed и import

| Модуль | Назначение |
|--------|------------|
| `seed_auditors.py` | аудиторы |
| `seed_audit_types.py` | типы аудита |
| `seed_check_kinds.py` | виды проверок |
| `seed_effectiveness_ratings.py` | оценки эффективности |
| `seed_demo_data.py` | синтетические проверки и рекомендации |
| `import_seed_data.py` | загрузка из Excel (`--replace` = TRUNCATE) |
| `sync_check_buckets.py` | создать MinIO-бакеты для существующих проверок |
| `scripts/generate_seed_excel.py` | генерация seed Excel |
| `scripts/generate_import_templates.py` | пустые шаблоны импорта |

Подробные команды и правила безопасности: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

## Ad-hoc migrate скрипты

Под `app/db/`:

- `migrate_recommendation_fields.py`
- `migrate_recommendation_statuses.py`
- `migrate_recommendation_closure.py`
- `migrate_recommendation_closure_lists.py`
- `migrate_recommendation_indicators.py`
- `migrate_materiality_required.py`
- `migrate_check_effectiveness.py`
- `migrate_check_short_name.py`
- `migrate_attachments.py`

Это **не** версионируемый migration framework: запускаются вручную (или из Docker entrypoint) при обновлении уже существующей БД. Целевой путь — Alembic (см. [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)).

## Ограничения схемы

1. Нет soft-delete.
2. Нет аудита изменений (кто/когда изменил).
3. Бинарные вложения хранятся в MinIO; в Postgres — метаданные `attachments` + номера/даты документов на `checks`.
4. Материальность и индикатор — строки с дефолтами (`средний`, `не указан`), не FK на справочник.
5. Смена enum’ов на живой БД требует осторожного ALTER TYPE (через migrate-скрипт сейчас / Alembic потом).
6. Analytics API читает **все** проверки/рекомендации без list-лимита — при росте данных нужен мониторинг нагрузки.
