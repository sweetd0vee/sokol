# SOKOL Backend — документация

Каталог описывает **актуальное** состояние backend (**11 августа 2026**). **План развития:** [PLAN.md](../../PLAN.md).

## Что читать

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои, классы, диаграммы потоков, границы системы |
| [API.md](API.md) | HTTP API `/api/v1`, контракты, upload tools |
| [DATA_AND_DB.md](DATA_AND_DB.md) | ORM-модели, enum’ы, связи, seed/migrate |
| [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md) | Как делать миграции, seed/import, бэкапы и restore |
| [STORAGE.md](STORAGE.md) | MinIO, вложения, layout бакетов |
| [REPORTS.md](REPORTS.md) | Раздел II АЗ, гиперссылки, ДЗ, парсинг, аудиторское мнение |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Локальный запуск, env, Docker, тесты |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Замечания по коду и риски |
| [ROADMAP.md](ROADMAP.md) | Backend backlog (детали — в [PLAN.md](../../PLAN.md)) |

## Кратко о сервисе

FastAPI-сервис внутреннего аудита «Сокол»:

- **Auth:** internal JWT + RBAC (`auditor` / `admin`); публичны health и `POST /auth/login`.
- CRUD проверок и рекомендаций (PostgreSQL, async SQLAlchemy); validation справочников на create/update.
- CRUD справочников: аудиторы, типы аудита, виды проверок (`check_kinds`), оценки эффективности (mutate — admin).
- **Analytics:** `GET /api/v1/analytics/{checks|recommendations|monitoring|dva|planning}` — серверные агрегаты по всей БД.
- **Attachments:** метаданные в Postgres + файлы в MinIO (`/api/v1/attachments`).
- Инструменты `.docx`: Раздел II АЗ (± гиперссылки), докладная записка, парсинг рекомендаций, раздел I через Ollama.
- **Нет** Alembic (пока `create_all` + `migrate_*.py`), OIDC, очередей DOCX.

## Стек

| Компонент | Версия / технология |
|-----------|---------------------|
| Python | 3.12 |
| FastAPI / Uvicorn | 0.115 / 0.30 |
| SQLAlchemy + asyncpg | 2.0 / 0.31 |
| PostgreSQL | 16 (Docker, host port 5433) |
| Auth | PyJWT (HS256) + PBKDF2 пароли |
| Object storage | MinIO (S3-compatible) |
| DOCX | `python-docx` + низкоуровневый ZIP/XML |
| LLM | Ollama (`qwen3.5:35b` по умолчанию) |
| Тесты | `unittest` — **~84** (1 skipped); DOCX + auth + dictionary + analytics + attachments smoke |

## Порты

| Режим | API |
|-------|-----|
| Локально (`run_dev.ps1`) | **8802** |
| Docker (корневой compose) | **8800** |

Фронтенд в dev: `VITE_DEV_API_PORT=8802` → прокси `/api` на тот же порт.
