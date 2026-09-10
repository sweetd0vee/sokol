# Документация SOKOL

Вся продуктовая документация лежит в этом каталоге. README в `sokol-backend/` и `sokol-frontend/` — только запуск, env и скрипты.

## Живые документы

### Общее

| Документ | Содержание |
|----------|------------|
| [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md) | Карта кода для нового разработчика |
| [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md) | Лимиты, тонкости, типовые ошибки |
| [MINIO.md](MINIO.md) | Бакеты, консоль, `mc`, бэкап |
| [CI.md](CI.md) | GitHub Actions и merge gate |
| [../README.md](../README.md) · [../DOCKER.md](../DOCKER.md) | Быстрый старт |

### Backend

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md) | Слои, модули, bootstrap |
| [API.md](API.md) | HTTP `/api/v1` |
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модель данных, enum'ы, FK, миграции |
| [ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md) | Init, import, бэкапы |
| [STORAGE.md](STORAGE.md) | MinIO, вложения |
| [REPORTS.md](REPORTS.md) | Раздел II, ДЗ, файл контроля |

Запуск и env: [../sokol-backend/README.md](../sokol-backend/README.md).

### Frontend

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE_FRONTEND.md](ARCHITECTURE_FRONTEND.md) | Структура, state, API-слой |
| [ANALYTICS.md](ANALYTICS.md) | Дашборды `/analytics` |
| [SOKOL_Аналитика.docx](SOKOL_Аналитика.docx) | Бизнес-описание дашбордов со скриншотами |
| [ANALYTICS_TZ.docx](ANALYTICS_TZ.docx) | Сгенерированное ТЗ (`npm run docs:analytics-tz:full`) |
| [analytics-screenshots/](analytics-screenshots/) | Скриншоты для ТЗ |
| [CONSTRUCTOR.md](CONSTRUCTOR.md) | Конструктор дашбордов `/constructor` |
| [PLANNING.md](PLANNING.md) | Раздел `/planning` |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Каркас, формы, списки, цвета, UI kit |

Скрипты и маршруты: [../sokol-frontend/README.md](../sokol-frontend/README.md). Скриншоты и DOCX аналитики пишутся сюда же: из `sokol-frontend` — `npm run docs:analytics-tz:full`.

## Backend — кратко

FastAPI + PostgreSQL (async SQLAlchemy) + MinIO:

- **Auth** — JWT + RBAC (`auditor` / `department_head` / `admin`). `department_head` проходит `require_admin`. Публичны `/`, `/status`, `/capabilities`, `POST /auth/login`. HTTP Basic: **on** в non-prod по умолчанию, **off** в prod; явный `SOKOL_ENABLE_BASIC_AUTH` перекрывает. Аватаров на backend нет.
- **CRUD** — проверки, рекомендации, справочники; FK на labels. У аудиторов обязателен трёхбуквенный `code`; смена `code` каскадно переписывает ключи проверок и MinIO buckets.
- **Analytics** — `GET /analytics/{checks|recommendations|monitoring|dva|planning}`. Конструктор дашбордов — только frontend.
- **Attachments** — Postgres metadata + MinIO.
- **Tools** — Раздел II, ДЗ, parse-recommendations, файл контроля (XLSX); in-process очередь DOCX (`docx_queue`), не Celery.

**Нет:** Alembic, OIDC, CRUD наблюдений, users PATCH/DELETE, хранение аватаров, серверные сохранённые отчёты, distributed job queue.

Python 3.12 · FastAPI · SQLAlchemy 2 + asyncpg · PostgreSQL 16 · MinIO · python-docx · openpyxl · unittest

Локально API **8802**, Docker **8800**.

## Frontend — кратко

SPA на React 19 + Vite 7:

- **Auth** — JWT, роли `admin` / `department_head` / `auditor`. В UI `isAdmin` = admin или руководитель департамента (settings mutate, DELETE проверок, пользователи).
- **Данные** — TanStack Query + `SokolDataProvider` (checks/recommendations, до 10000 строк).
- **Analytics / planning** — `GET /api/v1/analytics/*`; visual export (html/pdf/docx/xlsx) на вкладках аналитики и на `/planning`.
- **Constructor** — снимки карточек в `localStorage`, без backend API.
- **Tools** — upload `.docx` → backend (Раздел II, гиперссылки, файл контроля, ДЗ).
- **Профиль** — аватар в localStorage, смена пароля через API; admin создаёт пользователей (`POST /users`).

Посещённые вкладки аналитики остаются смонтированными (`KeepAlivePanel`). Токены форм: `src/constants/formLayout.ts`.

Стек: React Router 7 · TanStack Query 5 · Axios · Tailwind · Recharts · react-grid-layout · xlsx / exceljs / docx / pdfmake / html-to-image (экспорт) · Vitest · Playwright.

| Режим | UI | API |
|-------|-----|-----|
| Dev | 5180 | 8802 |
| Docker | 5180 | 8800 |

| Роль | Возможности в UI |
|------|------------------|
| `auditor` | CRUD домена, analytics, tools, вложения; DELETE рекомендации — только своей (`auditor` ↔ ФИО) |
| `department_head` | как admin в UI (`isAdmin`) |
| `admin` | + справочники, DELETE проверок, удаление вложений проверки, `GET/POST /users` |

Фильтр «Мои» сравнивает руководителя / аудитора / менеджера с ФИО из JWT (`shortName`) через `personMatch` (фамилия + инициалы), не с server identity.

Основные потоки:

1. **Проверка** — форма → `POST /checks`; `serial_number` только с backend; вложения (удаление — admin); импорт рекомендаций из АЗ (`POST /tools/parse-recommendations` + `POST /recommendations/batch`).
2. **Рекомендация** — форма с индикаторами, closure, продлениями, снятием с контроля, вложениями.
3. **Инструменты** — вкладки АЗ / ДЗ: section-ii, section-ii-links, control-file, memorandum.
4. **Экспорт** — таблицы: XLSX/DOCX/PDF на клиенте; дашборды analytics / planning / constructor: visual export (html/pdf/docx/xlsx).

Алгоритм Раздела II — [REPORTS.md](REPORTS.md).

## План и ревью (исторические снимки)

Документы ниже — снимок качества и go-live-плана на **04.09.2026**, не текущий статус продукта. Источник календаря того спринта — [PLAN.md](../PLAN.md). Открытые инженерные пункты из того снимка по-прежнему полезны как backlog: Alembic / migrate-runbook, demo default в compose, метка limited на planning, import dry-run, required CI checks, restore drill.

| Документ | Содержание |
|----------|------------|
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | Остаток до продакшена (снимок 04.09) |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Сводка по блокам (снимок 04.09) |
| [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md) | Backend |
| [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md) | Frontend |
| [ACTION_PLAN.md](ACTION_PLAN.md) | Что ещё открыто из ревью |
| [../PLAN.md](../PLAN.md) | Go-live план 01–15.09.2026 |
