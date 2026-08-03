# SOKOL

Внутренний инструмент аудита: веб-интерфейс (React) + API (FastAPI) + PostgreSQL. Опционально — Ollama для генерации раздела I («Аудиторское мнение»).

## Порты

| Режим | UI | API / Swagger | Postgres | Ollama |
|-------|----|---------------|----------|--------|
| **Docker** (коробочный) | http://localhost:5180 | http://localhost:8800/docs | localhost:5433 | http://localhost:11434 |
| **Локальная разработка** | http://localhost:5180 | http://localhost:8802/docs | localhost:5433 | http://localhost:11434 |

Локально API слушает **8802** (`sokol-backend/run_dev.ps1`), фронт проксирует `/api` туда же (`VITE_DEV_API_PORT=8802` в `sokol-frontend/.env.development`). В Docker API опубликован на **8800**.

---

## Коробочный запуск (Docker)

Подробно: [DOCKER.md](DOCKER.md)

```powershell
# из корня sokol/
copy .env.example .env
copy sokol-backend\docker\app\.env.example sokol-backend\docker\app\.env
docker compose up --build -d
docker exec -it ollama ollama pull qwen3.5:35b
```

UI: http://localhost:5180 · API: http://localhost:8800/docs

Если БД `postgres` уже запущена:

```powershell
docker compose up --build -d api ollama ui
```

---

## Быстрый старт (локальная разработка без Docker)

Нужны Postgres (часто из Docker) и **два терминала**: сначала бэкенд, затем фронтенд.

### 1. Backend

**Windows (PowerShell):**

```powershell
cd sokol-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .secrets\sokol.env.example .secrets\sokol.env
.\run_dev.ps1
```

**Linux / macOS:**

```bash
cd sokol-backend
python3.12 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .secrets/sokol.env.example .secrets/sokol.env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

Проверка: http://localhost:8802/docs

### 2. Frontend

```bash
cd sokol-frontend
npm install
npm run dev
```

Откройте: **http://localhost:5180**

---

## Структура репозитория

```
sokol/
├── docker-compose.yml      # коробочный стек (db + api + ollama + ui)
├── DOCKER.md
├── README.md
├── sokol-backend/          # FastAPI API
│   ├── docs/               # архитектура, API, БД, reports, roadmap
│   └── …
└── sokol-frontend/         # React + Vite
    ├── docs/               # архитектура, user stories, runbook, UI
    └── …
```

Подробнее:

- [DOCKER.md](DOCKER.md) — compose, тома, Ollama, troubleshooting
- [sokol-backend/README.md](sokol-backend/README.md) — env, Docker, тесты
- [sokol-frontend/README.md](sokol-frontend/README.md) — скрипты, env, маршруты
- [sokol-backend/docs/](sokol-backend/docs/README.md) · [sokol-frontend/docs/](sokol-frontend/docs/README.md)

## Текущие возможности

- Вкладка **Проверки**: список, фильтры, сортировка, создание/редактирование, экспорт таблицы, импорт рекомендаций из АЗ.
- Вкладка **Рекомендации**: список, фильтры, сортировка, создание/редактирование, экспорт; колонка «Срок исполнения».
- Вкладка **Инструменты**: генерация Раздела II АЗ (± гиперссылки), докладная записка (ДЗ), генерация раздела I («Аудиторское мнение») через Ollama.
- Вкладки **Аналитика** (UI есть; backend endpoint пока отсутствует), **Настройки**, **Профиль**, **Канцлер** (заглушка).

## Проверки качества

Frontend:

```bash
cd sokol-frontend
npm run lint
npm run build
```

Backend:

```bash
cd sokol-backend
python -m compileall app scripts tests
python -m unittest discover -s tests
```

---

## Частые проблемы

**Порт занят** (Windows):

```powershell
netstat -ano | findstr :8802
taskkill /PID <номер> /F
```

Аналогично для **5180** (UI) или **8800** (Docker API).

**Ошибка 500 / proxy в «Инструменты»** — бэкенд не запущен или порт не совпадает с `VITE_DEV_API_PORT` (локально должен быть **8802**).

**CORS** — в `sokol-backend/.secrets/sokol.env`:

```
SOKOL_CORS_ORIGINS=http://localhost:5180
```

При смене порта UI обновите эту строку и перезапустите API.
