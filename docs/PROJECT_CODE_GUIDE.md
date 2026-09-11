# Гайд по коду SOKOL

Карта для нового разработчика. Подробности — в [docs/](README.md).

## Что это

Внутренний инструмент аудита: проверки, рекомендации, вложения, справочники, аналитика, конструктор дашбордов, DOCX/XLSX-инструменты.

- `sokol-frontend` — React 19 + TypeScript + Vite
- `sokol-backend` — FastAPI + async SQLAlchemy + PostgreSQL + MinIO
- `sokol-instruments` — legacy Streamlit, для новой работы не нужен
- `docs/` — продуктовая документация (архитектура, API, аналитика, лимиты, CI)

## Сценарий сверху вниз

Пользователь открывает `/checks`:

1. UI на `http://localhost:5180`.
2. `AuthGuard` → `AppLayout` → `ChecksTab`.
3. `SokolDataProvider` грузит данные через `src/api/checks.ts`.
4. Axios добавляет `Authorization: Bearer`.
5. `GET /api/v1/checks` → endpoint → `checks_service` → `checks_crud` → PostgreSQL.
6. JSON → mapper → таблица.

Экран не ходит в БД. Цепочка: UI → `src/api` → endpoint → service → CRUD → Postgres/MinIO.

## Репозиторий

```text
sokol/
├── README.md · DOCKER.md · PLAN.md
├── docs/
├── data/                 # Excel seed (checks / recommendations)
├── sokol-backend/
├── sokol-frontend/
└── sokol-instruments/    # legacy Streamlit
```

## Backend

Старт: `sokol-backend/app/main.py` (CORS, prod guards, роутер `/api/v1`).

| Путь | Зачем |
|------|--------|
| `app/api/v1/endpoints/` | HTTP домена (checks, rec, analytics, attachments, auth, users, tools) |
| `app/api/v1/dictionary_registry.py` | factory `/settings/*` (нет отдельных endpoint-файлов справочников) |
| `app/api/deps.py` | JWT / Basic, `require_admin` |
| `app/core/` | config, роли, JWT, logging/metrics/request_id, `person_match`, prod guards |
| `app/services/` | домен, `dictionary_*`, analytics, reports, MinIO, status scheduler |
| `app/crud/` | SQL; словари — `DictionaryCrud` |
| `app/models/` · `app/schemas/` | ORM и Pydantic |
| `app/db/` | init, seed (`label_rows`), `migrations` CLI, import |

Типовой запрос: `endpoints` → `services` → `crud` → модель. CRUD — SQL (`flush`, без `commit`); валидация словарей, overlay статусов, хеш пароля, MinIO и `commit` — в service.

**Сущности:** `Check` (`serial_number` только backend), `Recommendation` (`check_id` + денормализованный serial), `Attachment` (MinIO + metadata), справочники (auditors с `code` из 3 букв, departments, check_kinds, ratings, audit_types), `User`. Открытые rec-статусы пересчитывает in-process scheduler (00:05 МСК).

**Роли:** `auditor` / `department_head` / `admin`. `require_admin` = admin **или** department_head. Auditor удаляет только свою рекомендацию (`person_match` по `auditor` ↔ username). Login матчит username и aliases.

Подробно: [DATA_AND_DB.md](DATA_AND_DB.md), [API.md](API.md), [ARCHITECTURE.md](ARCHITECTURE.md).

## Frontend

Старт: `src/main.tsx` → `App` → `AppProviders` + `AppRoutes`.

```text
QueryClient → AuthProvider → SokolDataProvider → AnalyticsConstructorProvider → BrowserRouter
```

Маршруты (все кроме `/login` за `AuthGuard`): `/checks`, `/recommendations`, `/analytics`, `/planning`, `/constructor`, `/tools`, `/settings`, `/profile`. Неизвестный путь → `/checks`. Kantsler нет.

Права в UI: `useAuth().isAdmin`, отдельного `AdminGuard` нет.

`src/api/client.ts` — axios, Bearer, 401 → logout. Доменные клиенты: `checks`, `recommendations`, `attachments`, `analytics`, `settings`, `tools`, `auth`, `users`, `capabilities`. Поля API ↔ UI: `mappers.ts`.

Состояние: Context + React Query, без Redux. Списки фильтруются на клиенте после bulk-fetch 10000. Конструктор — localStorage.

Токены форм: `src/constants/formLayout.ts`.

## Куда смотреть по домену

| Тема | Frontend | Backend |
|------|----------|---------|
| Проверки | `components/tabs/ChecksTab.tsx`, `checks/CheckFormPage.tsx` | `endpoints/checks.py`, `checks_service`, `checks_crud` |
| Рекомендации | `RecommendationsTab`, `RecommendationFormPage`, `CheckRecommendationsBlock` | `endpoints/recommendations.py`, `recommendations_service` |
| Вложения | `api/attachments.ts`, `attachments/*` | `attachments_service`, `minio_storage` |
| Аналитика | `tabs/AnalyticsTab.tsx`, `components/analytics/` | `endpoints/analytics.py`, `services/analytics/` |
| Планирование | `tabs/PlanningTab.tsx` | `GET /analytics/planning` |
| Конструктор | `tabs/ConstructorTab.tsx`, `analytics/constructor/` | нет API |
| Tools | `tabs/ToolsTab.tsx`, `api/tools.ts` | `instruments_reports.py`, `services/reports/` |
| Справочники | `tabs/SettingsTab.tsx`, `api/settings.ts` | `dictionary_registry.py` → `/settings/*` |

`serial_number` frontend не считает. Виды проверок в Settings, формах и фильтрах списков (проверки и рекомендации) — из `/settings/check_kinds` (`useCheckKindOptions`).

## Новая CRUD-фича

Модель → schema → CRUD → service → endpoint → router → TS types → `src/api` → UI → тесты. Если сущность уже есть — найти mapper, форму, список, экспорт, аналитику.

Новый справочник: модель + schema + `DictionaryCrud` + строка в `DICTIONARY_ROUTER_CONFIGS` + `makeSettingsCrud` на фронте. Отдельный endpoint-файл не нужен.

## Запуск

```bash
# backend
cd sokol-backend
python3.12 -m venv venv && source venv/bin/activate   # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .secrets/sokol.env.example .secrets/sokol.env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802

# frontend
cd sokol-frontend
npm install
npm run dev
```

UI: `http://localhost:5180`. Swagger: `http://localhost:8802/docs`.

Dev-логины (после seed, если `users` пуста): `Админ А.А.` / `admin` (alias `admin`), `Ковалев С.С.` / `admin` (department_head), аудиторы (ФИО) / `auditor`.

```bash
cd sokol-frontend && npm run lint && npm test && npm run build
cd sokol-backend && python -m compileall app tests && python -m unittest discover -s tests
```

Playwright (не в CI): `cd sokol-frontend && npm run test:e2e`.

## С чего начать

1. Корневой `README.md`
2. `AppProviders.tsx` + `AppRoutes.tsx`
3. `src/api/client.ts`
4. `SokolDataContext.tsx`
5. `app/main.py` → `app/api/v1/router.py` → `endpoints/checks.py` → service/crud/model

Права: frontend `AuthContext` / `isAdmin`; backend `deps.py`. Файлы: [STORAGE.md](STORAGE.md). Аналитика: [ANALYTICS.md](ANALYTICS.md). Архитектура: [ARCHITECTURE.md](ARCHITECTURE.md).
