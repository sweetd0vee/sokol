# План действий после код-ревью

**Синхронизация:** [PLAN.md](../PLAN.md) (go-live **15.09.2026**, перенос на спринт с 01.09)  
**Источник:** [CODE_REVIEW.md](CODE_REVIEW.md) (снимок 19.08.2026)

| Уровень | Окно | Критерий |
|---------|------|----------|
| P0 | до 08.09 | Блокер go-live, ИБ, ложный UI |
| P1 | до 12.09 | Стабильность пилота |
| P2 | после 15.09 | Качество, масштаб |
| P3 | после 15.09 | Backlog |

## P0 — осталось до 08.09

| ID | Задача | Effort | Статус |
|----|--------|--------|--------|
| P0-01 | Скрыть Kantsler из production nav/route | 0.5 d | закрыт |
| P0-02 | Пометить Планирование как limited/beta | 0.5 d | открыт |
| P0-03 | `check_kinds` в форме и фильтрах проверок | 1 d | открыт |
| P0-04 | Demo-load: prod запрещает; compose default `1` для local — UAT обязан `SOKOL_ENV=prod` + `SOKOL_LOAD_DEMO_DATA=0` | 0.5 d | частично |
| P0-05 | Prod guards demo/replace | 0.5 d | закрыт |
| P0-06 | Alembic baseline + `upgrade head` | 3–5 d | открыт |
| P0-07 | Import dry-run + reject report | 2 d | открыт |
| P0-08 | HTTP Basic выключен в prod | — | закрыт |
| P0-09 | Prod-safe `sync_dictionaries` | — | закрыт |

## P1 — до 12.09

| ID | Задача | Effort | Статус |
|----|--------|--------|--------|
| P1-01 | CI workflow есть; включить required checks по [CI.md](CI.md) | 0.5 d | открыт (GitHub settings) |
| P1-02 | Import validation: reject неизвестных справочников, не `ensure_*` | 2 d | открыт |
| P1-03 | Frontend `useStorageStatus` + banner при недоступном MinIO | 1–2 d | открыт |
| P1-04 | Backup/restore drill Postgres + MinIO (документы уже есть) | 1 d | открыт (drill) |
| P1-05–P1-10 | UAT checklist, пилот/полная загрузка, DOCX smoke, smoke script, runbook | см. PLAN.md | открыт |

## P2 — после go-live / параллельно

Server pagination · golden DOCX CI · planning export · split visual-export · route lazy loading · analytics cache.

## Gates

| Gate | Дата | Критерий |
|------|------|----------|
| G-A | 08.09 | P0-02, P0-03, P0-06, P0-07; UAT без demo |
| G-B | 10.09 | Auth UAT; CI required; пилот 10–20 проверок |
| G-C | 13.09 | MinIO decision; DOCX smoke; no open P0 |
| G-D | 15.09 | PLAN Go/No-Go 14.09 signed |

## Метрики

| Метрика | Сейчас (19.08 review) | Target 15.09 |
|---------|----------------------|--------------|
| BE tests (py 3.12) | 172 | ≥140 + integration |
| FE tests | 54 | ≥55 |
| ESLint warnings | 0 | 0 |
| Open P0 | 4 (02, 03, 06, 07) + хвост P0-04 | 0 |
| Demo routes visible | 0 (Kantsler снят) | 0 |

## Эта неделя (01.09–05.09)

1. P0-02 — метка limited на Планировании  
2. P0-03 — `check_kinds` в форме и фильтрах  
3. P0-04 — UAT/prod без demo default  
4. P0-06 — старт Alembic  
5. P0-07 — import dry-run  

## Детализация оставшихся код-задач

| ID | Что сделать в коде | Definition of Done |
|----|--------------------|--------------------|
| P0-02 | На `/planning` явная метка limited/beta; не обещать экспорт | Пользователь видит, что модуль ограниченный |
| P0-03 | Форма и фильтры проверок читают `/settings/check_kinds` вместо `CHECK_VIEW_OPTIONS` | Новый вид из Settings доступен без релиза frontend |
| P0-04 | UAT/prod: `SOKOL_ENV=prod`, `SOKOL_LOAD_DEMO_DATA=0`; по возможности compose default `0` | Пустой UAT не загружает demo сам |
| P0-06 | Alembic baseline, prod `upgrade head` вместо `create_all` | Пустая test DB поднимается миграциями; повторный upgrade no-op; runbook обновлён |
| P0-07 | `--dry-run --report` у `import_seed_data` | БД не меняется; csv с ok/reject |
| P1-03 | `useStorageStatus` + banner/disabled upload | Upload disabled при `reachable=false`; retry обновляет статус |
| P1-01 | Required checks в GitHub branch protection | Merge заблокирован при красном CI |
