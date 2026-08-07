# Docker: коробочный SOKOL

Один compose поднимает **Postgres + API + Ollama + Frontend** в сети `sokol`.

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API / Swagger | http://localhost:8800/docs |
| Postgres | localhost:5433 |
| Ollama | http://localhost:11434 |

> В Docker API на **8800**. Локальный `run_dev.ps1` без Docker слушает **8802** — см. корневой [README.md](README.md).

## Перед первым запуском

```powershell
# корневые переменные (опционально; есть дефолты в compose)
copy .env.example .env

# обязательный env для API-контейнера
copy sokol-backend\docker\app\.env.example sokol-backend\docker\app\.env
```

В проде замените `POSTGRES_PASSWORD` / `DATABASE_URL` на реальные секреты. Файлы `.env` в git не коммитятся.

## Запуск

Из корня репозитория (`sokol/`):

```powershell
# 1) Собрать и поднять стек (db уже может быть запущен — compose его подхватит)
docker compose up --build -d

# 2) Скачать модель для Ollama (один раз; qwen3.5:35b)
docker exec -it ollama ollama pull qwen3.5:35b

# 3) Проверка
docker compose ps
```

Откройте UI: **http://localhost:5180**

Остановка:

```powershell
docker compose stop
# или полностью (БД тоже остановится):
docker compose down
```

## Что уже есть у вас

Если `postgres` уже работает в сети `sokol`, достаточно поднять остальное без пересоздания БД:

```powershell
docker compose up --build -d api ollama ui
```

## Данные на диске

| Том | Путь на хосте (Windows) |
|-----|-------------------------|
| Postgres | `%USERPROFILE%\docker-share\postgres-data-sokol` |
| Ollama models | `%USERPROFILE%\docker-share\ollama` |

## Частые проблемы

| Симптом | Что сделать |
|---------|-------------|
| `sber/sokol-be:master` not found | Запускайте с `--build` из корня |
| UI не видит API | Проверьте `http://localhost:8800/docs` и CORS `http://localhost:5180` |
| Ollama timeout / нет модели | `docker exec ollama ollama list` и `ollama pull qwen3.5:35b` |
| Порт занят | Освободите 5180 / 8800 / 11434 / 5433 |

Альтернативы (частичный стек):

- Backend-only: `sokol-backend/docker/app/docker-compose.yml`
- Frontend-only (сеть `sokol` уже есть): `sokol-frontend/docker/docker-compose.yml`

## Банковский контур / MinIO / миграции

Пошаговые **будущие** инструкции (пока без реализации в коде):

- развёртывание во внутренней сети банка, TLS, air-gap, backup;
- внедрение MinIO для вложений;
- Alembic и загрузка реальных проверок —

см. разделы playbook A–D в [PLAN.md](PLAN.md).
