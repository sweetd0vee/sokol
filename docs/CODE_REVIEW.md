# SOKOL — код-ревью

**Дата:** 12 августа 2026  
**Объект:** `sokol-backend`, `sokol-frontend`, legacy `sokol-instruments`

## Сводка

| Область | Оценка | Комментарий |
|---------|--------|-------------|
| Backend | **7.3 / 10** | Зрелый CRUD, analytics, DOCX; слабое место — миграции БД |
| Frontend | **7.4 / 10** | Сильный UX домена; лимиты bulk-fetch, demo-разделы |
| FE↔BE | **9 / 10** | Контракты согласованы; ключ проверки на backend |
| Go-live ~01.09 | **~65%** | Блокеры: Alembic, данные, скрытие заглушек, MinIO policy |

**Вердикт:** пилот на ограниченном объёме возможен. Для prod — Alembic, prod guards, скрыть demo UI, auth hardening.

## Сильные стороны

- HTTP → CRUD → PostgreSQL / API clients → React Query → UI.
- Server analytics, DOCX Раздел II (104 unit-теста на Python 3.12).
- JWT + RBAC; `serial_number` генерируется и пересчитывается на backend (create + PATCH, каскад на recommendations/attachments).
- Экспорт таблиц и дашбордов на frontend.

## Тесты (12.08.2026)

| Пакет | Результат |
|-------|-----------|
| Backend `py -3.12 -m unittest discover -s tests` | **104 теста, OK** (1 skipped) |
| Frontend `npm run lint` | **0 errors, 27 warnings** |
| Frontend `npm test` | **32 теста, 5 файлов, OK** |

> Backend требует **Python 3.12** (union types в моделях).

## Критические риски

| ID | Риск | Статус |
|----|------|--------|
| C1 | Нет Alembic — ad-hoc `migrate_*.py` | открыт |
| C2 | JWT: роль из payload, без lookup в БД | открыт |
| C3 | Demo UI (Kantsler, fake password) | открыт |
| C4 | Docs/API описывают audit-opinion, **кода нет** | открыт |
| C5 | Demo import на prod (`SOKOL_LOAD_DEMO_DATA`) | открыт |

## Закрыто недавно

- **Ключ проверки** — backend-only: create игнорирует клиентский serial; PATCH пересчитывает при смене даты/руководителя/типа.
- **Frontend** — не генерирует ключ; показывает значение из API.

## Топ рекомендаций

1. Alembic baseline (P0)
2. Скрыть Kantsler / fake password (P0)
3. Убрать audit-opinion из docs или реализовать endpoint (P0/P1)
4. JWT lookup user + `is_active` (P1)
5. «Показано N из total» в таблицах (P1)
6. CI: unittest + lint/test/build (P1)

Детали: [ACTION_PLAN.md](ACTION_PLAN.md) · [PLAN.md](../PLAN.md)

## Отчёты

- [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md)
- [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md)
