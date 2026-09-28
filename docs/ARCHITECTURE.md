# Архитектура

React SPA + FastAPI + PostgreSQL 16 + MinIO. DOCX/XLSX и MinIO-I/O — в `asyncio.to_thread`. Тяжёлые DOCX-jobs — in-process очередь слотов (`services/reports/docx_queue.py`), не Celery.

Цепочка: UI → `src/api` → endpoint → service → CRUD → Postgres/MinIO. Commit, MinIO и доменная валидация — в service; CRUD — только SQL (`flush`), без `commit`, без импорта `app.services` / MinIO / Pydantic-схем.

## Backend

```
app/
├── main.py                 # FastAPI, CORS, request-id, prod guards, lifespan-scheduler
├── api/deps.py             # JWT / Basic, require_admin
├── api/middleware.py       # X-Request-ID, access log, in-process counters
├── api/exception_handlers.py  # DomainError / 422 / 500 → {detail}, лог с типом
├── api/uploads.py          # лимит upload / temp files
├── api/v1/
│   ├── router.py
│   ├── dictionary_router.py / dictionary_registry.py  # factory /settings/*
│   ├── analytics_deps.py   # query-фильтры дашбордов
│   └── endpoints/          # checks, recommendations, analytics, attachments, auth, users, tools, health
├── core/                   # config, JWT, roles, logging, metrics, request_id, person_match, recommendation_access, startup_validation
├── crud/                   # SQL; словари — DictionaryCrud
├── db/                     # session, init_db, catalogs, seeds, migrations, bootstrap
├── models/ · schemas/
├── services/
│   ├── checks / recommendations / attachments / users / auth
│   ├── dictionary_service.py + dictionary_validation.py + dictionary_integrity.py
│   ├── check_serial_cascade.py
│   ├── recommendation_status.py + recommendation_status_refresh.py
│   ├── analytics/          # SQL-агрегаты
│   ├── reports/            # section_ii, memorandum, control_file, az_import, docx_queue
│   └── storage/            # MinIO
└── utils/                  # check_key, paths, dictionary_text
```

Prefix `/api/v1`. Auth на всех роутерах, кроме `/`, `/status`, `/ready`, `/capabilities`, `POST /auth/login`. HTTP Basic: on в non-prod, off в prod, пока не `SOKOL_ENABLE_BASIC_AUTH=true`. Роль читается из БД на каждый запрос, не из JWT.

| Prefix | Домен |
|--------|-------|
| `/status`, `/ready`, `/capabilities` | liveness + счётчики, DB readiness, лимиты upload и очереди DOCX (публичные) |
| `/auth` | login, `/me`, смена пароля |
| `/users` | список и создание `auditor` (admin) |
| `/checks`, `/recommendations` | домен |
| `/analytics` | агрегаты, включая planning |
| `/attachments` | MinIO + metadata |
| `/settings/*` | справочники (один factory, пять prefix) |
| `/tools` | DOCX / XLSX |

Справочники не имеют отдельных endpoint-файлов: `DICTIONARY_ROUTER_CONFIGS` → `make_dictionary_router` → общий `DictionaryService`. HTTP-пути прежние.

`DomainError` → HTTP `{detail}`. Пустой `SOKOL_CORS_ORIGINS` → `*` без credentials.

## Frontend

```
src/
  api/           # axios + domain clients + mappers + queryKeys
  components/    # analytics, attachments, auth, checks, forms, lists, layout,
                 # planning, profile, recommendations, settings, tabs, tools, ui
  contexts/      # AuthContext, SokolDataProvider
  constants/     # статусы, formLayout.ts, paths, storage, avatars
  hooks/         # auth, lists, forms, analytics filters, attachments, export, storage status
  utils/         # dates, personMatch, tableExport/, analytics*, dvaAnalytics
  config/env.ts  # API_BASE_URL
```

```
QueryClient → AuthProvider → SokolDataProvider → AnalyticsConstructorProvider → BrowserRouter
  /login          — публичный
  /*              — AuthGuard → AppLayout
```

Отдельного `AdminGuard` нет: `useAuth().isAdmin`. Неизвестный путь → `/checks`. Kantsler нет.

| Route | Компонент |
|-------|-----------|
| `/checks`, `/recommendations` | списки + form pages (`/new`, `/:id/edit`) |
| `/analytics` | 4 вкладки, keep-alive посещённых |
| `/planning` | `PlanningAnalyticsDashboard` |
| `/constructor`, `/constructor/:id` | история и холст (только localStorage) |
| `/tools` | АЗ / ДЗ |
| `/settings` | mutate — `isAdmin` |
| `/profile` | аватар (localStorage), смена пароля; admin — создание users |

State: Context + React Query, без Redux. Списки — bulk-fetch 10000, фильтр/сорт/пагинация (по 50) на клиенте. Конструктор — `sokol.constructor.library.v1`. Токены форм: `src/constants/formLayout.ts`.

