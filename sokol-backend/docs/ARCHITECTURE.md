# Архитектура backend

FastAPI + async PostgreSQL. DOCX/XLSX и MinIO-I/O — в `asyncio.to_thread`.

## Структура

```
app/
├── main.py                 # FastAPI, CORS, prod guards
├── api/v1/endpoints/       # HTTP
├── core/                   # config, JWT, roles, startup_validation
├── crud/                   # доступ к БД
├── db/                     # session, init_db, catalogs, seeds, migrate_*
├── models/                 # SQLAlchemy
├── schemas/                # Pydantic v2
├── services/
│   ├── checks_service.py / recommendations_service.py / attachments_service.py
│   ├── dictionary_service.py / settings_dictionaries_service.py
│   ├── dictionary_validation.py / dictionary_integrity.py
│   ├── analytics/          # SQL-агрегаты дашбордов
│   ├── reports/            # section_ii, memorandum, control_file
│   └── storage/            # MinIO
└── utils/                  # check_key, paths
```

```
HTTP (endpoints) → services → crud → PostgreSQL
                 → services/reports (DOCX / XLSX)
                 → storage (MinIO)
```

## API-модули

Prefix: `/api/v1`. Auth: `Depends(get_current_user)` на всех роутерах кроме health и `auth` (login публичный; `/me` и смена пароля требуют JWT/Basic).

| Prefix | Домен |
|--------|-------|
| `/status`, `/capabilities` | liveness и `max_upload_*` (публичные) |
| `/auth` | login, `/me`, смена пароля |
| `/users` | список и создание `auditor` (admin) |
| `/checks`, `/recommendations` | домен |
| `/analytics` | агрегаты дашбордов, включая planning |
| `/attachments` | MinIO + metadata |
| `/settings/*` | справочники |
| `/tools` | DOCX / XLSX |

HTTP Basic выключен при `SOKOL_ENV=prod`, если не `SOKOL_ENABLE_BASIC_AUTH=true`. Роли `admin` и `department_head` входят в `ADMIN_ROLES`.

## Домен

- `Check` ↔ `Recommendation` (FK, cascade delete)
- Справочники: `Auditor` (`full_name` + `code` из 3 латинских букв), `AuditType`, `CheckKind`, `EffectivenessRating`, `Department`
- Доменные строки с FK на labels: `check_leader`, `check_view`, `*_effectiveness`, `auditor`
- `RecommendationAuditObject` — junction rec ↔ `departments.name`; массив `audit_object` для аналитики
- `Attachment` — entity + bucket `check-{serial}`
- `User` — локальный логин; аватары не хранятся

Поля и enum'ы: [DATA_AND_DB.md](DATA_AND_DB.md). Отчёты: [REPORTS.md](REPORTS.md).

## Bootstrap (`main.py`)

1. Требует `DATABASE_URL`.
2. Prod guards: JWT secret (≥32, не default), запрет demo load; `--replace` в prod только с `--confirm-prod-replace`.
3. CORS из `SOKOL_CORS_ORIGINS` (пусто → `*`, credentials выключены).
4. Роутер `/api/v1`.

Docker entrypoint (`app.db.bootstrap`): `init_db` → bootstrap-миграции → seed справочников → `sync_dictionaries` → `sync_check_buckets` → опциональный Excel demo (`SOKOL_LOAD_DEMO_DATA`, default on).

## Non-goals

OIDC, Alembic, очереди, CRUD наблюдений, drill-down / сохранённые серверные отчёты, users PATCH/DELETE, хранение аватаров. Конструктор аналитики — только frontend.

## Frontend

| Контракт | Где |
|----------|-----|
| JWT + RBAC | `AuthContext`, `AuthGuard`; `isAdmin` = `admin` \| `department_head` |
| CRUD, settings | `src/api/*.ts` |
| Tools / analytics / attachments | `src/api/tools.ts`, `analytics.ts`, `attachments.ts` |
| Конструктор | localStorage / клиентский state, без backend API |
| Аватары | `src/constants/avatars.ts` |
