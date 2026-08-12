# Код-ревью backend

**Общая оценка:** 7.3 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO  
**Смысл оценки:** backend уже выглядит как рабочий продуктовый API для пилота, но промышленная готовность упирается в миграции, CI/integration tests и auth hardening.

## Архитектура

```
app/api/v1/endpoints/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

**Плюсы:** плоская структура, async I/O, DOCX в thread pool, централизованный auth на роутерах.

**Минусы:** нет service layer для CRUD; `app/db/` смешивает seed/migrate/import; дублирование section_ii в `sokol-instruments/`.

## Оценка по блокам

| Блок | Оценка | Что хорошо | Что ограничивает |
|------|--------|------------|------------------|
| API routing / CRUD | **8 / 10** | Роуты разделены по доменам, есть pagination, validation справочников и роли | Бизнес-логика частично живёт в CRUD, integration tests узкие |
| Checks / ключ проверки | **9 / 10** | `serial_number` генерируется backend-only и пересчитывается на PATCH; каскад на recommendations/attachments | Нужны тесты на массовые пересчёты и конфликтные данные |
| Recommendations | **7.5 / 10** | Статусы, фильтры, связи с проверками и импорт из АЗ покрывают основной workflow | Bulk replace без транзакционного UX на frontend; cleanup файлов при delete открыт |
| Settings / справочники | **8 / 10** | Общий CRUD для словарей, admin-only mutations, validation в доменных create/PATCH | Нет FK на доменные поля, часть связей строковая |
| Analytics | **7.5 / 10** | Серверные агрегаты по checks/recommendations/monitoring/dva/planning согласованы с UI | In-memory подход нормален для пилота, но не для большого портфеля |
| DOCX reports | **8 / 10** | Раздел II, links, memorandum и parser вынесены в services и хорошо тестируются | Нет очереди, streaming upload и golden DOCX CI |
| Attachments / MinIO | **7 / 10** | Есть metadata model, storage service, upload/list/download/delete API | Нужны prod policy, backup, orphan cleanup |
| Auth / RBAC | **6.5 / 10** | JWT Bearer закрывает API; роли `auditor`/`admin` применены на delete/settings | Роль берётся из token payload; нет OIDC, user lookup/is_active и audit log |
| БД / миграции / import | **5.5 / 10** | `create_all`, seed и import позволяют быстро поднять dev/pilot | Нет Alembic baseline; `migrate_*.py` опасны для повторяемого prod |
| Tests | **7 / 10** | 104 unittest, сильное покрытие DOCX и части domain logic | Нет CI gate и DB-backed integration CRUD suite |

## Security

| Аспект | Статус |
|--------|--------|
| JWT Bearer | ✅ |
| PBKDF2 пароли | ✅ |
| DELETE / settings | admin only ✅ |
| Role из JWT без DB lookup | ⚠️ P1 |
| Default JWT secret в dev | ⚠️ override на prod |
| HTTP Basic fallback | ⚠️ отключить на prod |

## API

- Pagination checks/recommendations: skip/limit ✅
- Dictionary validation на create/update ✅
- Analytics: in-memory по всей БД — OK до ~1k записей
- Attachments + MinIO ✅

### Ключ проверки ✅

`checks_crud.py`: create генерирует unique serial; PATCH пересчитывает при смене `start_date` / `check_leader` / `check_type`; каскад на `recommendations.serial_number` и `attachments.check_serial_number`.

## DOCX tools

| Tool | Статус |
|------|--------|
| Раздел II (+ links) | ✅ реализовано, ~70+ parser tests |
| Докладная / parse-recommendations | ✅ |

`audit-opinion` не считается частью текущего API: endpoint/routes отсутствуют и уже не описаны в `docs/API.md`. Оставшиеся `SOKOL_OLLAMA_*` — backlog/env-хвост, не готовая функция.

## БД

- Схема: `create_all` + `migrate_*.py` — **нет Alembic** (P0).
- Import `--replace` опасен на prod.
- Entrypoint: init → migrate → seed → optional demo.

## Тесты

104 теста на Python 3.12 (1 skipped). Сильное покрытие section_ii; слабое — integration CRUD/import на живой Postgres.

## Findings

| Приоритет | Finding |
|-----------|---------|
| P0 | Alembic |
| P0 | Guard demo import / JWT secret на prod |
| P1 | JWT user lookup |
| P1 | Integration tests (testcontainers) |
| P2 | Analytics SQL aggregates при росте данных |
| P2 | Delete recommendation → cleanup MinIO objects |
| P3 | Consolidate sokol-instruments |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
