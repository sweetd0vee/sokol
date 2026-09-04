# Оставшиеся задачи из код-ревью

Календарь go-live, UAT и ops — только в [PLAN.md](../PLAN.md) (цель **15.09.2026**). Здесь — код/UX, который ещё не совпадает с желаемым контуром. Снимок: **04.09.2026**.

Закрыто ранее: Kantsler · prod guards · HTTP Basic off в prod · merge-only sync · конструктор · export планирования · split table export · storage status UX (`useStorageStatus`).

## Ещё открыто

| ID | Где | Сделать | DoD |
|----|-----|---------|-----|
| P0-02 | `/planning` | Явная метка limited/beta | Пользователь видит, что модуль ограниченный |
| P0-03 | `CheckFormPage`, `ChecksTab` | Читать `/settings/check_kinds` вместо `CHECK_VIEW_OPTIONS` | Новый вид из Settings доступен без релиза FE |
| P0-04 | compose | UAT/prod: `SOKOL_ENV=prod`, `SOKOL_LOAD_DEMO_DATA=0`; желательно default `0` | Пустой UAT не грузит demo сам |
| P0-06 | `app/db` | Alembic baseline или подписанный порядок `migrate_*` | Пустая БД поднимается предсказуемо |
| P0-07 | `import_seed_data` | `--dry-run --report` | БД не меняется; csv ok/reject |
| P1-01 | GitHub | Required checks по [CI.md](CI.md) | Merge заблокирован при красном CI |
| P1-02 | import | Reject неизвестных справочников, не `ensure_*` | Нет silent insert в dictionaries |
| P1-04 | ops | Backup/restore drill PG + MinIO | Документы есть ([MINIO.md](MINIO.md)); drill не подтверждён |

P2 после go-live: server pagination · route lazy loading · data-driven visual export · analytics cache.

## Уже не так, как в PLAN.md на 01.09

| Тема | Сейчас в коде |
|------|----------------|
| Export планирования | **включён** (`canExport={Boolean(data)}`) |
| Конструктор | `/constructor`, localStorage, Playwright smoke |
| Storage status UX | `useStorageStatus` + banner/disabled upload + retry |
| Матрица существенности | в ответе `/analytics/recommendations` |
