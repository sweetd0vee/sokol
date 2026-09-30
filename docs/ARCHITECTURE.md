# Архитектура

React SPA + FastAPI + PostgreSQL 16 + MinIO. DOCX/XLSX и MinIO-I/O идут через `asyncio.to_thread`. Тяжёлые DOCX — in-process очередь слотов (`services/reports/docx_queue.py`), не Celery.

Цепочка: UI → `src/api` → endpoint → service → CRUD → Postgres/MinIO. Commit, MinIO и доменная валидация — в service. CRUD только делает SQL (`flush`): без `commit`, без импорта `app.services`, MinIO и Pydantic-схем. Откат незакоммиченной записи проверки и рекомендации — `rollback_on_error` (`services/db_transaction.py`).

```text
sokol/
├── docs/                  # этот каталог
├── data/                  # Excel seed
├── sokol-backend/         # FastAPI
├── sokol-frontend/        # React 19 + Vite
└── sokol-instruments/     # legacy Streamlit, для новой работы не нужен
```

Запуск и env — [README.md](../README.md), [sokol-backend/README.md](../sokol-backend/README.md), [sokol-frontend/README.md](../sokol-frontend/README.md).

## Backend

```text
app/
├── main.py                     # FastAPI, CORS, request-id, prod guards, scheduler
├── api/deps.py                 # JWT / Basic, require_admin
├── api/middleware.py           # X-Request-ID, access log, счётчики
├── api/exception_handlers.py   # DomainError / 422 / 500 → {detail}
├── api/v1/endpoints/           # checks, recommendations, analytics, attachments, auth, users, tools, health
├── api/v1/dictionary_registry.py   # factory /settings/* (отдельных endpoint-файлов нет)
├── core/                       # config, JWT, роли, logging, metrics, person_match, startup_validation
├── crud/ · models/ · schemas/
├── db/                         # session, init_db, seeds, migrations, import
└── services/                   # домен, analytics, reports, MinIO, status refresh
```

Prefix `/api/v1`. Auth на всех роутерах, кроме `GET /`, `/status`, `/ready`, `/metrics`, `/capabilities` и `POST /auth/login`. HTTP Basic включён в non-prod и выключен в prod, пока не `SOKOL_ENABLE_BASIC_AUTH=true`. Роль на каждый запрос читается из БД, не из JWT. Пустой `SOKOL_CORS_ORIGINS` → `*` без credentials. `DomainError` уходит клиенту как `{detail}` без traceback.

Справочники: `DICTIONARY_ROUTER_CONFIGS` → `make_dictionary_router` → общий `DictionaryService`.

## Frontend

```text
src/
  api/          # axios, доменные клиенты, mappers, queryKeys
  components/   # analytics, checks, recommendations, lists, forms, layout, tools, ui
  contexts/     # AuthContext, SokolDataProvider
  hooks/ · utils/ · constants/formLayout.ts
  config/env.ts
```

```text
QueryClient → AuthProvider → SokolDataProvider → AnalyticsConstructorProvider → BrowserRouter
  /login                 публичный
  /*                     AuthGuard → AppLayout (Suspense по разделам)
  /settings              AdminGuard (isAdmin)
```

`React.lazy` режет аналитику, конструктор, tools и формы. Вкладки аналитики грузятся по посещению и остаются смонтированными. Неизвестный путь → `/checks`. Маршрута «Канцлер» нет.

| Route | Что |
|-------|-----|
| `/checks`, `/recommendations` | списки и формы (`/new`, `/:id/edit`) |
| `/analytics` | 4 вкладки |
| `/planning` | планирование |
| `/constructor`, `/constructor/:id` | холст, только localStorage |
| `/tools` | АЗ / ДЗ |
| `/settings` | справочники, mutate — admin |
| `/profile` | аватар (localStorage), пароль; admin создаёт users |

State: Context + React Query, без Redux. Списки — bulk-fetch до 10 000, фильтр, сорт и пагинация (по 50) на клиенте. `src/api/client.ts`: Bearer, 401 → logout. Поля API ↔ UI — `mappers.ts`. Виды проверок в Settings, формах и фильтрах — `GET /settings/check_kinds` (`useCheckKindOptions`).

## Auth

Роли: `auditor`, `department_head`, `admin`. `ADMIN_ROLES` и UI `isAdmin` — admin и department_head.

