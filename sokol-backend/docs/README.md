# Backend — документация

| Файл | Содержание |
|------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои, модули, bootstrap |
| [API.md](API.md) | HTTP `/api/v1` |
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модель данных, enum'ы, FK, миграции |
| [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md) | Init, import, бэкапы |
| [STORAGE.md](STORAGE.md) | MinIO, вложения |
| [REPORTS.md](REPORTS.md) | Раздел II, ДЗ, файл контроля |

Запуск и env: [../README.md](../README.md). Roadmap: [PLAN.md](../../PLAN.md).

## Кратко

FastAPI + PostgreSQL (async SQLAlchemy) + MinIO:

- **Auth** — JWT + RBAC (`auditor` / `department_head` / `admin`). `department_head` проходит `require_admin`. Публичны `/`, `/status`, `/capabilities`, `POST /auth/login`. HTTP Basic — только development, если не задан `SOKOL_ENABLE_BASIC_AUTH`. Аватаров на backend нет.
- **CRUD** — проверки, рекомендации, справочники; FK на labels. У аудиторов обязателен трёхбуквенный `code`.
- **Analytics** — `GET /analytics/{checks|recommendations|monitoring|dva|planning}`. Конструктор дашбордов — только frontend.
- **Attachments** — Postgres metadata + MinIO.
- **Tools** — Раздел II, ДЗ, parse-recommendations, файл контроля (XLSX).

**Нет:** Alembic, OIDC, CRUD наблюдений, users PATCH/DELETE, хранение аватаров, серверные сохранённые отчёты.

Python 3.12 · FastAPI · SQLAlchemy 2 + asyncpg · PostgreSQL 16 · MinIO · python-docx · openpyxl · unittest

Локально API **8802**, Docker **8800**.
