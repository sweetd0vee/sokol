# Roadmap — backend

**Актуально:** 11 августа 2026  
**Go-live:** **1 сентября 2026** — жёсткий календарь в [PLAN.md → Go-live](../../PLAN.md#go-live-01092026--жёсткий-план).  
**Единый план:** [PLAN.md](../../PLAN.md).

## Фаза 0 — гигиена

- [x] Зафиксировать порты: Docker **8800**, local `run_dev.ps1` **8802**.
- [x] Analytics API: checks / recommendations / monitoring / dva / planning.
- [x] Attachments API + MinIO (см. [STORAGE.md](STORAGE.md)).
- [x] Env app-конфига через `Settings` (CORS, upload, JWT, MinIO).
- [x] Dictionary validation на create/update checks/recommendations.

## Фаза 1 — миграции и CI

- [ ] Alembic: baseline от текущей схемы ([ALEMBIC_AND_DATA.md](ALEMBIC_AND_DATA.md)).
- [ ] Перенести `migrate_*.py` в ревизии.
- [ ] Prod: только `alembic upgrade head`, не `create_all`.
- [ ] Integration tests: TestClient + тестовая Postgres (CRUD + analytics + attachments smoke).
- [ ] GitHub Actions: `compileall`, `unittest`.

## Фаза 2 — безопасность

- [x] Internal JWT; `Authorization` на `/api/v1/*` (кроме health + login).
- [x] Роли: auditor / admin.
- [ ] OIDC / Keycloak поверх JWT.
- [ ] Audit log: delete check, tools generate, settings mutate, attachment delete.

## Фаза 3 — DOCX platform

- [ ] Streaming upload на диск; семафор concurrent jobs.
- [ ] Рефакторинг `docx_generator` / `docx_parser` на фазы.
- [ ] Golden `.docx` в CI.
- [ ] Тесты audit-opinion (мок Ollama).

## Фаза 4 — продукт

- [x] Analytics API для рекомендаций / мониторинга / ДВА / planning.
- [ ] SQL-агрегации / кэш analytics при росте данных.
- [ ] FK справочников (validation уже есть).
- [ ] CRUD наблюдений (если войдёт в scope).
- [ ] Очередь фоновых отчётов.

Детали и критерии — в [PLAN.md](../../PLAN.md).
