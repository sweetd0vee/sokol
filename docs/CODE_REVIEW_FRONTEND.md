# Код-ревью frontend

**Дата:** 4 сентября 2026  
**Оценка:** 8.6 / 10 · React 19, TypeScript, Vite, TanStack Query

Сценарии аудитора закрыты: импорт из АЗ с undo, RBAC на delete/вложения, yearly №, конструктор дашбордов. Архитектура: [sokol-frontend/docs/ARCHITECTURE.md](../sokol-frontend/docs/ARCHITECTURE.md).

## Архитектура

```
App → AppProviders → AppRoutes
QueryClient → AuthProvider → SokolDataProvider → AnalyticsConstructorProvider → BrowserRouter
```

Отдельного `AdminGuard` нет: `useAuth().isAdmin` (`admin` \| `department_head`). Маршрута `/kantsler` нет.

**Плюсы:** feature folders, mappers, React Query, `formLayout`, `tableExport/` по форматам.

**Минусы:** нет route lazy loading; планирование без метки limited.

## Блоки

## Блоки

| Блок | Оценка | Ограничение |
|------|--------|-------------|
| Shell / routing | **9** | Нет lazy loading |
| Auth | **8** | Нет OIDC |
| Checks | **9** | Списки &gt;10000 |
| Recommendations | **9** | Списки &gt;10000 |
| Data layer | **7.8** | Bulk-fetch 10000 |
| Attachments | **10** | Banner, disabled upload и retry по `/attachments/storage/status` |
| Analytics | **8.5** | Нет drill-down API |
| Planning | **8** | Дашборд + visual export + конструктор; нет метки limited |
| Constructor | **8.5** | Только localStorage, без backend |
| Tools | **8** | Нет прогресса длинного job |
| Exports | **7.5** | Таблицы data-driven; дашборды — DOM capture |
| Tests | **9** | **160** Vitest; Playwright: 5 auth + constructor. CRUD e2e нет; Playwright не в CI |

## State

`SokolDataContext` грузит checks/recommendations с `limit=10000`. Конструктор: `sokol.constructor.library.v1` в localStorage.

`serial_number` только с API. Профиль: `changePasswordRequest`, аватар локально.

## Открытые findings

### P0-03 · Виды проверок — **сделано**

`CheckFormPage` и `ChecksTab` читают `/settings/check_kinds` через `useCheckKindOptions`.

### FE-07 · P2 · Visual export

Табличный экспорт вынесен в `utils/tableExport/`. `exports.ts` — обёртка. Analytics/planning/constructor visual export всё ещё DOM capture (`html-to-image`).

### FE-10 · P2 · Eager routes

`AppRoutes` импортирует все tabs/forms статически.

Задачи: [ACTION_PLAN.md](ACTION_PLAN.md)
