# SOKOL Backend — документация

Каталог описывает **актуальное** состояние backend (август 2026). **План развития:** [PLAN.md](../../PLAN.md).

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

- CRUD проверок и рекомендаций (PostgreSQL, async SQLAlchemy).
- CRUD справочников: аудиторы, типы аудита, виды проверок (`check_kinds`), оценки эффективности.
- **Analytics:** `GET /api/v1/analytics/checks` — серверная агрегация вкладки «Проверки».
- **Attachments:** метаданные в Postgres + файлы в MinIO (`/api/v1/attachments`).
- Инструменты `.docx`: Раздел II АЗ (± гиперссылки на наблюдения), докладная записка, парсинг рекомендаций из АЗ, раздел I «Аудиторское мнение» через Ollama.
- **Нет** auth, Alembic (пока `create_all` + `migrate_*.py`), очередей.

## Стек

| Компонент | Версия / технология |
|-----------|---------------------|
| Python | 3.12 |
| FastAPI / Uvicorn | 0.115 / 0.30 |
| SQLAlchemy + asyncpg | 2.0 / 0.31 |
| PostgreSQL | 16 (Docker, host port 5433) |
| Object storage | MinIO (S3-compatible) |
| DOCX | `python-docx` + низкоуровневый ZIP/XML |
| LLM | Ollama (`qwen3.5:35b` по умолчанию) |
| Тесты | `unittest` — **61** (1 skipped); фокус DOCX. Файл `test_checks_analytics_period.py` — pytest-style, в unittest discover не входит |

## Порты

| Режим | API |
|-------|-----|
| Локально (`run_dev.ps1`) | **8802** |
| Docker (корневой compose) | **8800** |

Фронтенд в dev: `VITE_DEV_API_PORT=8802` → прокси `/api` на тот же порт.
