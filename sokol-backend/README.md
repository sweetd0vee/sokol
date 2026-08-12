# SOKOL Backend (FastAPI)

Python 3.12, async SQLAlchemy, PostgreSQL.

## Порты

| Режим | API / Swagger | Postgres |
|-------|---------------|----------|
| Локально (`run_dev.ps1`) | http://localhost:8802/docs | localhost:5433 |
| Docker | http://localhost:8800/docs | localhost:5433 |

Фронт в dev: `VITE_DEV_API_PORT=8802`. При смене порта обновите `SOKOL_CORS_ORIGINS`.

## Локальный запуск

```powershell
cd sokol-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .secrets\sokol.env.example .secrets\sokol.env
.\run_dev.ps1
```

Linux/macOS: `python3.12 -m venv venv`, `source venv/bin/activate`, затем uvicorn:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

### Минимальный `.secrets/sokol.env`

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db
SOKOL_CORS_ORIGINS=http://localhost:5180
SOKOL_JWT_SECRET=sokol-dev-jwt-secret-change-me
SOKOL_OLLAMA_URL=http://localhost:11434
SOKOL_OLLAMA_MODEL=qwen3.5:35b
```

Dev-пользователи (если `SOKOL_AUTH_USERS` пуст): `Админ А.А.`/`admin`, `Аудитор А.А.`/`auditor`.

## Docker

Полный стек — [DOCKER.md](../DOCKER.md). Backend-only: `docker/app/docker-compose.yml`.

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | async SQLAlchemy URL (обязателен) |
| `SOKOL_CORS_ORIGINS` | origins фронта через запятую |
| `SOKOL_JWT_SECRET` / `SOKOL_JWT_EXPIRE_MINUTES` | JWT (default TTL 480 мин) |
| `SOKOL_AUTH_USERS` | JSON-пользователи; пусто → dev defaults |
| `SOKOL_MAX_UPLOAD_MB` | лимит upload `.docx` (default 100) |
| `SOKOL_OLLAMA_*` | URL, модель, timeout LLM |
| `SOKOL_MINIO_*` | MinIO — [docs/STORAGE.md](docs/STORAGE.md) |

## Инициализация БД

```powershell
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
python -m app.db.seed_auditors
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
```

Seed/import/бэкапы: [docs/ALEMBIC_AND_DATA.md](docs/ALEMBIC_AND_DATA.md).

## Инструменты (DOCX)

| Endpoint | Назначение |
|----------|------------|
| `POST /api/v1/tools/section-ii` | Раздел II АЗ |
| `POST /api/v1/tools/section-ii-links` | Раздел II с гиперссылками |
| `POST /api/v1/tools/memorandum` | Докладная записка |
| `POST /api/v1/tools/parse-recommendations` | Парсинг рекомендаций из АЗ |

> **Audit opinion (Ollama)** — описан в [API.md](docs/API.md) как planned, endpoint **не реализован**.

Подробно: [docs/REPORTS.md](docs/REPORTS.md).

## Документация

Каталог [docs/README.md](docs/README.md): архитектура, API, БД, хранилище, reports. План — [PLAN.md](../PLAN.md).

## Тесты

```bash
python -m compileall app tests
py -3.12 -m unittest discover -s tests   # требуется Python 3.12
```

Нужен `httpx` для `TestClient`.

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| `DATABASE_URL is required` | скопировать `.secrets/sokol.env.example` |
| CORS | `SOKOL_CORS_ORIGINS=http://localhost:5180` |
| 502 на tools | проверить backend и логи DOCX-пайплайна |
| Порт занят | `netstat -ano \| findstr :8802` → `taskkill /PID <pid> /F` |
