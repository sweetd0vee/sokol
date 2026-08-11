# Code Review — sokol-frontend

**Дата:** 2026-08-11  
**Метод:** статический разбор `src/`, сверка с backend API, ревью analytics export / planning.  
**Область:** routing, contexts, API, analytics, planning, forms, tools, attachments.

## Итоговая оценка

| Критерий | Балл |
|----------|------|
| Архитектура и структура | 7.5/10 |
| Читаемость | 7.5/10 |
| UX-консистентность | 8/10 |
| Надёжность / ошибки | 6/10 |
| Производительность (статика) | 6.5/10 |
| Тесты | 4/10 (Vitest есть, покрытие узкое) |
| Безопасность | 3/10 |
| Согласованность с backend | 8/10 |
| Документация | 8.5/10 (после актуализации 11.08) |

**Итого ≈ 7.0/10.** Сильный UX и API-обвязка; гибридная аналитика (checks API) и визуальный экспорт зрелеют. Критичны stub-auth и хрупкость HTML/PNG capture. План — [PLAN.md](../../PLAN.md).

---

## Сильные стороны

1. Понятное разделение `api` / `contexts` / `components` / `utils`.
2. TanStack Query + `SokolDataProvider` для CRUD.
3. Вкладка «Проверки» не упирается в list-limit 500 — ходит в `/analytics/checks`.
4. Экспорт дашбордов: xlsx/pdf/docx/html; матрица эффективности собирается программно в HTML.
5. Settings DRY (`makeSettingsCrud`, `SingleFieldDictionaryPanel`).
6. Attachments через API, а не только память браузера.
7. Планирование — реальные дашборды охвата.

---

## Замечания (по приоритету)

### Critical / High

#### H1. Auth — декорация

Любые non-empty credentials; нет JWT. **Риск:** полный доступ к открытому API.

#### H2. HTML-экспорт зависит от DOM-capture

`captureDashboardCharts` требует зарегистрированные видимые карточки; Recharts SVG с общими `id` ломали мульти-график в HTML (смягчено PNG + namespace).  
**Риск:** «Не удалось снять дашборды» / пустые секции при off-screen/empty cards.  
**Рекомендация:** для ключевых секций — data-driven HTML (как матрица), меньше полагаться на screenshot.

#### H3. Fake смена пароля

`ProfilePage` показывает success без API.

### Medium

#### M1. Остальные analytics-вкладки ограничены SokolData (500/1000)

Искажение KPI при больших портфелях. Нужен server analytics по образцу checks.

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
| `/analytics/checks` | OK |
| Other analytics tabs | client-only |
| Attachments | OK при MinIO |
| Auth | stub |

---

## Рекомендуемый порядок

1. Auth UI + interceptor (вместе с backend OIDC).  
2. Стабилизировать HTML-экспорт (data-driven блоки, меньше PNG-зависимостей где возможно).  
3. Server analytics для recs/monitoring/DVA.  
4. CI: lint + build + test.  
5. Включить planning export или скрыть контролы.

Backend review: [sokol-backend/docs/CODE_REVIEW.md](../../sokol-backend/docs/CODE_REVIEW.md).
