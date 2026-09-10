# Архитектура frontend

SPA для внутреннего аудита: CRUD, analytics, planning, tools, settings, constructor.

## Структура `src/`

```
api/           # axios + domain clients + mappers + queryKeys
components/    # analytics, attachments, auth, checks, forms, lists, layout,
               # planning, profile, recommendations, settings, tabs, tools, ui
contexts/      # AuthContext, SokolDataProvider
constants/     # статусы, formLayout.ts, paths, storage, avatars
hooks/         # auth, lists, forms, analytics filters, attachments, export, storage status
utils/         # dates, personMatch, exports, tableExport, analytics*, dvaAnalytics
config/env.ts  # API_BASE_URL
assets/
types/
```

Точка входа: `main.tsx` → `App` → `AppProviders` + `AppRoutes`.

## Провайдеры и маршруты

```
QueryClient → AuthProvider → SokolDataProvider → AnalyticsConstructorProvider → BrowserRouter
  /login          — публичный (AuthLayout)
  /*              — AuthGuard → AppLayout → разделы
```

Отдельного `AdminGuard` нет: права проверяются через `useAuth().isAdmin` в страницах.

| Route | Компонент |
|-------|-----------|
| `/checks`, `/recommendations` | списки + form pages (`/new`, `/:id/edit`) |
| `/analytics` | `AnalyticsTab` (4 вкладки, keep-alive посещённых панелей) |
| `/planning` | `PlanningTab` → `PlanningAnalyticsDashboard` |
| `/constructor`, `/constructor/:id` | история дашбордов и холст ([CONSTRUCTOR.md](CONSTRUCTOR.md)) |
| `/tools` | `ToolsTab` (АЗ / ДЗ) |
| `/settings` | `SettingsTab` (mutate — `isAdmin`) |
| `/profile` | аватар (localStorage), смена пароля; admin — `AdminUsersSection` |

Неизвестный путь → `/checks`. Маршрута `/kantsler` нет.

## State

| Слой | Данные |
|------|--------|
| **AuthContext** | JWT, role, display name → `localStorage` (`sokol_auth`) |
| **SokolDataContext** | checks + recommendations до 10000 строк через React Query |
| **React Query** | settings, analytics (bootstrap + filtered), users, capabilities, attachments, storage status |
| **Component state** | фильтры, пагинация списков (по 50), файлы форм, экспорт |
| **Constructor library** | именованные дашборды + виджеты в `localStorage` (`sokol.constructor.library.v1`) |

Redux/Zustand нет.

## API-слой

| Модуль | Backend |
|--------|---------|
| `client.ts` | Axios + Bearer; 401 → `sokol:auth-unauthorized` → logout |
| `auth.ts` | login, change-password |
| `users.ts` | `GET/POST /users` (admin) |
| `checks.ts`, `recommendations.ts` | CRUD, batch append/replace, batch-delete, parse-recommendations |
| `analytics.ts` | `/analytics/checks\|recommendations\|monitoring\|dva\|planning` |
| `attachments.ts` | MinIO через API; `GET /attachments/storage/status` |
| `settings.ts` | `makeSettingsCrud` для справочников |
| `tools.ts` | section-ii, section-ii-links, memorandum, control-file (timeout 600s, очередь на backend) |
| `capabilities.ts` | лимит upload |
| `mappers.ts` | API ↔ frontend types |

## Ключевые модули

**Списки** — client-side filter/sort/pagination после bulk-fetch; «Мои»; экспорт таблиц и (для проверок) вложений.

**Проверки** — `serial_number` и yearly № с backend; виды из `/settings/check_kinds`; импорт рекомендаций из АЗ; вложения по слотам; DELETE только `isAdmin`. Недоступный MinIO: banner и disabled upload (`useStorageStatus`).

**Рекомендации** — closure, продления, снятие с контроля, вложения; DELETE — владелец или `isAdmin`.

**Tools** — `DocxToolPanel`: АЗ (Раздел II, с гиперссылками, файл контроля + шаблон xlsx) и ДЗ (приложение 2).

**Analytics** — server aggregates, static `react-grid-layout`, keep-alive вкладок, visual export ([ANALYTICS.md](ANALYTICS.md)). Карточки: чекбокс «В конструктор», PNG в буфер обмена, fullscreen; часть матриц/lifecycle — `expandToContent`.

**Planning** — `GET /analytics/planning`, visual export **включён**; графики можно отправить в конструктор ([PLANNING.md](PLANNING.md)).

**Constructor** — история дашбордов и холст из снимков аналитики/планирования ([CONSTRUCTOR.md](CONSTRUCTOR.md)).

**Settings** — аудиторы, департаменты, виды проверок, виды аудита, оценки эффективности.

**Профиль** — пресеты аватаров, `POST /auth/change-password`; admin создаёт пользователей с ролью `auditor`.

## Auth flow

Login (ФИО или alias `admin`) → `POST /auth/login` → token в localStorage → Bearer на все запросы.

`isAdmin` = роль `admin` или `department_head`.

## Ограничения

- Виды проверок в форме и фильтрах — из `/settings/check_kinds`.
- Таблицы: client-side filter после bulk-fetch до 10000 строк; server pagination нет.
- HTML-экспорт дашбордов зависит от DOM-capture (хрупко при off-screen карточках); lifecycle в DOCX дополнительно отдаёт табличные строки.
- Drill-down API и сохранённые серверные отчёты не реализованы.

Backend-контракты: [API.md](API.md).
