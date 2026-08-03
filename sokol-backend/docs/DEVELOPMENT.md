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

Файлы: `.env`, `.secrets/sokol.env` (см. `Settings` + `os.getenv`).

| Переменная | Где читается | Назначение |
|------------|--------------|------------|
| `DATABASE_URL` | `Settings` | asyncpg URL (обязательно) |
| `SOKOL_CORS_ORIGINS` | `main.py` | origins через запятую |
| `SOKOL_MAX_UPLOAD_MB` | `instruments_reports` | лимит upload (default 100) |
| `SOKOL_OLLAMA_URL` | `Settings` | Ollama base URL |
| `SOKOL_OLLAMA_MODEL` | `Settings` | модель по умолчанию |
| `SOKOL_OLLAMA_TIMEOUT_S` | `Settings` | timeout LLM (default 600) |

`SOKOL_OLLAMA_*` — см. таблицу выше. Сервисы MinIO/MailHog из Compose **не используются** кодом приложения.

## Инициализация БД

После поднятия Postgres:

```bash
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
```

(точные entrypoints см. в `app/db/init_db.py`.)

Seed: модули `seed_*.py`, `import_seed_data.py`, `scripts/generate_seed_excel.py`.

При обновлении уже существующей БД после смены схемы — соответствующие `app/db/migrate_*.py`.

## Docker

Полный стек: корневой `docker-compose.yml` (API на **8800**, UI, Postgres, Ollama) — см. [DOCKER.md](../../DOCKER.md).

Каталог `docker/`: Compose (API, Postgres, опционально MinIO/MailHog).  
API Dockerfile: Python 3.12-slim, CMD uvicorn на **8800** внутри контейнера.

Для локальной разработки чаще удобнее venv + `run_dev.ps1` (**8802**) + Postgres из compose.

## Качество

```bash
python -m compileall app scripts tests
python -m unittest discover -s tests
```

На момент обновления docs: **61 tests** (1 skipped); фокус — section_ii / memorandum / bookmarks / links.

Нет pytest-конфига как основного раннера; CI в репозитории backend не описан как обязательный.

## Типичные проблемы

| Симптом | Причина | Действие |
|---------|---------|----------|
| `DATABASE_URL is required` | нет `.secrets/sokol.env` | скопировать example |
| CORS errors с UI | origins не совпадают с портом Vite | выставить `SOKOL_CORS_ORIGINS=http://localhost:5180` |
| UI ходит на 8800, API на 8802 | Docker vs local | сверить `run_dev.ps1` и `VITE_DEV_API_PORT` |
| 502 на audit-opinion | Ollama не запущена / нет модели | `ollama serve` + `ollama pull qwen3.5:35b` |
| 413 на upload | файл > лимита | увеличить `SOKOL_MAX_UPLOAD_MB` |
| Port already in use | старый uvicorn | `netstat` / taskkill на 8802 |

## Структура тестов

```
tests/
  test_section_ii_parser.py
  test_bookmark_utils.py
  test_observation_links.py
  test_memorandum.py
```

CRUD/API/DB integration tests пока отсутствуют.
