# Backend — документация

## Документы

| Файл | Содержание |
|------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои, модули, потоки |
| [API.md](API.md) | HTTP `/api/v1`, контракты |
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модели, enum'ы, seed |
| [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md) | БД: init, migrate, import, бэкапы |
| [STORAGE.md](STORAGE.md) | MinIO, вложения |
| [REPORTS.md](REPORTS.md) | Раздел II, ДЗ, audit opinion |
| [PLAN.md](../../PLAN.md) | Roadmap и приоритеты |

## Кратко о сервисе

FastAPI + PostgreSQL (async SQLAlchemy):

- **Auth** — JWT + RBAC (`auditor` / `admin`); публичны health и login.
- **CRUD** — проверки, рекомендации, справочники; validation справочников на create/update.
- **Analytics** — `GET /api/v1/analytics/{checks|recommendations|monitoring|dva|planning}`.
- **Attachments** — Postgres + MinIO.
- **Tools** — генерация/разбор `.docx` (Раздел II, ДЗ, Ollama).

**Пока нет:** Alembic (схема через `create_all` + `migrate_*.py`), OIDC, CRUD наблюдений.

## Стек

Python 3.12 · FastAPI · SQLAlchemy 2 + asyncpg · PostgreSQL 16 · MinIO · python-docx · Ollama · unittest

## Порты

| Режим | API |
|-------|-----|
| `run_dev.ps1` | **8802** |
| Docker | **8800** |
