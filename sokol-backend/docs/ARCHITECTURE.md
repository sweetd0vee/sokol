# Архитектура backend

FastAPI-сервис с async PostgreSQL. DOCX обрабатывается в `asyncio.to_thread`.

## Структура

```
app/
├── main.py              # FastAPI, CORS, роутеры, prod guards
├── api/v1/endpoints/    # health, auth, checks, recommendations, analytics, attachments, settings, tools
├── core/                # config, JWT, roles, startup_validation
├── crud/                # async CRUD-функции
├── db/                  # session, init_db, seed, migrate_*.py
├── models/              # SQLAlchemy ORM
├── schemas/             # Pydantic v2
├── services/
│   ├── reports/         # section_ii, memorandum
│   ├── analytics/
│   ├── dictionary_validation.py
│   ├── dictionary_integrity.py
│   └── storage/         # MinIO
└── utils/
```

## Слои

```
HTTP (endpoints) → services → crud → PostgreSQL
                 → services/reports (DOCX)
                 → storage (MinIO)
```

Endpoints вызывают доменные services (`checks_service`, `recommendations_service`, `dictionary_service`); CRUD остаётся слоем доступа к БД.

## API-модули

| Prefix | Домен |
|--------|-------|
| `/status` | liveness (публичный) |
| `/auth` | login, `/me` |
| `/checks`, `/recommendations` | домен |
| `/analytics` | агрегаты дашбордов |
| `/attachments` | MinIO + metadata |
| `/settings/*` | справочники |
| `/tools` | DOCX |

Auth: `Depends(get_current_user)` на всех роутерах кроме health, capabilities и login. HTTP Basic выключен при `SOKOL_ENV=prod`, если не задан `SOKOL_ENABLE_BASIC_AUTH=true`.

## Доменные сущности

- `Check` ↔ `Recommendation` (FK, cascade delete)
- Справочники: `Auditor`, `AuditType`, `CheckKind`, `EffectivenessRating`, `Department` (UUID PK)
- Доменные строки с FK на labels: `check_leader`, `check_view`, `*_effectiveness`, `auditor`
- `RecommendationAuditObject` — junction `recommendation` ↔ `departments.name`; массив `audit_object` дублируется для аналитики
- `Attachment` — логическая связь entity + bucket `check-{serial}`

Enum'ы и поля: [DATA_AND_DB.md](DATA_AND_DB.md).

## DOCX (reports)

| Пайплайн | Код | Endpoint |
|----------|-----|----------|
| Раздел II | `services/reports/section_ii/` | `/tools/section-ii*` |
| Докладная | `services/reports/memorandum/` | `/tools/memorandum`, `/tools/parse-recommendations` |

Раздел II правит OOXML (ZIP/XML). Алгоритм: [REPORTS.md](REPORTS.md).

## Bootstrap (`main.py`)

1. Требует `DATABASE_URL`.
2. CORS из `SOKOL_CORS_ORIGINS` (пусто → `*`).
3. Роутер `/api/v1`.

## Non-goals

OIDC, Alembic, фоновые очереди, CRUD наблюдений, drill-down аналитики.

## Связь с фронтом

| Контракт | Frontend |
|----------|----------|
| JWT + RBAC | `AuthContext`, `AdminGuard` |
| CRUD, settings | `src/api/*.ts` |
| Tools | `src/api/tools.ts` |
| Analytics | `src/api/analytics.ts` |
| Attachments | `src/api/attachments.ts` |
