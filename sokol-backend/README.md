# SOKOL Backend (FastAPI)

Backend service for internal use. Python 3.12.

## Порты (локальная разработка)

| Сервис        | URL |
|---------------|-----|
| API           | http://localhost:8800 |
| Swagger UI    | http://localhost:8800/docs |
| ReDoc         | http://localhost:8800/redoc |
| Postgres      | localhost:5433 |
| LanguageTool  | http://localhost:8010 |
| Frontend (UI) | http://localhost:5180 — см. `sokol-frontend/README.md` |

Порт API **8800** и UI **5180** заданы в `sokol-frontend/.env.development` (прокси Vite). При смене порта API обновите и `SOKOL_CORS_ORIGINS` в `.secrets/sokol.env`.

## Requirements

- Python 3.12
- Docker / Docker Compose (optional, for DB + LanguageTool)

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
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8800
```

### Linux / macOS

```bash
cd sokol-backend
python3.12 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .secrets/sokol.env.example .secrets/sokol.env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8800
```

### Пример `.secrets/sokol.env`

```bash
APP_NAME=SOKOL API
API_V1_PREFIX=/api/v1
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db

SOKOL_LT_URL=http://localhost:8010
SOKOL_LT_LANG=auto
SOKOL_MAX_UPLOAD_MB=100
SOKOL_CORS_ORIGINS=http://localhost:5180
```

## Docker (DB + API + LanguageTool)

Перед запуском убедитесь, что есть файл `sokol-backend/.secrets/sokol.env`.

Из каталога `sokol-backend/docker/app`:

```bash
docker compose up --build -d
```

Сервисы после старта:

- API: http://localhost:8800
- Postgres: localhost:5433
- LanguageTool: http://localhost:8010

## Environment variables

- `DATABASE_URL` — async SQLAlchemy URL (обязателен для старта).
- `SOKOL_CORS_ORIGINS` — разрешённые origin фронтенда (для dev: `http://localhost:5180`).
- `SOKOL_LT_URL` — LanguageTool URL (set to enable spellcheck).
- `SOKOL_LT_LANG` — LanguageTool language, default `auto`.
- `SOKOL_MAX_UPLOAD_MB` — max upload size for `.docx`, default `100`.

## Генерация Раздела II и ДЗ

Логика находится в `app/services/reports/` (модули `section_ii` и `memorandum`). API: `POST /api/v1/tools/section-ii`, `POST /api/v1/tools/memorandum`.

## Документация проекта

Подробная backend-документация находится в `docs/`:

- `docs/ARCHITECTURE.md` — архитектура и слои приложения.
- `docs/API.md` — HTTP API и контракты endpoints.
- `docs/DATA_AND_DB.md` — модели данных, БД, seed/import.
- `docs/REPORTS.md` — генерация Раздела II, ДЗ и парсинг `.docx`.
- `docs/DEVELOPMENT.md` — запуск, Docker, env, тесты и эксплуатация.
- `docs/CODE_REVIEW.md` — ревью текущего состояния и риски.
- `docs/ROADMAP.md` — план дальнейшего развития.

## Проверки качества

Компиляция Python-файлов:

```bash
python -m compileall app scripts tests
```

Unit-тесты:

```bash
python -m unittest discover -s tests
```

Тесты покрывают генерацию Раздела II, формирование ДЗ и XML/bookmark-утилиты для `.docx`.

## Частые проблемы

**Порт занят** (`WinError 10013` / `10048`):

```powershell
netstat -ano | findstr :8800
taskkill /PID <номер_процесса> /F
```

Затем снова запустите uvicorn на порту **8800**.
