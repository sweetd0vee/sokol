# SOKOL

Внутренний инструмент аудита: React UI + FastAPI API + PostgreSQL + MinIO.

## Порты

| Режим | UI | API / Swagger | Postgres | MinIO |
|-------|-----|---------------|----------|-------|
| Локальная разработка | http://localhost:5180 | http://localhost:8802/docs | localhost:5433 | 9000 / 9001 |
| Docker | http://localhost:5180 | http://localhost:8800/docs | localhost:5433 | 9000 / 9001 |

Локально API слушает **8802**, фронт проксирует `/api` туда же. В Docker API на **8800**.

## Быстрый старт

**Docker** — см. [DOCKER.md](DOCKER.md).

**Локально** — два терминала:

```bash
# 1. Backend
cd sokol-backend
python3.12 -m venv venv
source venv/bin/activate   # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .secrets/sokol.env.example .secrets/sokol.env   # Windows: copy ...
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

```bash
# 2. Frontend
cd sokol-frontend
npm install
npm run dev
```

Откройте http://localhost:5180. Подробности: [sokol-backend/README.md](sokol-backend/README.md), [sokol-frontend/README.md](sokol-frontend/README.md).

Dev-логины (после seed, если `users` пуста): `Админ А.А.` / `admin` (или alias `admin`), `Ковалев С.С.` / `admin` (`department_head`), аудиторы (ФИО) / `auditor`.

## Структура репозитория

```
sokol/
├── docker-compose.yml
├── DOCKER.md
├── PLAN.md                 # исторический go-live план (04.09.2026)
├── docs/                   # продуктовая документация
├── data/                   # Excel seed (checks.xlsx, recommendations.xlsx)
├── .github/workflows/      # CI
├── sokol-backend/          # FastAPI
├── sokol-frontend/         # React + Vite
└── sokol-instruments/      # legacy Streamlit (не основной стек)
```

## Документация

| Раздел | Содержание |
|--------|------------|
| [docs/README.md](docs/README.md) | Индекс: живые доки и исторические снимки |
| [docs/PROJECT_CODE_GUIDE.md](docs/PROJECT_CODE_GUIDE.md) | Карта кода для нового разработчика |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Backend + frontend: слои, auth, инварианты |
| [docs/API.md](docs/API.md) | HTTP `/api/v1` |
| [docs/DATA_AND_DB.md](docs/DATA_AND_DB.md) | Модель, seed, import, миграции |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | Дашборды, планирование, конструктор |
| [docs/APP_LIMITS_AND_GOTCHAS.md](docs/APP_LIMITS_AND_GOTCHAS.md) | Лимиты, тонкости и типовые проблемы |
| [docs/CI.md](docs/CI.md) | CI workflow и GitHub merge gate |
| [sokol-backend/README.md](sokol-backend/README.md) | Запуск, env, тесты |
| [sokol-frontend/README.md](sokol-frontend/README.md) | Скрипты, маршруты, env |
| [PLAN.md](PLAN.md) | Исторический roadmap / go-live (не «текущий статус») |

## Возможности

- **Auth** — JWT (`POST /api/v1/auth/login`), роли `auditor` / `department_head` / `admin`. `department_head` входит в admin-права (`require_admin` / UI `isAdmin`).
- **Проверки и рекомендации** — CRUD, фильтры, экспорт таблиц, вложения (MinIO), импорт рекомендаций из АЗ.
- **Аналитика** — `GET /api/v1/analytics/{checks|recommendations|monitoring|dva|planning}`.
- **Планирование / конструктор** — `/planning` (visual export) и `/constructor` (снимки в localStorage).
- **Инструменты** — Раздел II АЗ, докладная записка, парсинг рекомендаций, файл контроля.
- **Настройки** — справочники (mutate — admin / department_head).

Маршрута «Канцлер» нет; неизвестный URL → `/checks`.

## Проверки качества

CI: `.github/workflows/ci.yml`; required checks для branch protection описаны в [docs/CI.md](docs/CI.md).

```bash
cd sokol-frontend && npm run lint && npm test && npm run build
cd sokol-backend && python -m unittest discover -s tests   # Python 3.12+
```

## Частые проблемы

- **500 / proxy в «Инструменты»** — бэкенд не на **8802** или не запущен.
- **CORS** — `SOKOL_CORS_ORIGINS=http://localhost:5180` в `sokol-backend/.secrets/sokol.env`.
- **Порт занят** — macOS/Linux: `lsof -i :8802`; Windows: `netstat -ano | findstr :8802`.
