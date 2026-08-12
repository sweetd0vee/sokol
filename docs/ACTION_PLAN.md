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
| P0-01 | Скрыть Kantsler; disable fake password в Profile | 0.5 d |
| P0-02 | Prod: `SOKOL_ENV=prod` + strong `SOKOL_JWT_SECRET`, fail-fast на default | **done** |
| P0-03 | `SOKOL_LOAD_DEMO_DATA=0` на UAT/prod | 0.5 d |
| P0-04 | Alembic baseline + `upgrade head` | 3–5 d |
| P0-05 | Audit-opinion: убрать из `docs/API` | **done** |

## P1 — до пилота

| ID | Задача | Effort |
|----|--------|--------|
| P1-01 | JWT: lookup user в БД + `is_active` | 1 d |
| P1-02 | CI: BE unittest (py 3.12) + FE lint/test/build | 1–2 d |
| P1-03 | ~~Server serial_number~~ — **выполнено** | — |
| P1-04 | Таблицы: «Показано X из Y» | 1 d |
| P1-05 | MinIO policy + UI banner при недоступном storage | 1–2 d |
| P1-06 | Import dry-run + reject report | 2 d |
| P1-07 | Delete recommendation → cleanup MinIO | 0.5 d |
| P1-08 | Runbook backup/restore Postgres + MinIO | 2 d |

## P2 — после go-live / параллельно

Server pagination · golden DOCX CI · planning export · split exports.ts · integration tests · analytics SQL aggregates.

## Gates

| Gate | Дата | Критерий |
|------|------|----------|
| G-A | 14.08 | P0-01..03; Alembic started |
| G-B | 20.08 | Auth UAT; CI green |
| G-C | 27.08 | MinIO decision; DOCX smoke; no P0 |
| G-D | 01.09 | PLAN G1–G12 signed |

## Метрики

| Метрика | Сейчас | Target 01.09 |
|---------|--------|--------------|
| BE tests (py 3.12) | 104 | ≥110 + integration |
| FE tests | 32 | ≥45 |
| ESLint warnings | 27 | ≤10 |
| Open P0 | 4 | 0 |
| Demo routes visible | 2 | 0 |

## Эта неделя (12–15.08)

1. P0-01 — скрыть demo UI  
2. P0-02, P0-03 — prod guards  
3. P0-04 — старт Alembic  
4. P1-02 — CI  
5. P1-05 — MinIO policy / storage UX  
