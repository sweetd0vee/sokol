# Docker

Единый источник правды — корневой `docker-compose.yml` (фрагменты в `docker/compose.*.yml`).

## Порты

| Сервис | С хоста (compose по умолчанию) | Внутри Docker |
|--------|--------------------------------|---------------|
| UI | http://localhost:5180 | nginx `:80` (статика) |
| API / Swagger | http://localhost:8800 | `backend:8800` |
| Postgres | **не опубликован** | `db:5432` |
| MinIO API / Console | **не опубликованы** | `minio:9000` / `minio:9001` |

Postgres и MinIO слушают только docker-сеть `sokol`. С LAN/интернета к ним не подключиться: снаружи остаются UI и API (их держите за VPN / reverse proxy).

Локально нужен `psql` / MinIO Console с хоста — только loopback:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev-ports.yml up -d
# → 127.0.0.1:5433, 127.0.0.1:9000, 127.0.0.1:9001
```

Без публикации портов:

```bash
docker compose exec db psql -U postgres -d sokol_db
```

На UAT/prod файл `docker-compose.dev-ports.yml` не подключать.

Образ MinIO — `quay.io/minio/minio` (Docker Hub `minio/minio` больше не отдаёт pull). Образ бэкапа ставит Python-клиент `minio` из PyPI и не качает `mc` с dl.min.io.

## Первый запуск

```bash
# из корня sokol/
cp .env.example .env                                          # Windows: copy .env.example .env
cp sokol-backend/docker/app/.env.example sokol-backend/docker/app/.env

docker compose up --build -d
```

UI: http://localhost:5180 (prod-образ: Vite build + nginx; `VITE_API_URL` — build-arg).

Если Postgres/MinIO/API уже запущены и нужна только пересборка UI:

```bash
docker compose build --build-arg VITE_API_URL=http://localhost:8800 ui
docker compose up -d ui
```

Сервис `ui` ждёт healthy `api` (`GET /api/v1/ready`). Скрейп метрик API: `http://localhost:8800/api/v1/metrics`.

## Частичный стек

| Что нужно | Команда |
|-----------|---------|
| Полный стек | из корня: `docker compose up --build -d` |
| Без UI (db + minio + api + backup) | `docker compose -f sokol-backend/docker/app/docker-compose.yml up --build -d` |
| Только UI (сеть `sokol` уже есть) | `docker compose -f sokol-frontend/docker/docker-compose.yml up --build -d` |
| Произвольный набор | из корня: `docker compose up -d db minio api backup` |

## Структура

```
docker-compose.yml              # include фрагментов
docker-compose.dev-ports.yml    # loopback Postgres/MinIO
docker/
  compose.data.yml              # db + minio + сеть
  compose.app.yml               # api + backup
  compose.ui.yml                # frontend (nginx)
  backup/                       # nightly snapshots
sokol-backend/docker/app/       # Dockerfile API, entrypoint, .env, backend-only compose
sokol-frontend/docker/          # Dockerfile UI, nginx.conf, UI-only compose
```

## Env

- Корневой `.env` — опционально (дефолты в compose).
- `sokol-backend/docker/app/.env` — обязателен для API (`DATABASE_URL`, `SOKOL_JWT_SECRET`, MinIO).
- Compose по умолчанию **не** грузит demo Excel (`SOKOL_LOAD_DEMO_DATA=0`). Локально Excel: `SOKOL_LOAD_DEMO_DATA=1`. Для UAT/prod: `SOKOL_ENV=prod` (demo запрещён). Команды — [docs/DEMO.md](docs/DEMO.md).
- В prod смените пароли. Файлы `.env` не коммитятся.
- Смена URL API для браузера → пересборка UI с новым `VITE_API_URL`.

## Данные на диске

Корень томов задаётся `SOKOL_DOCKER_SHARE` (по умолчанию `~/docker-share`). На этой машине: `M:/PROJECTS/Arina/docker-share`.

| Том | Путь |
|-----|------|
| Postgres | `${SOKOL_DOCKER_SHARE}/postgres-data-sokol` |
| MinIO | `${SOKOL_DOCKER_SHARE}/minio-data-sokol` |
| Бэкапы | `${SOKOL_DOCKER_SHARE}/sokol-backups` |

Сервис `backup` раз в сутки в **00:05 Europe/Moscow (UTC+3)** пишет снимок Postgres (`pg_dump -Fc`) и зеркало MinIO. Держит 14 дней и минимум 3 снимка. Ручной прогон: `docker compose exec backup /opt/sokol-backup/backup.sh`. Restore — [DATA.md](docs/DATA.md). Том бэкапов лучше копировать ещё и вне этой машины.

Вложения: [docs/DATA.md](docs/DATA.md). Excel seed: корневой `data/` (в контейнере — `SOKOL_DATA_DIR`).

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
| UI не видит API | http://localhost:8800/docs, CORS `http://localhost:5180`; при смене URL — rebuild UI |
| Порт занят | Освободить 5180 / 8800 (и 5433/9000/9001, если подключён `dev-ports`) |
| Нет доступа к Postgres/MinIO с хоста | Норма без `dev-ports`; либо `docker compose exec db …`, либо подключить `docker-compose.dev-ports.yml` |
| Неожиданные demo-данные | не ставить `SOKOL_LOAD_DEMO_DATA=1`; в prod demo запрещён |
| `env_file` not found | скопировать `sokol-backend/docker/app/.env.example` → `.env` |
