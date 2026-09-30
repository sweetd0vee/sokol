# SOKOL Backend (FastAPI)

Python 3.12, async SQLAlchemy, PostgreSQL.

## Порты

| Режим | API / Swagger | Postgres |
|-------|---------------|----------|
| Локально | http://localhost:8802/docs | localhost:5433 |
| Docker | http://localhost:8800/docs | localhost:5433 |

Фронт в dev: `VITE_DEV_API_PORT=8802`. При смене порта обновите `SOKOL_CORS_ORIGINS`.

## Локальный запуск

```bash
cd sokol-backend
python3.12 -m venv venv
source venv/bin/activate          # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .secrets/sokol.env.example .secrets/sokol.env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

Settings читает `.env` и `.secrets/sokol.env`.

### Минимальный `.secrets/sokol.env`

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/sokol_db
SOKOL_CORS_ORIGINS=http://localhost:5180
SOKOL_JWT_SECRET=sokol-dev-jwt-secret-change-me
```

Dev-пользователи (если таблица `users` пуста и срабатывает seed): `Админ А.А.` / `admin` (alias `admin`), `Ковалев С.С.` / `admin` (`department_head`), аудиторы (ФИО) / `auditor`.

## Docker

Полный стек — [DOCKER.md](../DOCKER.md). Backend-only: `docker/app/docker-compose.yml` (тот же сервис `backup`). Compose может поднимать Mailhog с profile `extras` — API его не использует.

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | async SQLAlchemy URL (обязателен) |
| `SOKOL_CORS_ORIGINS` | origins фронта через запятую |
| `SOKOL_ENV` | `development` (default) или `prod` / `production` — в prod weak/default JWT secret, demo load и seed replace блокируют старт |
| `SOKOL_DATA_DIR` | каталог Excel seed / data (Docker: `/app/data`; иначе корневой `sokol/data`) |
| `SOKOL_JWT_SECRET` / `SOKOL_JWT_EXPIRE_MINUTES` | JWT (default TTL 480 мин) |
| `SOKOL_ADMIN_PASSWORD` / `SOKOL_DEFAULT_USER_PASSWORD` | пароли seed: admin/department_head (`admin`) и аудиторы (`auditor`) |
| `SOKOL_ENABLE_BASIC_AUTH` | HTTP Basic: в development включён по умолчанию, в prod выключен; явный `true`/`false` перекрывает default |
| `SOKOL_MAX_UPLOAD_MB` | лимит upload вложений и DOCX-tools (default 100) |
| `SOKOL_DOCX_MAX_CONCURRENT` | сколько DOCX-jobs крутятся одновременно (default 2) |
| `SOKOL_DOCX_MAX_QUEUE` | сколько запросов ждут слот (default 8); сверх лимита — 503 |
| `SOKOL_DOCX_QUEUE_WAIT_SECONDS` | сколько секунд ждать слот (default 180) |
| `SOKOL_LOAD_DEMO_DATA` / `SOKOL_SEED_REPLACE` | Docker bootstrap: demo Excel и TRUNCATE; в entrypoint demo default on; в prod запрещены |
| `SOKOL_STATUS_SCHEDULER` | Ежедневный пересчёт статусов рекомендаций и проверок (default on; `0` выключает) |
| `SOKOL_LOG_LEVEL` | Уровень логов `app.*` (default `INFO`) |
| `SOKOL_LOG_JSON` | JSON-логи; по умолчанию on в prod, off в development |
| `SOKOL_DESTRUCTIVE_DICTIONARY_SYNC` | в development удаляет лишние справочники/users при sync (default on); в prod всегда merge-only |
| `SOKOL_MINIO_ENDPOINT` / `ACCESS_KEY` / `SECRET_KEY` / `SECURE` / `REGION` | MinIO — [DATA.md](../docs/DATA.md) |

## Инициализация БД

```bash
python -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db())"
python -m app.db.seed_auditors
python -m app.db.seed_departments
python -m app.db.seed_audit_types
python -m app.db.seed_check_kinds
python -m app.db.seed_effectiveness_ratings
python -m app.db.seed_users
```

Seed/import/бэкапы: [DATA.md](../docs/DATA.md). Excel seed лежит в корневом `data/`, не в `sokol-backend/data/`.

## Health / metrics

| Endpoint | Назначение |
|----------|------------|
| `GET /api/v1/status` | liveness + счётчики HTTP и очередь DOCX |
| `GET /api/v1/ready` | Postgres `SELECT 1` (Docker HEALTHCHECK) |
| `GET /api/v1/metrics` | Prometheus text, без auth |

## Инструменты

| Endpoint | Назначение |
|----------|------------|
| `POST /api/v1/tools/section-ii` | Раздел II АЗ |
| `POST /api/v1/tools/section-ii-links` | Раздел II с гиперссылками |
| `GET /api/v1/tools/control-file-template` | Шаблон файла контроля (XLSX) |
| `POST /api/v1/tools/control-file` | Файл контроля из АЗ |
| `POST /api/v1/tools/memorandum` | Докладная записка |
| `POST /api/v1/tools/parse-recommendations` | Парсинг рекомендаций из АЗ |

Подробно: [REPORTS.md](../docs/REPORTS.md).

## Документация

Каталог [docs/README.md](../docs/README.md): архитектура, API, данные, reports. Исторический план — [PLAN.md](../PLAN.md).

## Тесты

```bash
python -m compileall app tests
python -m unittest discover -s tests   # Python 3.12+
```

Нужен `httpx` для `TestClient`.

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| `DATABASE_URL is required` | скопировать `.secrets/sokol.env.example` |
| CORS | `SOKOL_CORS_ORIGINS=http://localhost:5180` |
| 502 на tools | проверить backend и логи DOCX-пайплайна |
| 503 на tools | очередь DOCX переполнена — повторить позже |
| Порт занят | `lsof -i :8802` / `netstat -ano \| findstr :8802` |
