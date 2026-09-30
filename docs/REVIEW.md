# Готовность к продакшену

Снимок на **30.09.2026**. Правила автостатуса — [RECOMMENDATION_INDICATORS.md](RECOMMENDATION_INDICATORS.md). Слои — [ARCHITECTURE.md](ARCHITECTURE.md).

Внутренний инструмент одного департамента: любой вошедший читает все строки. Для пилота за VPN это допустимо. Для нескольких независимых заказчиков — нет.

**Продукт: 7.7 / 10.** Пилот за VPN — да, после чеклиста. Открытый контур — нет.

| | Backend | Frontend |
|--|--------:|---------:|
| Архитектура | 9 | 10 |
| Безопасность | 5.5 | 5.5 |
| Данные / состояние | 5 | 6.5 |
| Бизнес-логика и аналитика | 10 | 10 |
| Тесты | 10 | 10 |
| Наблюдаемость и devops | 8.5 | 8 |

## Уже в порядке

Слои держатся: endpoint → service → CRUD, CRUD не коммитит (`tests/test_crud_layer_boundary.py`). UI режется по ролям: `AuthGuard`, `/settings` за `AdminGuard`. Роль читается из БД. Запись проходит `ensure_user_can_manage_*`. В prod старт падает на слабом JWT, demo-load и seed replace.

Ошибки домена — `{detail}` без traceback. Логи с request-id, в prod JSON. `/metrics` — Prometheus. Healthcheck у compose, UI шлёт `X-Request-ID`. Сервис `backup` в 00:05 Europe/Moscow пишет Postgres dump и зеркало MinIO в `~/docker-share/sokol-backups` (14 дней). Автостатус, KPI переносов, парсер Раздела II, фильтры аналитики и черновики конструктора закрыты тестами. Золотой набор — [fixtures/auto_status_golden.json](fixtures/auto_status_golden.json).

## Что блокирует прод

1. **Чтение не режется по владельцу.** Списки, карточки и дашборды видны любому вошедшему.
2. **Нет Alembic.** Схема — `create_all` и идемпотентные патчи. Часть патчей не входит в bootstrap, два стенда могут разъехаться.
3. **Секреты по умолчанию.** Пустой CORS → `*`. Docker включает demo, пока env не переопределён. Seed-пароли `admin` / `auditor`. Legacy-пароли без PBKDF2 принимаются как текст. Новый пароль — от 4 символов. JWT живёт 480 минут. Лимита на login нет. `/docs` открыт всегда.
4. **Сессия в `localStorage`.** XSS забирает access token. HttpOnly cookie нет.
5. **Нагрузка.** Фронт тянет до 10 000 проверок и рекомендаций. Ночной пересчёт грузит обе таблицы в память. Посещённые вкладки аналитики остаются смонтированными.

## Чеклист

- [ ] `SOKOL_ENV=prod`, свой `SOKOL_JWT_SECRET`, явный `SOKOL_CORS_ORIGINS`.
- [ ] `SOKOL_LOAD_DEMO_DATA=0`, `SOKOL_SEED_REPLACE` выключен, свои пароли seed.
- [ ] В БД только PBKDF2-хеши.
- [x] Postgres и MinIO не публикуются на хост (только сеть `sokol`); `/docs` закрыть сетью/VPN, если Swagger снаружи не нужен.
- [x] Снимки Postgres и MinIO в 00:05 Europe/Moscow, хранение 14 дней (`~/docker-share/sokol-backups`). Один раз прогнать restore на копии стенда — [DATA.md](DATA.md).
- [ ] Решение по чтению зафиксировано: «все свои» или отдельный ACL.
- [ ] В GitHub для default branch включены required checks (см. ниже). Сам workflow их не включает.

## CI

Workflow: `.github/workflows/ci.yml`.

| Job | Что гоняет |
|-----|------------|
| `Backend (Python 3.12)` | `compileall`, `unittest`, Postgres 16, `SOKOL_RUN_DB_INTEGRATION_TESTS=1` |
| `Frontend (Node 22)` | `lint`, Vitest, `build`, Playwright (auth и конструктор, API замокан) |

Живой backend в e2e не поднимается. Чтобы красный CI блокировал merge: ruleset или branch protection, required checks `Backend (Python 3.12)` и `Frontend (Node 22)`, ветка должна быть up to date. URL: `https://github.com/sweetd0vee/sokol/settings/rules`.

## Не трогать без золотых тестов

`recommendation_status.py`, `check_status.py`, `recommendationAutoStatus.ts`, SQL-агрегаты и русские литералы аналитики, `person_match`, ключи проверок и каскад кода аудитора, парсер и XML Раздела II, section id экспорта и черновики конструктора.

## Ещё открыто

Import без `--dry-run`: неизвестные labels досоздаются, а не отклоняются. На `/planning` нет метки limited. Дальше, не блокер пилота: server pagination, OIDC, audit log, users PATCH/DELETE, серверные дашборды.

Календарь спринта 04.09.2026 — [PLAN.md](../PLAN.md). Это исторический снимок, не текущий статус.
