# Code Review — sokol-frontend

**Дата:** 2026-08-11  
**Метод:** статический разбор `src/`, сверка с backend API, ревью analytics export / planning.  
**Область:** routing, contexts, API, analytics, planning, forms, tools, attachments, auth.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура и структура | 7.5/10 |
| Читаемость | 7.5/10 |
| UX-консистентность | 8/10 |
| Надёжность / ошибки | 6/10 |
| Производительность (статика) | 6.5/10 |
| Тесты | 4/10 (Vitest есть, покрытие узкое) |
| Безопасность | 7/10 (JWT+RBAC; fake password) |
| Согласованность с backend | 8.5/10 |
| Документация | 8.5/10 (актуализация 11.08) |

**Итого ≈ 7.4/10.** Сильный UX и API-обвязка; серверная аналитика (все вкладки + planning) и визуальный экспорт зрелеют. Auth JWT+RBAC подключён; HTML/PNG capture по-прежнему хрупкий. План — [PLAN.md](../../PLAN.md).

---

## Сильные стороны

1. Понятное разделение `api` / `contexts` / `components` / `utils`.
2. TanStack Query + `SokolDataProvider` для CRUD.
3. Analytics/planning не упираются в list-limit 500 — ходят в `/analytics/*`.
4. Экспорт дашбордов: xlsx/pdf/docx/html; матрица эффективности собирается программно в HTML.
5. Settings DRY (`makeSettingsCrud`, `SingleFieldDictionaryPanel`).
6. Attachments через API, а не только память браузера.
7. JWT login + Bearer interceptor + AdminGuard.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Auth — декорация — закрыто (path B)

Login через `POST /api/v1/auth/login`, Bearer interceptor, роли `admin`/`auditor` в UI (Settings, DELETE). OIDC/Keycloak — следующий шаг.

#### H2. HTML-экспорт зависит от DOM-capture

`captureDashboardCharts` требует зарегистрированные видимые карточки; Recharts SVG с общими `id` ломали мульти-график в HTML (смягчено PNG + namespace).  
**Риск:** «Не удалось снять дашборды» / пустые секции при off-screen/empty cards.  
**Рекомендация:** для ключевых секций — data-driven HTML (как матрица), меньше полагаться на screenshot.

#### H3. Fake смена пароля

`ProfilePage` показывает success без API.

### Medium

#### M1. Analytics грузит полный срез на сервере

Клиентские вкладки больше не ограничены SokolData; узкое место сместилось на backend RAM/latency при росте портфеля.

#### M2. Статическая сетка + scrollIntoView при экспорте

Долгий экспорт всех секций; возможны пропуски невидимых/пустых карточек.

#### M3. Planning export отключён

UI создаёт ложное ожидание кнопок экспорта.

#### M4. Client-side table filters after bulk fetch

Не масштабируется; нет server pagination в UI.

#### M5. Узкое покрытие Vitest

Нет тестов export registry / analytics API client / attachments errors.

### Low

#### L1. Канцлер-stub в навигации.
#### L2. Демо-наблюдения могут путать пользователей («как будто данные из БД»).
#### L3. Legacy tabular exporters в `analyticsExport.ts` помечены `void` — технический долг на удаление.

---

## FE ↔ BE стык

| Тема | Статус |
|------|--------|
| CRUD | OK |
| `/analytics/*` (+ planning) | OK |
| Attachments | OK при MinIO |
| Auth | JWT + RBAC (admin/auditor) |

---

## Рекомендуемый порядок

1. OIDC/Keycloak поверх текущего JWT (если выдадут IdP); убрать fake password.  
2. Стабилизировать HTML-экспорт (data-driven блоки, меньше PNG-зависимостей где возможно).  
3. CI: lint + build + test; SQL-оптимизация analytics на BE при росте данных.  
4. Включить planning export или скрыть контролы.

Backend review: [sokol-backend/docs/CODE_REVIEW.md](../../sokol-backend/docs/CODE_REVIEW.md).