Login матчит `username` и `aliases`. Неактивные не проходят. Изменение и удаление проверки: admin — любая; аудитор — если он `check_leader` или `created_by`. Рекомендация — если он её аудитор, руководитель проверки, `created_by` рекомендации или проверки. Сравнение через `person_match` (фамилия + инициалы). То же на фронте (`personMatch.ts`). Фильтр «Мои» берёт `username` из сессии, а не результат серверной проверки прав: у проверок это точное совпадение с `check_leader`, у рекомендаций — аудитор или `manager`.

Пароли: PBKDF2-SHA256; на login ещё принимается legacy plaintext. Аватары только в localStorage. OIDC нет. Матрица HTTP — [API.md](API.md).

## Инварианты

- `serial_number` считает только backend: `{YY}{AUDITOR_CODE}{QUARTER}{P|V|K}{N}`. N — среди проверок того же руководителя, типа и года. Код аудитора — 3 латинские буквы. Смена `start_date` / `check_quarter` / `check_leader` / `check_type` или `auditors.code` запускает `check_serial_cascade` (ключи рекомендаций, вложения, copy+delete MinIO).
- Справочники: FK на unique label (`ON UPDATE CASCADE`). API create/update отклоняет неизвестный label (**400**). Import Excel досоздаёт (`ensure_*`).
- `audit_object` — массив и junction `recommendation_audit_objects`. Пустое → «Не указан». Аналитика фильтрует по массиву (`overlap`).
- Автостатус рекомендаций — [RECOMMENDATION_INDICATORS.md](RECOMMENDATION_INDICATORS.md). Колонка `execution_deadline` в правилах не участвует. Пересчёт на create/update, в карточке, в превью АЗ и ежедневно в 00:05 Europe/Moscow (`SOKOL_STATUS_SCHEDULER=0` выключает).
- Статус проверки по календарю Москвы: есть дата ДЗ → `completed`; `start_date` позже сегодня → `not_started`; иначе `in_progress`. `end_date` статус не двигает. Тот же ночной цикл.
- `Attachment`: metadata в Postgres, байты в MinIO, bucket `check-{serial}`.

## Bootstrap

1. `DATABASE_URL` обязателен. Config: `.env` и `.secrets/sokol.env`.
2. Prod не стартует со слабым или дефолтным JWT, с demo-load и с `SOKOL_SEED_REPLACE` без `--confirm-prod-replace`.
3. Docker entrypoint: `init_db` → `BOOTSTRAP_MIGRATIONS` → seed справочников и users → `sync_check_buckets` → Excel demo (`SOKOL_LOAD_DEMO_DATA`, в bootstrap по умолчанию включён).
4. `sync_dictionaries` в prod — только merge. В development destructive prune включён (`SOKOL_DESTRUCTIVE_DICTIONARY_SYNC`).

## Куда смотреть

| Тема | Frontend | Backend |
|------|----------|---------|
| Проверки | `ChecksTab`, `CheckFormPage` | `endpoints/checks.py`, `checks_service`, `check_status.py` |
| Рекомендации | `RecommendationsTab`, `RecommendationFormPage` | `endpoints/recommendations.py`, `recommendations_service` |
| Индикаторы | `recommendationAutoStatus.ts` | `recommendation_status.py` |
| Вложения | `api/attachments.ts` | `attachments_service`, `minio_storage` |
| Аналитика | `components/analytics/` | `services/analytics/` |
| Конструктор | `analytics/constructor/` | нет API |
| Tools | `api/tools.ts` | `services/reports/` |
| Справочники | `SettingsTab`, `api/settings.ts` | `dictionary_registry.py` |

Новая сущность: модель → schema → CRUD → service → endpoint → router → TS types → `src/api` → UI → тесты. Новый справочник — строка в `DICTIONARY_ROUTER_CONFIGS` и `makeSettingsCrud`, отдельный endpoint-файл не нужен. `serial_number` frontend не считает.

С чего читать код: `AppProviders.tsx` → `src/api/client.ts` → `SokolDataContext.tsx` → `app/main.py` → `endpoints/checks.py`.

## Чего нет

OIDC, Alembic, отдельная очередь задач, CRUD наблюдений, users PATCH/DELETE, аватары на сервере, drill-down и серверные дашборды. Ночные снимки БД и MinIO — сервис `backup` в Compose.
