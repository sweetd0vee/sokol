# Roadmap — backend

**Актуально:** август 2026  
**Единый план:** [PLAN.md](../../PLAN.md) — приоритеты, фазы, спринты, матрица prod-readiness.

Ниже — backlog, специфичный для API и DOCX. Порядок согласован с общим планом.

## Фаза 0 — гигиена

- [x] Зафиксировать порты: Docker **8800**, local `run_dev.ps1` **8802**.
- [x] Analytics API не нужен — фронт считает на клиенте.
- [ ] Унифицировать порт API в коде (опционально, если onboarding путает).
- [ ] Единый `Settings` (CORS, max upload) вместо разрозненного `os.getenv`.
- [x] MinIO/MailHog — вынесены из default compose в `profiles: ["extras"]`.

## Фаза 1 — миграции и CI

- [ ] Alembic: baseline от текущей схемы.
- [ ] Перенести `migrate_*.py` в ревизии.
- [ ] Prod: только `alembic upgrade head`, не `create_all`.
- [ ] Integration tests: TestClient + тестовая Postgres (CRUD smoke).
- [ ] GitHub Actions: `compileall`, `unittest`.

## Фаза 2 — безопасность

- [ ] JWT/OIDC (Keycloak); `Authorization` на `/api/v1/*`.
- [ ] Роли: auditor / admin.
- [ ] Audit log: delete check, tools generate, settings mutate.

## Фаза 3 — DOCX platform

- [ ] Streaming upload на диск; семафор concurrent jobs.
- [ ] Рефакторинг `docx_generator` / `docx_parser` на фазы.
- [ ] Golden `.docx` в CI.
- [ ] Тесты audit-opinion (мок Ollama).
- [ ] Единые exception handlers.

## Фаза 4 — продукт

- [ ] Attachments: MinIO + metadata в БД.
- [ ] Server-side pagination/filter (используется фронтом).
- [ ] FK или validation справочников vs доменные строки.
- [ ] CRUD **наблюдений** (для frontend UI).
- [ ] (Опционально) analytics API при росте объёма данных.

## Метрики (сводка)

| Критерий | Сейчас | Цель |
|----------|--------|------|
| Auth | нет | обязательно |
| Миграции | create_all | Alembic |
| CI | нет | unittest на PR |
| Upload | in-memory | stream + concurrency |
| API tests | нет | smoke CRUD + tools |

Полная таблица — в [PLAN.md](../../PLAN.md#матрица-готовности-к-промышленной-эксплуатации).