`src/api/client.ts` — Bearer, 401 → logout. Клиенты: checks, recommendations, attachments, analytics, settings (`makeSettingsCrud`), tools (timeout 600s), auth, users, capabilities. API ↔ UI: `mappers.ts`.

Виды проверок в Settings, формах и фильтрах списков (включая рекомендации) — `/settings/check_kinds` (`useCheckKindOptions`).

## Auth и RBAC

Роли: `auditor` / `department_head` / `admin`. `ADMIN_ROLES` = admin + department_head. `require_admin` и UI `isAdmin` — оба.

Login матчит `username` и `aliases`. Неактивные не проходят. «Своя» рекомендация: `recommendations.auditor` ↔ `username` через `person_match` (фамилия + инициалы, «Иванов А.А.» ≡ «Иванов Александр Александрович»). То же на фронте (`personMatch.ts`). Фильтр «Мои» сравнивает с `shortName` из JWT, не с server identity.

Пароли: PBKDF2-SHA256, на login ещё legacy plaintext verify. Аватары только в localStorage. OIDC нет.

## Доменные инварианты

- `serial_number` только backend: `{YY}{AUDITOR_CODE}{QUARTER}{P\|V\|K}{N}`. N — среди проверок того же руководителя/типа/года (квартал в счётчик не входит). Код аудитора — ровно 3 латинские буквы.
- Смена `start_date` / `check_quarter` / `check_leader` / `check_type` или `auditors.code` → `check_serial_cascade`: rec serial, attachment serial/bucket, copy+delete MinIO.
- Справочники: физический FK на unique label (`ON UPDATE CASCADE`). API create/update валидирует labels (**400**); import Excel **досоздаёт** (`ensure_*`).
- `audit_object` — массив + junction `recommendation_audit_objects`. Пустое → «Не указан». Аналитика фильтрует по массиву (`overlap`), не по junction.
- Статусы открытых рекомендаций:
  - `status` / `indicator` и `additional_status` / `additional_indicator` — от `deadline` (срок контроля из АЗ) и текущей даты: до даты оба `on_control` (серые песочные часы + серый колокольчик), в дату и после `unresolved` + `deadline_violated` (красный треугольник + красный колокольчик). Если вместо срока в АЗ написано «исполнено в ходе аудита», индикатор статуса — синяя звезда, статус `completed`.
  - `completed` и ручной `on_time` не трогаются.
  - Колонка `execution_deadline` — срок исполнения, который ставит аудитор; автостатус её не читает.
  - Пересчёт при create/update и ежедневно в 00:05 Europe/Moscow (`SOKOL_STATUS_SCHEDULER=0` выключает; в pytest выключен).
- `Attachment` — metadata в PG, байты в MinIO, bucket `check-{serial}`.

## Bootstrap

1. `DATABASE_URL` обязателен. Config: `.env` + `.secrets/sokol.env`.
2. Prod: JWT ≥32 и не default; demo load и `SOKOL_SEED_REPLACE` без `--confirm-prod-replace` не стартуют.
3. Docker entrypoint: `init_db` → `BOOTSTRAP_MIGRATIONS` → seed audit_types / check_kinds / ratings (`seed_exact_label_rows`) → `sync_auditors` / `sync_departments` / `sync_users` → `sync_check_buckets` → Excel demo (`SOKOL_LOAD_DEMO_DATA`, в bootstrap default **on**).
4. `sync_dictionaries` в prod — merge-only. В development destructive prune default on (`SOKOL_DESTRUCTIVE_DICTIONARY_SYNC`).

## Non-goals

OIDC · Alembic · distributed очереди · CRUD наблюдений · users PATCH/DELETE · хранение аватаров · drill-down / серверные сохранённые отчёты · конструктор на backend.

## Куда смотреть

| Тема | Frontend | Backend |
|------|----------|---------|
| Проверки | `ChecksTab`, `CheckFormPage` | `endpoints/checks.py`, `checks_service` |
| Рекомендации | `RecommendationsTab`, `RecommendationFormPage` | `endpoints/recommendations.py`, `recommendations_service` |
| Вложения | `api/attachments.ts`, `useStorageStatus` | `attachments_service`, `minio_storage` |
| Аналитика | `AnalyticsTab`, `components/analytics/` | `endpoints/analytics.py`, `services/analytics/` |
| Планирование | `PlanningTab` | `GET /analytics/planning` |
| Конструктор | `ConstructorTab`, `analytics/constructor/` | нет API |
| Tools | `ToolsTab`, `api/tools.ts` | `instruments_reports.py`, `services/reports/` |
| Справочники | `SettingsTab`, `api/settings.ts` | `dictionary_registry.py` |

Контракты: [API.md](API.md), [DATA_AND_DB.md](DATA_AND_DB.md), [ANALYTICS.md](ANALYTICS.md), [STORAGE.md](STORAGE.md), [REPORTS.md](REPORTS.md), [UI_STANDARDS.md](UI_STANDARDS.md).
