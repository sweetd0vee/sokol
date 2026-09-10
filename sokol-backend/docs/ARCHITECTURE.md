# Архитектура backend

FastAPI + async PostgreSQL. DOCX/XLSX и MinIO-I/O — в `asyncio.to_thread`. Тяжёлые DOCX-jobs идут через in-process очередь слотов (`services/reports/docx_queue.py`).

## Структура

```
app/
├── main.py                 # FastAPI, CORS, prod guards
├── api/
│   ├── deps.py             # JWT / Basic, require_admin
│   ├── exception_handlers.py
│   ├── uploads.py          # общие лимиты upload / temp files
│   └── v1/endpoints/       # HTTP
├── core/                   # config, JWT, roles, security, startup_validation, recommendation_access
├── crud/                   # доступ к БД
├── db/                     # session, init_db, catalogs, seeds, migrate_*
├── models/                 # SQLAlchemy
├── schemas/                # Pydantic v2
├── services/
│   ├── checks_service.py / recommendations_service.py / attachments_service.py
│   ├── users_service.py / check_serial_cascade.py
│   ├── dictionary_*.py / settings_dictionaries_service.py / crud_errors.py
│   ├── analytics/          # SQL-агрегаты дашбордов
│   ├── reports/            # section_ii, memorandum, control_file, az_import, docx_queue
│   └── storage/            # MinIO
└── utils/                  # check_key, paths (SOKOL_DATA_DIR / repo data/)
```

```
HTTP (endpoints) → services → crud → PostgreSQL
                 → services/reports (DOCX / XLSX + queue)
                 → storage (MinIO)
```

## API-модули

Prefix: `/api/v1`. Auth: `Depends(get_current_user)` на всех роутерах кроме health и `auth` (login публичный; `/me` и смена пароля требуют JWT/Basic).

| Prefix | Домен |
|--------|-------|
| `/status`, `/capabilities` | liveness, `max_upload_*` и лимиты очереди DOCX (публичные) |
| `/auth` | login, `/me`, смена пароля |
| `/users` | список и создание `auditor` (admin) |
| `/checks`, `/recommendations` | домен |
| `/analytics` | агрегаты дашбордов, включая planning |
| `/attachments` | MinIO + metadata |
| `/settings/*` | справочники |
| `/tools` | DOCX / XLSX |

HTTP Basic выключен при `SOKOL_ENV` ∈ `{prod, production}`, если не `SOKOL_ENABLE_BASIC_AUTH=true`. Роли `admin` и `department_head` входят в `ADMIN_ROLES`.

## Домен

- `Check` ↔ `Recommendation` (FK, cascade delete)
- Справочники: `Auditor` (`full_name` + `code` из 3 латинских букв), `AuditType`, `CheckKind`, `EffectivenessRating`, `Department`
- Доменные строки с FK на labels: `check_leader`, `check_view`, `*_effectiveness`, `auditor`
- Смена `auditors.code` → `check_serial_cascade`: пересчёт `serial_number` проверок, rec/attachment serials, копирование/очистка MinIO buckets
- `RecommendationAuditObject` — junction rec ↔ `departments.name`; массив `audit_object` для аналитики
- `Attachment` — entity + bucket `check-{serial}`
- `User` — локальный логин (PBKDF2-SHA256 + legacy plaintext verify); аватары не хранятся
- Статусы открытых рекомендаций (`on_control` / `in_progress` и индикаторы) считаются от `deadline` / `execution_deadline` и обновляются in-process каждый день в 00:05 Europe/Moscow (`services/recommendation_status.py`). `SOKOL_STATUS_SCHEDULER=0` выключает цикл.

Поля и enum'ы: [DATA_AND_DB.md](DATA_AND_DB.md). Отчёты: [REPORTS.md](REPORTS.md).

## Bootstrap (`main.py` / Docker)

1. Требует `DATABASE_URL`. Config читает `.env` и `.secrets/sokol.env`.
2. Prod guards: JWT secret (≥32, не default), запрет demo load и `SOKOL_SEED_REPLACE`; CLI `--replace` в prod только с `--confirm-prod-replace`.
3. CORS из `SOKOL_CORS_ORIGINS` (пусто → `*`, credentials выключены).
4. Роутер `/api/v1` + `DomainError` → HTTP `{detail}`.

Docker entrypoint (`app.db.bootstrap`): `init_db` → bootstrap-миграции → seed справочников (audit_types / check_kinds / ratings) → `sync_auditors` / `sync_departments` / `sync_users` → `sync_check_buckets` → опциональный Excel demo (`SOKOL_LOAD_DEMO_DATA`, default on). После старта API in-process цикл раз в сутки пересчитывает статусы открытых рекомендаций.

## Non-goals

OIDC, Alembic, **distributed** очереди (Celery/RQ/Redis), CRUD наблюдений, drill-down / сохранённые серверные отчёты, users PATCH/DELETE, хранение аватаров. Есть in-process DOCX slot queue. Конструктор аналитики — только frontend.

## Frontend

| Контракт | Где |
|----------|-----|
| JWT + RBAC | `AuthContext`, `AuthGuard`; `isAdmin` = `admin` \| `department_head` |
| CRUD, settings | `src/api/*.ts` |
| Tools / analytics / attachments | `src/api/tools.ts`, `analytics.ts`, `attachments.ts` |
| Конструктор | localStorage / клиентский state, без backend API |
| Аватары | `src/constants/avatars.ts` |
