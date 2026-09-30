# Docker

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API / Swagger | http://localhost:8800/docs |
| Postgres | localhost:5433 |
| MinIO API / Console | http://localhost:9000 / http://localhost:9001 |

Образ MinIO — `quay.io/minio/minio` (Docker Hub `minio/minio` больше не отдаёт pull).

## Первый запуск

```bash
# из корня sokol/
cp .env.example .env                                          # Windows: copy .env.example .env
cp sokol-backend/docker/app/.env.example sokol-backend/docker/app/.env

docker compose up --build -d
```

UI: http://localhost:5180

Если Postgres/MinIO/API уже запущены и нужна только пересборка UI:

```bash
docker compose up --build -d ui
```

Сервис `ui` ждёт healthy `api` (`GET /api/v1/ready`). Скрейп метрик API: `http://localhost:8800/api/v1/metrics`.

## Env

- Корневой `.env` — опционально (дефолты в compose).
- `sokol-backend/docker/app/.env` — обязателен для API (`DATABASE_URL`, `SOKOL_JWT_SECRET`, MinIO).
- Compose по умолчанию грузит demo Excel: `SOKOL_LOAD_DEMO_DATA=1`. Для UAT/prod: `SOKOL_ENV=prod` и `SOKOL_LOAD_DEMO_DATA=0`.
- В prod смените пароли. Файлы `.env` не коммитятся.

## Данные на диске

| Том | Путь |
|-----|------|
| Postgres | `~/docker-share/postgres-data-sokol` |
| MinIO | `~/docker-share/minio-data-sokol` |

Вложения: [docs/STORAGE.md](docs/STORAGE.md). Excel seed: корневой `data/` (в контейнере — `SOKOL_DATA_DIR`).

## Auth

Bearer JWT на `/api/v1/*`, кроме публичных:

- `GET /api/v1/status`
- `GET /api/v1/ready`
- `GET /api/v1/metrics`
- `GET /api/v1/capabilities`
- `POST /api/v1/auth/login`

Вход: http://localhost:5180/login.

## Частые проблемы

| Симптом | Действие |
|---------|----------|
| UI не видит API | http://localhost:8800/docs, CORS `http://localhost:5180` |
| Порт занят | Освободить 5180 / 8800 / 5433 / 9000 / 9001 |
| Неожиданные demo-данные | `SOKOL_LOAD_DEMO_DATA=0` в env API |

Частичный стек: `sokol-backend/docker/app/docker-compose.yml`, `sokol-frontend/docker/docker-compose.yml`.
