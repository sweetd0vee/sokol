# SOKOL Backend (FastAPI)

Backend service for internal use. Python 3.12.

## Порты

| Режим | API | Swagger | Postgres |
|-------|-----|---------|----------|
| **Локальная разработка** (`run_dev.ps1`) | http://localhost:8802 | http://localhost:8802/docs | localhost:5433 |
| **Docker** (корневой compose) | http://localhost:8800 | http://localhost:8800/docs | localhost:5433 |

Frontend UI: http://localhost:5180 — прокси Vite в dev нацелен на **8802** (`sokol-frontend/.env.development`). При смене порта API обновите `VITE_DEV_API_PORT` и `SOKOL_CORS_ORIGINS`.

## Requirements

- Python 3.12
- Docker / Docker Compose (optional, for DB + full stack + Ollama)

## Локальный запуск

### Windows (PowerShell)

```powershell
cd sokol-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Скопируйте и настройте секреты:

```powershell
copy .secrets\sokol.env.example .secrets\sokol.env
```

Запуск API:

```powershell
.\run_dev.ps1
```

или вручную:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

### Linux / macOS

```bash
cd sokol-backend
python3.12 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .secrets/sokol.env.example .secrets/sokol.env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

### Пример `.secrets/sokol.env`

```bash
APP_NAME=SOKOL API
API_V1_PREFIX=/api/v1
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db

SOKOL_MAX_UPLOAD_MB=100
SOKOL_CORS_ORIGINS=http://localhost:5180

SOKOL_JWT_SECRET=sokol-dev-jwt-secret-change-me
SOKOL_JWT_EXPIRE_MINUTES=480

SOKOL_OLLAMA_URL=http://localhost:11434
SOKOL_OLLAMA_MODEL=qwen3.5:35b
SOKOL_OLLAMA_TIMEOUT_S=600
```

Локальные пользователи по умолчанию (если `SOKOL_AUTH_USERS` пуст):

| Логин | Пароль | Роль |
|-------|--------|------|
| `Админ А.А.` | `admin` | admin |
| `Аудитор А.А.` | `auditor` | auditor |

## Docker

Полный стек (рекомендуется): из корня репозитория — см. [DOCKER.md](../DOCKER.md).

Backend-only compose: каталог `sokol-backend/docker/app`:

```bash
docker compose up --build -d
```

- API: http://localhost:8800
- Postgres: localhost:5433

## Environment variables

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | async SQLAlchemy URL (обязателен) |
| `SOKOL_CORS_ORIGINS` | origins фронтенда через запятую (dev: `http://localhost:5180`) |
| `SOKOL_JWT_SECRET` | секрет подписи JWT (смените вне dev) |
| `SOKOL_JWT_EXPIRE_MINUTES` | TTL токена, default `480` |
| `SOKOL_AUTH_USERS` | JSON-список пользователей; пусто → локальные defaults |
| `SOKOL_MAX_UPLOAD_MB` | лимит upload `.docx`, default `100` |
| `SOKOL_OLLAMA_URL` | URL Ollama (default `http://localhost:11434`) |
| `SOKOL_OLLAMA_MODEL` | модель по умолчанию (`qwen3.5:35b`) |
| `SOKOL_OLLAMA_TIMEOUT_S` | timeout LLM-запроса, default `600` |
| `SOKOL_MINIO_*` | MinIO endpoint/keys — см. `docs/STORAGE.md` |

## Генерация документов

Логика в `app/services/reports/`:

| Пайплайн | Endpoint |
|----------|----------|
| Раздел II АЗ | `POST /api/v1/tools/section-ii` (+ `-links`) |
| Докладная записка | `POST /api/v1/tools/memorandum` |
| Парсинг рекомендаций | `POST /api/v1/tools/parse-recommendations` |
| Раздел I / аудиторское мнение (Ollama) | `POST /api/v1/tools/audit-opinion` |

## Документация проекта

Подробная backend-документация в `docs/`:

- `docs/ARCHITECTURE.md` — архитектура и слои
- `docs/API.md` — HTTP API и контракты
- `docs/DATA_AND_DB.md` — модели, БД, seed/import
- `docs/ALEMBIC_AND_DATA.md` — Alembic (target), загрузка данных, бэкапы
- `docs/STORAGE.md` — MinIO и вложения
- `docs/REPORTS.md` — Раздел II, ДЗ, audit opinion
- `docs/DEVELOPMENT.md` — запуск, Docker, env, тесты
- `docs/CODE_REVIEW.md` — ревью и риски
- [PLAN.md](../PLAN.md) — единый план развития (все компоненты)
- `docs/ROADMAP.md` — backend backlog

## Проверки качества

```bash
python -m compileall app scripts tests
python -m unittest discover -s tests
```

Тесты покрывают генерацию Раздела II, ДЗ, XML/bookmark-утилиты, period helpers analytics и HTTP smoke analytics/attachments (**72** test, 1 skipped).  
Зависимость `httpx` нужна для `fastapi.testclient.TestClient`.

## Частые проблемы

**Порт занят** (`WinError 10013` / `10048`):

```powershell
netstat -ano | findstr :8802
taskkill /PID <номер_процесса> /F
```

Затем снова `.\run_dev.ps1` (порт **8802**).
