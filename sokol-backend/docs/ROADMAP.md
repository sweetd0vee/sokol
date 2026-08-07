# Roadmap — backend

**Актуально:** 7 августа 2026  
**Go-live:** **1 сентября 2026** — жёсткий календарь и scope freeze в [PLAN.md → Go-live](../../PLAN.md#go-live-01092026--жёсткий-план).  
**Единый план:** [PLAN.md](../../PLAN.md) — фазы, playbooks MinIO / Alembic / bank deploy / реальные данные.

Ниже — backlog API/DOCX. До 01.09 приоритет только задачам из go-live календаря.

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

- [ ] Attachments: MinIO + metadata в БД — **детальный план:** [PLAN.md playbook A](../../PLAN.md#playbook-a--внедрение-minio-файловое-хранилище).
- [ ] Server-side pagination/filter (используется фронтом).
- [ ] FK или validation справочников vs доменные строки; wire `check_kinds` → домен проверки.
- [ ] CRUD **наблюдений** (для frontend UI).
- [ ] Import dry-run + отчёт ошибок для реальных данных — [playbook D](../../PLAN.md#playbook-d--подготовка-данных-реальных-проверок).
- [ ] (Опционально) analytics API при росте объёма данных.

## Bank / ops (документация → реализация)

- [ ] UAT/prod по [playbook C](../../PLAN.md#playbook-c--развёртывание-во-внутренней-сети-банка) (TLS, DNS, backup, air-gap).
- [ ] Alembic baseline — [playbook B](../../PLAN.md#playbook-b--подготовка-миграций-данных-alembic--данные).

## Метрики (сводка)

| Критерий | Сейчас | Цель |
|----------|--------|------|
| Auth | нет | обязательно |
| Миграции | create_all | Alembic |
| CI | нет | unittest на PR |
| Upload | in-memory | stream + concurrency |
| API tests | нет | smoke CRUD + tools |

Полная таблица — в [PLAN.md](../../PLAN.md#матрица-готовности-к-промышленной-эксплуатации).
