# Документация SOKOL

Вся продуктовая документация лежит в этом каталоге. README в `sokol-backend/` и `sokol-frontend/` — только запуск, env и скрипты.

## Живые документы

| Документ | Содержание |
|----------|------------|
| [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md) | Карта кода для нового разработчика |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои backend/frontend, auth, инварианты, bootstrap |
| [API.md](API.md) | HTTP `/api/v1` |
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модель, enum'ы, FK, seed, import, миграции, бэкапы |
| [STORAGE.md](STORAGE.md) | MinIO: layout, API, консоль, `mc`, бэкап |
| [ANALYTICS.md](ANALYTICS.md) | Дашборды `/analytics`, `/planning`, конструктор `/constructor` |
| [REPORTS.md](REPORTS.md) | Раздел II, ДЗ, файл контроля, parse |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Каркас, формы, списки, цвета, UI kit |
| [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md) | Лимиты, тонкости, типовые ошибки |
| [CI.md](CI.md) | GitHub Actions и merge gate |
| [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md) | Код-ревью API (оценки блоков, ошибки, камни) — 10.09.2026 |
| [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md) | Код-ревью UI (оценки блоков, ошибки, камни) — 10.09.2026 |
| [../README.md](../README.md) · [../DOCKER.md](../DOCKER.md) | Быстрый старт |

Скриншоты и DOCX аналитики: [SOKOL_Аналитика.docx](SOKOL_Аналитика.docx), [ANALYTICS_TZ.docx](ANALYTICS_TZ.docx), [analytics-screenshots/](analytics-screenshots/). Генерация: из `sokol-frontend` — `npm run docs:analytics-tz:full`.

Запуск backend: [../sokol-backend/README.md](../sokol-backend/README.md). Скрипты и маршруты UI: [../sokol-frontend/README.md](../sokol-frontend/README.md).

## Backend — кратко

FastAPI + PostgreSQL (async SQLAlchemy) + MinIO:

- **Auth** — JWT + RBAC (`auditor` / `department_head` / `admin`). `department_head` проходит `require_admin`. Публичны `/`, `/status`, `/capabilities`, `POST /auth/login`. HTTP Basic: **on** в non-prod, **off** в prod; явный `SOKOL_ENABLE_BASIC_AUTH` перекрывает. Аватаров на backend нет.
- **CRUD** — проверки, рекомендации; FK на labels. У аудиторов обязателен трёхбуквенный `code`; смена `code` каскадно переписывает ключи проверок и MinIO buckets.
- **Settings** — `/settings/{auditors,departments,audit_types,check_kinds,effectiveness_ratings}` из одного factory (`dictionary_registry.py`).
- **Analytics** — `GET /analytics/{checks|recommendations|monitoring|dva|planning}`, SQL-агрегаты. Конструктор дашбордов — только frontend.
- **Attachments** — Postgres metadata + MinIO.
- **Tools** — Раздел II, ДЗ, parse-recommendations, файл контроля (XLSX); in-process очередь DOCX (`docx_queue`), не Celery.
- **Статусы rec** — от `deadline` / зоны контроля; ежедневно 00:05 МСК (`SOKOL_STATUS_SCHEDULER`).

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
- **Списки** — виды проверок из `/settings/check_kinds` (проверки и рекомендации).

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
4. **Экспорт** — таблицы: XLSX/DOCX/PDF на клиенте (`utils/tableExport/`); дашборды analytics / planning / constructor: visual export.

Алгоритм Раздела II — [REPORTS.md](REPORTS.md).

## План и ревью

Актуальное код-ревью (**10.09.2026**): backend **5.4 / 10** — [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md); frontend **6.3 / 10** — [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md).

Исторический снимок качества и backlog на **04.09.2026**: [HISTORY.md](HISTORY.md). Календарь того спринта — [PLAN.md](../PLAN.md).
