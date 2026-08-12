# SOKOL

Внутренний инструмент аудита: React UI + FastAPI API + PostgreSQL.

## Порты

| Режим | UI | API / Swagger | Postgres |
|-------|-----|---------------|----------|
| Локальная разработка | http://localhost:5180 | http://localhost:8802/docs | localhost:5433 |
| Docker | http://localhost:5180 | http://localhost:8800/docs | localhost:5433 |

Локально API слушает **8802** (`sokol-backend/run_dev.ps1`), фронт проксирует `/api` туда же. В Docker API на **8800**.

## Быстрый старт

**Docker** — см. [DOCKER.md](DOCKER.md).

**Локально** — два терминала:

```powershell
# 1. Backend
cd sokol-backend
.\venv\Scripts\Activate.ps1   # после venv + pip install -r requirements.txt
copy .secrets\sokol.env.example .secrets\sokol.env
.\run_dev.ps1
```

```bash
# 2. Frontend
cd sokol-frontend
npm install
npm run dev
```

Откройте http://localhost:5180. Подробности: [sokol-backend/README.md](sokol-backend/README.md), [sokol-frontend/README.md](sokol-frontend/README.md).

## Структура репозитория

```
sokol/
├── docker-compose.yml
├── DOCKER.md
├── PLAN.md                 # план развития
├── sokol-backend/          # FastAPI
├── sokol-frontend/         # React + Vite
└── sokol-instruments/      # legacy Streamlit (не основной стек)
```

## Документация

| Раздел | Содержание |
|--------|------------|
| [docs/README.md](docs/README.md) | Код-ревью и план действий |
| [sokol-backend/README.md](sokol-backend/README.md) | Запуск, env, тесты |
| [sokol-backend/docs/](sokol-backend/docs/README.md) | Архитектура, API, БД, reports |
| [sokol-frontend/README.md](sokol-frontend/README.md) | Скрипты, маршруты, env |
| [sokol-frontend/docs/](sokol-frontend/docs/README.md) | Архитектура, аналитика, UI |
| [PLAN.md](PLAN.md) | Roadmap и go-live |

## Возможности

- **Auth** — JWT (`POST /api/v1/auth/login`), роли `auditor` / `admin`. Dev: `admin`/`admin`, `auditor`/`auditor`.
- **Проверки и рекомендации** — CRUD, фильтры, экспорт таблиц, вложения (MinIO), импорт рекомендаций из АЗ.
- **Аналитика** — `GET /api/v1/analytics/{checks|recommendations|monitoring|dva|planning}`.
- **Инструменты** — Раздел II АЗ, докладная записка, парсинг рекомендаций. Audit opinion (Ollama) — **в плане, не реализовано**.
- **Настройки** — справочники (mutate — только `admin`).
- **Канцлер** — заглушка «в разработке».

## Проверки качества

```bash
cd sokol-frontend && npm run lint && npm test && npm run build
cd sokol-backend && py -3.12 -m unittest discover -s tests
```

## Частые проблемы

- **500 / proxy в «Инструменты»** — бэкенд не на **8802** или не запущен.
- **CORS** — `SOKOL_CORS_ORIGINS=http://localhost:5180` в `sokol-backend/.secrets/sokol.env`.
- **Порт занят** — `netstat -ano | findstr :8802` → `taskkill /PID <pid> /F` (аналогично для 5180, 8800).
