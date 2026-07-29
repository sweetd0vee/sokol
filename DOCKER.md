# Docker: коробочный SOKOL

Один compose поднимает **Postgres + API + Ollama + Frontend** в сети `sokol`.

## Порты

| Сервис | URL |
|--------|-----|
| UI | http://localhost:5180 |
| API / Swagger | http://localhost:8800/docs |
| Postgres | localhost:5433 |
| Ollama | http://localhost:11434 |
| LanguageTool (profile `extras`) | http://localhost:8010 |

## Перед первым запуском

```powershell
# корневые переменные (опционально; есть дефолты в compose)
copy .env.example .env

# обязательный env для API-контейнера
copy sokol-backend\docker\app\.env.example sokol-backend\docker\app\.env
```

В проде замените `POSTGRES_PASSWORD` / `DATABASE_URL` и MinIO/mail на реальные секреты. Файлы `.env` в git не коммитятся.

## Запуск

Из корня репозитория (`sokol/`):

```powershell
# 1) Собрать и поднять стек (db уже может быть запущен — compose его подхватит)
docker compose up --build -d

# 2) Скачать модель для Ollama (один раз; ~9 GB для qwen2.5:14b)
docker exec -it ollama ollama pull qwen2.5:14b

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

## Опционально: LanguageTool

```powershell
docker compose --profile extras up -d languagetool
```

И в `.env` / `sokol-backend/docker/app/.env` укажите:

```
SOKOL_LT_URL=http://languagetool:8010
```

затем `docker compose up -d api`.

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
| Ollama timeout / нет модели | `docker exec ollama ollama list` и `ollama pull …` |
| Порт занят | Освободите 5180 / 8800 / 11434 |

Альтернативы (старые пути):

- Backend-only: `sokol-backend/docker/app/docker-compose.yml`
- Frontend-only (сеть `sokol` уже есть): `sokol-frontend/docker/docker-compose.yml`
