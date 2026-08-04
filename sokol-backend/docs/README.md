# SOKOL Backend — документация

Каталог описывает **актуальное** состояние backend (август 2026): архитектуру, API, модель данных, DOCX-пайплайны (включая Ollama), разработку, код-ревью и roadmap.

## Что читать

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои, классы, диаграммы потоков, границы системы |
| [API.md](API.md) | HTTP API `/api/v1`, контракты, upload tools |
| [DATA_AND_DB.md](DATA_AND_DB.md) | ORM-модели, enum’ы, связи, seed/migrate |
| [REPORTS.md](REPORTS.md) | Раздел II АЗ, гиперссылки, ДЗ, парсинг, аудиторское мнение |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Локальный запуск, env, Docker, тесты |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Замечания по коду и риски |
| [ROADMAP.md](ROADMAP.md) | Рекомендуемые следующие шаги |

## Кратко о сервисе

FastAPI-сервис внутреннего аудита «Сокол»:

- CRUD проверок и рекомендаций (PostgreSQL, async SQLAlchemy).
- CRUD справочников: аудиторы, типы аудита, оценки эффективности.
- Инструменты `.docx`: Раздел II АЗ (± гиперссылки на наблюдения), докладная записка, парсинг рекомендаций из АЗ, раздел I «Аудиторское мнение» через Ollama.
- **Нет** auth, Alembic, очередей, object storage; analytics API не нужен фронту (клиентские дашборды).

## Стек

| Компонент | Версия / технология |
|-----------|---------------------|
| Python | 3.12 |
| FastAPI / Uvicorn | 0.115 / 0.30 |
| SQLAlchemy + asyncpg | 2.0 / 0.31 |
| PostgreSQL | 16 (Docker, host port 5433) |
| DOCX | `python-docx` + низкоуровневый ZIP/XML (`zipfile`, ElementTree) |
| LLM | Ollama (`qwen3.5:35b` по умолчанию) |
| Тесты | `unittest` — **61** (1 skipped); фокус DOCX-пайплайн |

## Порты

| Режим | API |
|-------|-----|
| Локально (`run_dev.ps1`) | **8802** |
| Docker (корневой compose) | **8800** |

Фронтенд в dev: `VITE_DEV_API_PORT=8802` → прокси `/api` на тот же порт.
