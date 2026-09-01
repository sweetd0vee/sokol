# Архитектура backend

FastAPI-сервис с async PostgreSQL. DOCX/XLSX обрабатываются в `asyncio.to_thread`.

## Структура

```
app/
├── main.py              # FastAPI, CORS, роутеры, prod guards
├── api/v1/endpoints/    # health, auth, users, checks, recommendations,
│                        # analytics, attachments, settings, tools
├── core/                # config, JWT, roles, startup_validation
├── crud/                # async CRUD-функции
├── db/                  # session, init_db, catalogs, seeds, migrate_*.py
├── models/              # SQLAlchemy ORM
├── schemas/             # Pydantic v2
├── services/
│   ├── reports/         # section_ii, memorandum, control_file
│   ├── analytics/
│   ├── dictionary_validation.py
│   ├── dictionary_integrity.py
│   └── storage/         # MinIO
└── utils/               # check_key и прочее
```

## Слои

```
HTTP (endpoints) → services → crud → PostgreSQL
                 → services/reports (DOCX / XLSX)
                 → storage (MinIO)
```

Endpoints вызывают доменные services (`checks_service`, `recommendations_service`, `dictionary_service`); CRUD остаётся слоем доступа к БД.

## API-модули

| Prefix | Домен |
|--------|-------|
| `/status`, `/capabilities` | liveness и runtime limits (публичные) |
| `/auth` | login, `/me`, смена пароля |
| `/users` | список и создание auditor-пользователей (admin) |
| `/checks`, `/recommendations` | домен |
| `/analytics` | агрегаты дашбордов, включая планирование |
| `/attachments` | MinIO + metadata |
| `/settings/*` | справочники |
| `/tools` | DOCX / XLSX |

Auth: `Depends(get_current_user)` на всех роутерах кроме health и auth. HTTP Basic выключен при `SOKOL_ENV=prod`, если не задан `SOKOL_ENABLE_BASIC_AUTH=true`. Роли `admin` и `department_head` входят в `ADMIN_ROLES` и проходят `require_admin`.

## Доменные сущности

- `Check` ↔ `Recommendation` (FK, cascade delete)
- Справочники: `Auditor` (`full_name` + уникальный `code` из 3 латинских букв), `AuditType`, `CheckKind`, `EffectivenessRating`, `Department` (UUID PK)
- Доменные строки с FK на labels: `check_leader`, `check_view`, `*_effectiveness`, `auditor`
- `RecommendationAuditObject` — junction `recommendation` ↔ `departments.name`; массив `audit_object` дублируется для аналитики
- `Attachment` — логическая связь entity + bucket `check-{serial}`
- `User` — локальный логин; роль `admin` / `department_head` / `auditor`. Аватары на backend не хранятся.

Enum'ы и поля: [DATA_AND_DB.md](DATA_AND_DB.md).

## DOCX / XLSX (reports)

| Пайплайн | Код | Endpoint |
|----------|-----|----------|
| Раздел II | `services/reports/section_ii/` | `/tools/section-ii*` |
| Докладная | `services/reports/memorandum/` | `/tools/memorandum`, `/tools/parse-recommendations` |
| Файл контроля | `services/reports/control_file/` | `/tools/control-file-template`, `/tools/control-file` |

Раздел II правит OOXML (ZIP/XML). Алгоритм: [REPORTS.md](REPORTS.md).

## Bootstrap (`main.py`)

1. Требует `DATABASE_URL`.
2. Prod guards: JWT secret, запрет demo load / `--replace` в `SOKOL_ENV=prod`.
3. CORS из `SOKOL_CORS_ORIGINS` (пусто → `*`).
4. Роутер `/api/v1`.

Docker entrypoint: `init_db` → bootstrap-миграции → seed справочников → `sync_dictionaries` (auditors/departments/users) → опциональный Excel demo import.

## Non-goals

OIDC, Alembic, фоновые очереди, CRUD наблюдений, drill-down / сохранённые серверные отчёты аналитики, users PATCH/DELETE, хранение аватаров.

## Связь с фронтом

| Контракт | Frontend |
|----------|----------|
| JWT + RBAC | `AuthContext`, `AdminGuard` |
| CRUD, settings | `src/api/*.ts` |
| Tools | `src/api/tools.ts` |
| Analytics | `src/api/analytics.ts` |
| Attachments | `src/api/attachments.ts` |
| Аватары | только frontend (`src/constants/avatars.ts`); backend не участвует |
