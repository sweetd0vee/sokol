# Архитектура frontend

SPA для внутреннего аудита: CRUD, analytics, tools, settings.

## Структура `src/`

```
api/           # axios + domain clients + mappers
components/    # pages по разделам (checks, analytics, tools, …)
contexts/      # AuthContext, SokolDataProvider
constants/     # статусы, formLayout.ts
hooks/         # auth, reference options
utils/         # dates, exports, uploadLimits, attachments
config/env.ts  # API_BASE_URL
```

## Провайдеры и маршруты

```
QueryClient → AuthProvider → SokolDataProvider → Router
  /login          — публичный
  /*              — AuthGuard → AppLayout → разделы
```

| Route | Компонент |
|-------|-----------|
| `/checks`, `/recommendations` | list + form pages |
| `/analytics` | `AnalyticsTab` (4 вкладки) |
| `/planning` | `PlanningTab` |
| `/tools` | `ToolsTab` |
| `/settings` | `SettingsTab` (admin mutate) |
| `/profile` | localStorage avatar, change password через API |

## State

| Слой | Данные |
|------|--------|
| **AuthContext** | JWT, role, display name → `localStorage` |
| **SokolDataContext** | checks (500) + recommendations (1000) via React Query, `total` + truncation flags |
| **React Query** | settings, analytics cache |
| **Component state** | фильтры, пагинация, файлы форм |

Redux/Zustand нет.

## API-слой

| Модуль | Backend |
|--------|---------|
| `client.ts` | Axios + Bearer, 401 → logout |
| `checks.ts`, `recommendations.ts` | CRUD |
| `analytics.ts` | `/analytics/*` |
| `attachments.ts` | MinIO через API |
| `settings.ts` | `makeSettingsCrud` для справочников |
| `tools.ts` | section-ii, memorandum (120s) |
| `mappers.ts` | API ↔ frontend types |

## Ключевые модули

**Проверки** — фильтры на клиенте, `serial_number` с backend, импорт из АЗ, вложения.

**Tools** — `DocxToolPanel`: section-ii, memorandum (audit opinion — planned).

**Рекомендации** — closure, продления, снятие с контроля, вложения.

**Analytics** — server aggregates, static grid, visual export ([ANALYTICS.md](ANALYTICS.md)).

**Planning** — `GET /analytics/planning`, экспорт отключён ([PLANNING.md](PLANNING.md)).

**Settings** — `SingleFieldDictionaryPanel`, `SettingsTableCard`.

## Auth flow

Login → `POST /auth/login` → token в localStorage → Bearer на все запросы.

## Ограничения

- Таблицы: client-side filter после bulk-fetch; при `total` больше загруженной выборки показывается warning, server pagination пока нет.
- Канцлер — stub.
- HTML-экспорт дашбордов зависит от DOM-capture (хрупко при off-screen карточках).

Backend-контракты: [API.md](../../sokol-backend/docs/API.md).
