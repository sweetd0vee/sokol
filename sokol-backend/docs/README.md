# SOKOL Backend — документация

Каталог описывает **актуальное** состояние backend (июль 2026): архитектуру, API, модель данных, DOCX-пайплайны, разработку, код-ревью и roadmap.

## Что читать

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои, классы, диаграммы потоков, границы системы |
| [API.md](API.md) | HTTP API `/api/v1`, контракты, upload tools |
| [DATA_AND_DB.md](DATA_AND_DB.md) | ORM-модели, enum’ы, связи, seed/migrate |
| [REPORTS.md](REPORTS.md) | Раздел II АЗ, гиперссылки, ДЗ, парсинг рекомендаций |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Локальный запуск, env, Docker, тесты |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Замечания по коду и риски |
| [ROADMAP.md](ROADMAP.md) | Рекомендуемые следующие шаги |

## Кратко о сервисе

FastAPI-сервис внутреннего аудита «Сокол»:

- CRUD проверок и рекомендаций (PostgreSQL, async SQLAlchemy).
- CRUD справочников: аудиторы, типы аудита, оценки эффективности.
- Инструменты `.docx`: Раздел II АЗ (± гиперссылки на наблюдения), докладная записка, парсинг рекомендаций из АЗ.
- **Нет** auth, Alembic, очередей, object storage, analytics API.

## Стек

| Компонент | Версия / технология |
|-----------|---------------------|
| Python | 3.12 |
| FastAPI / Uvicorn | 0.115 / 0.30 |
| SQLAlchemy + asyncpg | 2.0 / 0.31 |
| PostgreSQL | 16 (Docker, host port 5433) |
| DOCX | `python-docx` + низкоуровневый ZIP/XML (`zipfile`, ElementTree) |
| Тесты | `unittest` — **60 OK** (DOCX-пайплайн) |

## Dev-порт

`run_dev.ps1` поднимает API на **8802**. Фронтенд (`VITE_DEV_API_PORT=8802`) проксирует `/api` туда же. Корневой README репозитория может ещё указывать 8800 — ориентируйтесь на `run_dev.ps1` и `.env.development` фронта.
