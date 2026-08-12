# SOKOL — код-ревью

**Дата:** 12 августа 2026  
**Объект:** `sokol-backend`, `sokol-frontend`, legacy `sokol-instruments`

## Как читать оценки

Оценка дана по блокам, а не «проекту целиком»: **8–10** — блок хорошо реализован и пригоден для пилота; **6–7** — работает, но есть заметные эксплуатационные риски; **≤5** — блок нельзя считать готовым без доработки.

## Сводка по блокам

| Блок | Оценка | Насколько хорошо реализовано | Главный риск |
|------|--------|------------------------------|--------------|
| Backend API / CRUD | **8 / 10** | Проверки, рекомендации, справочники и вложения имеют понятные REST-контракты, validation и RBAC | Нет integration tests на живой Postgres |
| Ключ проверки | **9 / 10** | Генерация и пересчёт перенесены на backend; frontend больше не отправляет `serial_number` | Нужен regression test на каскад при массовых данных |
| Analytics / planning API | **7.5 / 10** | Сервер считает агрегаты единообразно, UI получает готовые camelCase-модели | При росте данных нужны SQL aggregates/cache |
| DOCX tools | **8 / 10** | Раздел II, ссылки, ДЗ и parse recommendations покрыты тестами и отделены в services | Upload/job модель пока синхронная и in-memory |
| Attachments / MinIO | **7 / 10** | Есть API, metadata в PG и MinIO storage abstraction | Нужны policy, backup и cleanup orphan objects |
| Auth / RBAC | **6.5 / 10** | Internal JWT и роли уже закрывают API от анонимного доступа | Нет OIDC, user lookup/is_active и audit log |
| БД / миграции / import | **5.5 / 10** | PostgreSQL-схема рабочая, seed/import существуют | Нет Alembic baseline; ad-hoc миграции рискованны для prod |
| Frontend формы и доменный UX | **7.5 / 10** | Основные workflows аудитора собраны и связаны с API | Есть demo/stub UI, крупные компоненты |
| Frontend data layer | **7 / 10** | API clients, mappers, React Query и контексты дают понятный поток данных | Bulk-fetch без явного warning при truncation |
| Frontend analytics/export | **7.5 / 10** | Дашборды и экспорты ценны для пользователя | DOM capture/export хрупкие, planning export выключен |
| Тесты / CI | **6 / 10** | Backend unittest и frontend Vitest уже ловят часть регрессий | Нет обязательного CI, e2e и DB integration |
| Документация / runbook | **7 / 10** | Основные README/docs покрывают запуск, API, storage, go-live | Часть roadmap/env docs ещё надо синхронизировать с кодом |

**Вердикт:** ограниченный пилот возможен на контролируемом объёме данных. Для промышленного контура сначала закрыть Alembic, CI, prod auth guards, скрытие demo UI и эксплуатацию MinIO.

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
| C4 | Demo import на prod (`SOKOL_LOAD_DEMO_DATA`) | открыт |
| C5 | Нет обязательного CI gate | открыт |

## Закрыто недавно

- **Ключ проверки** — backend-only: create игнорирует клиентский serial; PATCH пересчитывает при смене даты/руководителя/типа.
- **Frontend** — не генерирует ключ; показывает значение из API.
- **API docs** — `audit-opinion` убран из `sokol-backend/docs/API.md`; endpoint не заявляется как часть текущего API.

## Топ рекомендаций

1. Alembic baseline (P0)
2. Скрыть Kantsler / fake password (P0)
3. CI: unittest + lint/test/build (P1)
4. JWT lookup user + `is_active` (P1)
5. «Показано N из total» в таблицах (P1)
6. MinIO policy + backup/restore runbook (P1)

Детали: [ACTION_PLAN.md](ACTION_PLAN.md) · [PLAN.md](../PLAN.md)

## Отчёты

- [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md)
- [CODE_REVIEW_FRONTEND.md](CODE_REVIEW_FRONTEND.md)
