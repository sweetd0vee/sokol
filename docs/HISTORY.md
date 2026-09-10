# Исторические снимки (04.09.2026)

Не текущий статус продукта. Календарь того спринта — [PLAN.md](../PLAN.md). Живые доки: [README.md](README.md).

На дату снимка пилот на контролируемом объёме был возможен. Оценки блоков 8–10, кроме БД/import (**6**, нет Alembic) и frontend data (**7.5**, bulk-fetch 10000).

Уже закрыто относительно того ревью (не повторять): Kantsler · prod guards demo/replace · Basic off в prod · merge-only `sync_dictionaries` в prod · конструктор `/constructor` · visual export планирования · split `tableExport/` · `seed_demo_attachments` · `useStorageStatus` · виды проверок из `/settings/check_kinds`.

## Ещё открытый backlog

| ID | Что |
|----|-----|
| P0-02 | Метка limited/beta на `/planning` |
| P0-04 | Compose demo default on; UAT/prod: `SOKOL_ENV=prod` + `SOKOL_LOAD_DEMO_DATA=0` |
| P0-06 | Alembic **или** подписанный порядок `BOOTSTRAP_MIGRATIONS` |
| P0-07 | Import `--dry-run --report` |
| P1-01 | Required CI checks в GitHub ([CI.md](CI.md)) |
| P1-02 | Import не досоздаёт неизвестные labels (`ensure_*`) |
| P1-04 | Backup/restore drill PG + MinIO (документы есть: [STORAGE.md](STORAGE.md), [DATA_AND_DB.md](DATA_AND_DB.md)) |

P2 после стабилизации: server pagination · lazy routes · data-driven visual export (не DOM) · analytics cache · OIDC · audit log · users PATCH/DELETE · CRUD наблюдений · серверные дашборды.

## Как чинить без регрессий

1. Serial / вложения: создать проверку → файл → смена лидера/даты/типа → скачать → удалить.
2. Списки: не ломать bulk-fetch до 10000.
3. Backend: HTTP-тест на endpoint; схема — integration с `SOKOL_RUN_DB_INTEGRATION_TESTS=1`.
4. Frontend: unit рядом с helper; критичные маршруты — Playwright (`npm run test:e2e`, не в CI).
