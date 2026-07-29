# SOKOL

Внутренний инструмент аудита: веб-интерфейс (React) + API (FastAPI).

## Порты

| Сервис | URL | Где настраивается |
|--------|-----|-------------------|
| **Frontend (UI)** | http://localhost:5180 | `sokol-frontend/.env.development` / Docker |
| **Backend (API)** | http://localhost:8800 | Docker / uvicorn `--port` |
| Swagger UI | http://localhost:8800/docs | — |
| Postgres | localhost:5433 | `sokol-backend/docker/app/.env` |
| Ollama | http://localhost:11434 | Docker |
| LanguageTool (опционально) | http://localhost:8010 | Docker profile `extras` |

---

## Коробочный запуск (Docker)

Подробно: [DOCKER.md](DOCKER.md)

```powershell
# из корня sokol/
docker compose up --build -d
docker exec -it ollama ollama pull qwen2.5:14b
```

UI: http://localhost:5180 · API: http://localhost:8800/docs

Если БД `postgres` уже запущена:

```powershell
docker compose up --build -d api ollama ui
```

---

## Быстрый старт (локальная разработка без Docker)

Нужны **два терминала**: сначала бэкенд, затем фронтенд.

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
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8800
```

Проверка: откройте http://localhost:8800/docs

### 2. Frontend

```bash
cd sokol-frontend
npm run dev
```

Откройте в браузере: **http://localhost:5180**

---

## Структура репозитория

```
sokol/
├── sokol-backend/    # FastAPI API
├── sokol-frontend/   # React + Vite
└── README.md         # этот файл
```

Подробнее:

- [sokol-backend/README.md](sokol-backend/README.md) — переменные окружения, Docker, БД
- [sokol-frontend/README.md](sokol-frontend/README.md) — скрипты, env, типичные ошибки

## Текущие возможности

- Вкладка `Проверки`: список, фильтры, сортировка, создание/редактирование и экспорт таблицы.
- Вкладка `Рекомендации`: список, фильтры, сортировка, создание/редактирование и экспорт таблицы. Колонка `Срок исполнения` содержит дату срока.
- Вкладка `Инструменты`: генерация Раздела II АЗ и ДЗ из `.docx` через backend API.
- Вкладки `Аналитика`, `Настройки`, `Профиль`, `Канцлер`.

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
netstat -ano | findstr :8800
taskkill /PID <номер> /F
```

Аналогично для порта **5180**, если занят UI.

**Ошибка 500 в «Инструменты»** — бэкенд не запущен или слушает не тот порт. Должен быть **8800**.

**CORS** — в `sokol-backend/.secrets/sokol.env`:

```
SOKOL_CORS_ORIGINS=http://localhost:5180
```

При смене порта UI обновите эту строку и перезапустите API.
