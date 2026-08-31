# Backend — документация

## Документы

| Файл | Содержание |
|------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои, модули, потоки |
| [API.md](API.md) | HTTP `/api/v1`, контракты |
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модели, enum'ы, seed |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Подробная схема БД, таблицы, типы, связи, диаграммы |
| [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md) | БД: init, migrate, import, бэкапы |
| [STORAGE.md](STORAGE.md) | MinIO, вложения |
| [REPORTS.md](REPORTS.md) | Раздел II, ДЗ |
| [CODE_REVIEW](../../docs/CODE_REVIEW_BACKEND.md) | Код-ревью |
| [PLAN.md](../../PLAN.md) | Roadmap и приоритеты |

## Кратко о сервисе

FastAPI + PostgreSQL (async SQLAlchemy):

- **Auth** — JWT + RBAC (`auditor` / `department_head` / `admin`); публичны health, capabilities и login. HTTP Basic — только dev, если не задан `SOKOL_ENABLE_BASIC_AUTH`.
- **CRUD** — проверки, рекомендации, справочники; validation справочников на create/update; FK на labels.
- **Analytics** — `GET /api/v1/analytics/{checks|recommendations|monitoring|dva|planning}`.
- **Attachments** — Postgres + MinIO.
- **Tools** — Раздел II, ДЗ, parse-recommendations.

**Пока нет:** Alembic (схема через `create_all` + `migrate_*.py`), OIDC, CRUD наблюдений.

## Стек

Python 3.12 · FastAPI · SQLAlchemy 2 + asyncpg · PostgreSQL 16 · MinIO · python-docx · unittest

## Порты

| Режим | API |
|-------|-----|
| Локально | **8802** |
| Docker | **8800** |
