# Docker

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API / Swagger | http://localhost:8800/docs |
| Postgres | localhost:5433 |
| MinIO API / Console | http://localhost:9000 / http://localhost:9001 |

## Первый запуск

```powershell
# из корня sokol/
copy .env.example .env
copy sokol-backend\docker\app\.env.example sokol-backend\docker\app\.env

docker compose up --build -d
```

UI: http://localhost:5180

Если Postgres уже запущен:

```powershell
docker compose up --build -d ui
```

## Env

- Корневой `.env` — опционально (дефолты в compose).
- `sokol-backend/docker/app/.env` — обязателен для API (`DATABASE_URL`, `SOKOL_JWT_SECRET`, MinIO).
- В prod смените пароли. Файлы `.env` не коммитятся.

## Данные на диске

| Том | Windows |
|-----|---------|
| Postgres | `%USERPROFILE%\docker-share\postgres-data-sokol` |
| MinIO | `%USERPROFILE%\docker-share\minio-data-sokol` |

Вложения: [sokol-backend/docs/STORAGE.md](sokol-backend/docs/STORAGE.md).

## Auth

Bearer JWT на всех `/api/v1/*`, кроме `GET /api/v1/status`. Вход: http://localhost:5180/login.

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| UI не видит API | http://localhost:8800/docs, CORS `http://localhost:5180` |
| Порт занят | Освободить 5180 / 8800 / 5433 |

Частичный стек: `sokol-backend/docker/app/docker-compose.yml`, `sokol-frontend/docker/docker-compose.yml`.
