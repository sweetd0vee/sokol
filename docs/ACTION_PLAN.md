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
| P0-02 | Prod: `SOKOL_ENV=prod` + strong `SOKOL_JWT_SECRET`, fail-fast на default | **done** |
| P0-03 | Запретить `import/seed --replace` и presentation demo bootstrap на UAT/prod без явного confirm | 0.5 d |
| P0-04 | Alembic baseline + `upgrade head` | 3–5 d |
| P0-05 | Audit-opinion: убрать из `docs/API` | **done** |

## P1 — до пилота

| ID | Задача | Effort |
|----|--------|--------|
| P1-01 | JWT: lookup user в БД + `is_active` | 1 d |
| P1-02 | CI workflow добавлен; включить required checks по [CI.md](CI.md) | 0.5 d |
| P1-03 | ~~Server serial_number~~ — **выполнено** | — |
| P1-04 | Таблицы: «Показано X из Y» | 1 d |
| P1-05 | MinIO policy + UI banner при недоступном storage | 1–2 d |
| P1-06 | Import dry-run + reject report | 2 d |
| P1-07 | Delete recommendation → cleanup MinIO | 0.5 d |
| P1-08 | Runbook backup/restore Postgres + MinIO | 2 d |
| P1-09 | JWT Bearer: user lookup + `is_active` на каждый request | 1 d |
| P1-10 | Bulk replace recommendations перенести в backend transaction | 1–2 d |
| P1-11 | Attachment cleanup при upload DB failure и смене serial bucket | 1–2 d |

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
| BE tests (py 3.12) | 104 | ≥110 + integration |
| FE tests | 44 | ≥55 |
| ESLint warnings | 0 | 0 |
| Open P0 | 4 | 0 |
| Demo routes visible | 1 | 0 |

## Эта неделя (12–15.08)

1. P0-01 — скрыть Kantsler  
2. P0-02, P0-03 — prod guards  
3. P0-04 — старт Alembic  
4. P1-02 — включить required CI checks  
5. P1-05 — MinIO policy / storage UX  

## Детализация задач для исправления багов

| ID | Что сделать в коде | Definition of Done |
|----|--------------------|--------------------|
| P0-01 | Убрать `kantsler` из `Sidebar.TABS` и route `/kantsler` или закрыть feature flag `VITE_ENABLE_KANTSLER`. | В production build меню не содержит `Канцлер`; прямой `/kantsler` не показывает stub; Playwright smoke зелёный. |
| P0-04 | Ввести Alembic baseline и заменить prod `create_all` flow на `alembic upgrade head`. | Пустая test DB поднимается миграциями; повторный upgrade no-op; runbook обновлён. |
| P1-04 | Протащить `total` из `fetchChecks/fetchRecommendations` в UI и показать truncation warning. | При `items.length < total` пользователь видит “Показано X из Y”; export явно говорит “текущая выборка” или грузит все данные. |
| P1-05 | Добавить frontend `useStorageStatus` и backend/storage runbook: disabled/unreachable states, retry, policy/backup. | Upload disabled при недоступном MinIO; пользователь видит причину; backup/restore steps описаны. |
| P1-07 | При delete recommendation удалять attachments rows и MinIO objects. | Интеграционный/HTTP тест подтверждает cleanup; orphan report не находит файлы удалённой рекомендации. |
| P1-09 | `get_current_user` для Bearer читает пользователя из БД и проверяет `is_active`; Basic выключается в prod. | Деактивированный пользователь с валидным JWT получает 401; смена роли применяется без ожидания истечения token. |
| P1-10 | Добавить backend transaction endpoint для bulk replace recommendations и перевести frontend с delete-all/create-all. | Partial failure не удаляет старые рекомендации; sequence numbers стабильны. |
| P1-11 | Добавить compensation при upload failure и определить migration strategy для bucket при смене serial. | Ошибка DB после upload удаляет MinIO object; PATCH serial сохраняет download/delete вложений. |
