# План действий после код-ревью

**Синхронизация:** [PLAN.md](../PLAN.md) (go-live **01.09.2026**)  
**Источник:** [CODE_REVIEW.md](CODE_REVIEW.md)

| Уровень | Окно | Критерий |
|---------|------|----------|
| P0 | до 18.08 | Блокер go-live, ИБ, ложный UI |
| P1 | до 25.08 | Стабильность пилота |
| P2 | 08–09/2026 | Качество, масштаб |
| P3 | после 01.09 | Backlog |

## P0 — немедленно

| ID | Задача | Effort |
|----|--------|--------|
| P0-01 | Скрыть Kantsler из production nav/route | 0.5 d |
| P0-03 | Docker demo import off by default; запретить `import/seed --replace` на UAT/prod без явного confirm | 0.5 d |
| P0-04 | Alembic baseline + `upgrade head` | 3–5 d |

## P1 — до пилота

| ID | Задача | Effort |
|----|--------|--------|
| P1-02 | CI workflow добавлен; включить required checks по [CI.md](CI.md) | 0.5 d |
| P1-05 | MinIO policy + UI banner при недоступном storage | 1–2 d |
| P1-06 | Import dry-run + reject report | 2 d |
| P1-08 | Runbook backup/restore Postgres + MinIO | 2 d |
| P1-09 | HTTP Basic fallback: отключить/feature-flag для prod | 0.5 d |
| P1-12 | Prod-safe `sync_dictionaries`: без destructive delete на старте | 1 d |

## P2 — после go-live / параллельно

Server pagination · golden DOCX CI · planning export · split exports.ts · route lazy loading · analytics SQL aggregates.

## Gates

| Gate | Дата | Критерий |
|------|------|----------|
| G-A | 14.08 | P0-01..03; Alembic started |
| G-B | 20.08 | Auth UAT; CI green; branch protection requires CI checks |
| G-C | 27.08 | MinIO decision; DOCX smoke; no P0 |
| G-D | 01.09 | PLAN G1–G12 signed |

## Метрики

| Метрика | Сейчас | Target 01.09 |
|---------|--------|--------------|
| BE tests (py 3.12) | 139 | ≥140 + integration |
| FE tests | 54 | ≥55 |
| ESLint warnings | 0 | 0 |
| Open P0 | 3 | 0 |
| Demo routes visible | 1 | 0 |

## Эта неделя (12–15.08)

1. P0-01 — скрыть Kantsler  
2. P0-03 — prod guards  
3. P0-04 — старт Alembic  
4. P1-02 — включить required CI checks  
5. P1-05 — MinIO policy / storage UX  

## Детализация задач для исправления багов

| ID | Что сделать в коде | Definition of Done |
|----|--------------------|--------------------|
| P0-01 | Убрать `kantsler` из `Sidebar.TABS` и route `/kantsler` или закрыть feature flag `VITE_ENABLE_KANTSLER`. | В production build меню не содержит `Канцлер`; прямой `/kantsler` не показывает stub; Playwright smoke зелёный. |
| P0-03 | В `sokol-backend/docker/app/docker-compose.yml` и `entrypoint.sh` поставить demo load default `0`; в prod guard запретить demo/replace flags. | Пустой prod/UAT контейнер не импортирует demo Excel сам; `SOKOL_SEED_REPLACE=1` в prod падает до bootstrap. |
| P0-04 | Ввести Alembic baseline и заменить prod `create_all` flow на `alembic upgrade head`. | Пустая test DB поднимается миграциями; повторный upgrade no-op; runbook обновлён. |
| P1-05 | Добавить frontend `useStorageStatus` и backend/storage runbook: disabled/unreachable states, retry, policy/backup. | Upload disabled при недоступном MinIO; пользователь видит причину; backup/restore steps описаны. |
| P1-09 | Добавить `SOKOL_ENABLE_BASIC_AUTH`; в prod не принимать `_basic`, если flag выключен. | При prod config Basic получает 401; Bearer продолжает работать. |
| P1-12 | Изменить `sync_dictionaries`: prod merge-only, destructive sync только с dev/demo flag. | Пользовательские auditors/departments/users не удаляются после restart; delete проверяет использование. |
