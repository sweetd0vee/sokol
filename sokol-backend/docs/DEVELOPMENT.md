# Разработка backend

## Требования

- Python 3.12+
- PostgreSQL (локально или Docker)
- Опционально: Ollama (для `/tools/audit-opinion`)
- Windows: PowerShell + venv; Linux/macOS: bash

## Быстрый старт (Windows)

```powershell
cd sokol-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .secrets\sokol.env.example .secrets\sokol.env
# отредактируйте DATABASE_URL и SOKOL_CORS_ORIGINS
.\run_dev.ps1
```

API: **http://127.0.0.1:8802**  
Swagger: **http://127.0.0.1:8802/docs**

`run_dev.ps1` запускает:

```text
uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

Фронтенд в `.env.development` использует `VITE_DEV_API_PORT=8802`. В CORS укажите UI:

```env
SOKOL_CORS_ORIGINS=http://localhost:5180
```

## Env

Файлы: `.env`, `.secrets/sokol.env` (все через `Settings` в `app.core.config`).

| Переменная | Где читается | Назначение |
|------------|--------------|------------|
| `DATABASE_URL` | `Settings` | asyncpg URL (обязательно) |
| `SOKOL_CORS_ORIGINS` | `Settings.cors_origins` | origins через запятую; пусто → `*` |
| `SOKOL_JWT_SECRET` | `Settings` | секрет подписи JWT |
| `SOKOL_JWT_EXPIRE_MINUTES` | `Settings` | TTL токена (default 480) |
| `SOKOL_AUTH_USERS` | `Settings` | JSON-пользователи; пусто → локальные defaults |
| `SOKOL_MAX_UPLOAD_MB` | `Settings` | лимит upload (default 100) |
| `SOKOL_OLLAMA_URL` | `Settings` | Ollama base URL |
| `SOKOL_OLLAMA_MODEL` | `Settings` | модель по умолчанию |
| `SOKOL_OLLAMA_TIMEOUT_S` | `Settings` | timeout LLM (default 600) |
| `SOKOL_MINIO_*` | `Settings` | endpoint, keys, secure — см. [STORAGE.md](STORAGE.md) |
| `SOKOL_LOAD_DEMO_DATA` | Docker entrypoint | импорт Excel после seed |
| `SOKOL_SEED_REPLACE` | Docker entrypoint | TRUNCATE перед импортом |

Подробности MinIO: [STORAGE.md](STORAGE.md). Миграции / seed / бэкапы: [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md).

## Инициализация БД

После поднятия Postgres:

```bash
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
```

При обновлении уже существующей БД после смены схемы — соответствующие `app/db/migrate_*.py` (см. список в [DATA_AND_DB.md](DATA_AND_DB.md)).

Seed:

```bash
python -m app.db.seed_auditors
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
python -m app.db.import_seed_data          # без --replace
# python -m app.db.import_seed_data --replace   # ОПАСНО: нужен бэкап
python -m app.db.sync_check_buckets        # если MinIO включён
```

## Docker

Полный стек: корневой `docker-compose.yml` (API на **8800**, UI, Postgres, MinIO; Ollama — локально на хосте) — см. [DOCKER.md](../../DOCKER.md).

Каталог `docker/app`: Compose API + Postgres (+ MinIO).  
API Dockerfile: Python 3.12-slim, CMD uvicorn на **8800** внутри контейнера; entrypoint ждёт БД, делает init/migrate/seed.

Для локальной разработки чаще удобнее venv + `run_dev.ps1` (**8802**) + Postgres из compose.

## Качество

```bash
python -m compileall app scripts tests
python -m unittest discover -s tests
```

На момент обновления docs: **~84 tests** (1 skipped); фокус — section_ii / memorandum / bookmarks / links + auth/RBAC + dictionary validation + analytics period helpers + API smoke (analytics/attachments с моками).  
Для TestClient добавлен `httpx` в `requirements.txt`.

Нет обязательного CI pipeline в репозитории.

## Типичные проблемы

| Симптом | Причина | Действие |
|---------|---------|----------|
| `DATABASE_URL is required` | нет `.secrets/sokol.env` | скопировать example |
| CORS errors с UI | origins не совпадают с портом Vite | выставить `SOKOL_CORS_ORIGINS=http://localhost:5180` |
| UI ходит на 8800, API на 8802 | Docker vs local | сверить `run_dev.ps1` и `VITE_DEV_API_PORT` |
| 401 на CRUD | нет / просрочен JWT | login через UI или `POST /auth/login` |
| 502 на audit-opinion | Ollama не запущена / нет модели | `ollama serve` + `ollama pull qwen3.5:35b` |
| 413 на upload | файл > лимита | увеличить `SOKOL_MAX_UPLOAD_MB` |
| Port already in use | старый uvicorn | `netstat` / taskkill на 8802 |

## Структура тестов

```
tests/
  test_auth_rbac.py
  test_dictionary_validation.py
  test_api_analytics.py
  test_api_attachments.py
  test_checks_analytics_period.py
  test_section_ii_parser.py
  test_bookmark_utils.py
  test_observation_links.py
  test_memorandum.py
  auth_test_utils.py
```

Запуск: `python -m unittest discover -s tests` (Python **3.12**).

API smoke-тесты мокают DB/MinIO через `TestClient` + `dependency_overrides` (без живой Postgres).
