# Roadmap — backend

**Актуально:** 11 августа 2026  
**Go-live:** **1 сентября 2026** — жёсткий календарь в [PLAN.md → Go-live](../../PLAN.md#go-live-01092026--жёсткий-план).  
**Единый план:** [PLAN.md](../../PLAN.md).

## Фаза 0 — гигиена

- [x] Зафиксировать порты: Docker **8800**, local `run_dev.ps1` **8802**.
- [x] `GET /api/v1/analytics/checks` для вкладки «Проверки».
- [x] Attachments API + MinIO (см. [STORAGE.md](STORAGE.md)).
- [ ] Унифицировать чтение env только через `Settings`.
- [ ] Актуализировать compose profiles (MinIO в default стеке — проверить docs/DOCKER).

## Фаза 1 — миграции и CI

- [ ] Alembic: baseline от текущей схемы ([ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)).
- [ ] Перенести `migrate_*.py` в ревизии.
- [ ] Prod: только `alembic upgrade head`, не `create_all`.
- [ ] Integration tests: TestClient + тестовая Postgres (CRUD + analytics + attachments smoke).
- [ ] GitHub Actions: `compileall`, `unittest` (+ pytest для analytics helpers).

## Фаза 2 — безопасность

- [ ] JWT/OIDC (Keycloak); `Authorization` на `/api/v1/*`.
- [ ] Роли: auditor / admin.
- [ ] Audit log: delete check, tools generate, settings mutate, attachment delete.

## Фаза 3 — DOCX platform

- [ ] Streaming upload на диск; семафор concurrent jobs.
- [ ] Рефакторинг `docx_generator` / `docx_parser` на фазы.
- [ ] Golden `.docx` в CI.
- [ ] Тесты audit-opinion (мок Ollama).

## Фаза 4 — продукт

- [ ] Analytics API для рекомендаций / мониторинга / ДВА.
- [ ] SQL-агрегации / кэш для `/analytics/checks` при росте данных.
- [ ] FK/валидация строковых справочных полей (опционально).
- [ ] CRUD наблюдений (если войдёт в scope).
- [ ] Очередь фоновых отчётов.

Детали и критерии — в [PLAN.md](../../PLAN.md).
