# Docker: коробочный SOKOL

Один compose поднимает **Postgres + API + Frontend** в сети `sokol`.  
**Ollama в Docker нет** — API ходит на локальную Ollama на хосте (`http://host.docker.internal:11434`).

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API / Swagger | http://localhost:8800/docs |
| Postgres | localhost:5433 |
| Ollama (локально на хосте) | http://localhost:11434 |

> В Docker API на **8800**. Локальный `run_dev.ps1` без Docker слушает **8802** — см. корневой [README.md](README.md).

## Перед первым запуском

1. Установите и запустите [Ollama](https://ollama.com/) на хосте, затем скачайте модель:

```powershell
ollama serve
ollama pull qwen3.5:35b
```

2. Подготовьте env:

```powershell
# корневые переменные (опционально; есть дефолты в compose)
copy .env.example .env

# обязательный env для API-контейнера
copy sokol-backend\docker\app\.env.example sokol-backend\docker\app\.env
```

В проде замените `POSTGRES_PASSWORD` / `DATABASE_URL` на реальные секреты. Файлы `.env` в git не коммитятся.

`SOKOL_OLLAMA_URL` для API в Docker: `http://host.docker.internal:11434` (уже в example).  
Для backend без Docker: `http://localhost:11434`.

## Запуск

Из корня репозитория (`sokol/`):

```powershell
# Собрать и поднять стек (db уже может быть запущен — compose его подхватит)
docker compose up --build -d

# Проверка
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
docker compose up --build -d api ui
```

## Данные на диске

| Том | Путь на хосте (Windows) |
|-----|-------------------------|
| Postgres | `%USERPROFILE%\docker-share\postgres-data-sokol` |
| Ollama models | локальный каталог Ollama на хосте (не Docker volume) |

## Частые проблемы

| Симптом | Что сделать |
|---------|-------------|
| `sber/sokol-be:master` not found | Запускайте с `--build` из корня |
| UI не видит API | Проверьте `http://localhost:8800/docs` и CORS `http://localhost:5180` |
| Ollama timeout / нет модели | На хосте: `ollama list` и `ollama pull qwen3.5:35b`; URL в env — `host.docker.internal:11434` |
| API не достучится до Ollama | Убедитесь, что `ollama serve` слушает `0.0.0.0:11434` / доступен с Docker Desktop |
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
