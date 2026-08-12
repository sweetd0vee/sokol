# Код-ревью backend

**Оценка:** 7.3 / 10 · Python 3.12, FastAPI, SQLAlchemy async, MinIO

## Архитектура

```
app/api/v1/endpoints/  →  crud/  →  PostgreSQL
                      →  services/reports/  (DOCX)
                      →  services/analytics/
                      →  services/storage/  (MinIO)
```

**Плюсы:** плоская структура, async I/O, DOCX в thread pool, централизованный auth на роутерах.

**Минусы:** нет service layer для CRUD; `app/db/` смешивает seed/migrate/import; дублирование section_ii в `sokol-instruments/`.

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
| **Audit opinion (Ollama)** | ❌ **не реализовано** — только env в `config.py`, routes отсутствуют |

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
| P1 | Реализовать или убрать audit-opinion из API docs |
| P2 | Analytics SQL aggregates при росте данных |
| P2 | Delete recommendation → cleanup MinIO objects |
| P3 | Consolidate sokol-instruments |

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
