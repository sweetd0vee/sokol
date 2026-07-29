# Архитектура frontend

## Назначение

Одностраничное приложение внутреннего аудита: CRUD проверок/рекомендаций, справочники, клиентский экспорт таблиц, вызов backend DOCX-tools, заготовка аналитики и профиля.

## Структура `src/`

```
src/
├── main.tsx                 # StrictMode + App
├── App.tsx                  # QueryClient + Auth + SokolData + Router
├── api/                     # axios client, domain API, mappers, errors
├── components/
│   ├── auth/                # LoginPage, AuthGuard
│   ├── layout/              # AppLayout, AuthLayout, Sidebar
│   ├── checks/              # CheckFormPage, attachments, recommendations block
│   ├── recommendations/     # Form, closure, selects
│   ├── attachments/         # FileAttachmentsPanel
│   ├── tools/               # DocxToolPanel
│   ├── settings/            # table card, actions, helpers
│   ├── profile/             # ProfilePage
│   ├── tabs/                # Checks, Recommendations, Analytics, Tools, Settings, Kantsler
│   └── ui/                  # Button, Input, Select, Modal, DatePicker, …
├── contexts/                # Auth, SokolData
├── hooks/                   # useAuth, reference options, current user name
├── types/                   # Check, Recommendation
├── constants/               # enums/labels, form layout, storage keys
├── utils/                   # dates, export, checkKey, attachments, navigation
└── config/env.ts            # API_BASE_URL
```

## Дерево провайдеров и маршрутов

```mermaid
flowchart TB
  QC[QueryClientProvider]
  AP[AuthProvider]
  SD[SokolDataProvider]
  BR[BrowserRouter]
  AC[AppContent Routes]

  QC --> AP --> SD --> BR --> AC

  AC --> Login["/login AuthLayout"]
  AC --> Guard[AuthGuard]
  Guard --> Layout[AppLayout]
  Layout --> Pages["checks | recommendations | analytics | tools | kantsler | settings | profile"]
```

| Route | Компонент | Доступ |
|-------|-----------|--------|
| `/login` | `LoginPage` | публичный |
| `/` | redirect → `/checks` | AuthGuard |
| `/checks`, `/checks/new`, `/checks/:id/edit` | list / form | protected |
| `/recommendations`, `.../new`, `.../:id/edit` | list / form | protected |
| `/analytics` | `AnalyticsTab` | protected |
| `/tools` | `ToolsTab` | protected |
| `/kantsler` | stub | protected |
| `/settings` | `SettingsTab` | protected |
| `/profile` | `ProfilePage` | protected |
| `*` | → `/checks` | protected |

## Управление состоянием

```mermaid
flowchart LR
  subgraph Client
    LS[(localStorage)]
    AuthCtx[AuthContext]
    SokolCtx[SokolDataContext]
    RQ[TanStack Query]
    Local[useState в страницах]
  end

  subgraph Server
    API["/api/v1"]
  end

  LS --> AuthCtx
  RQ --> API
  SokolCtx --> RQ
  SettingsTab --> RQ
  AnalyticsTab --> RQ
  ToolsTab --> API
  Local --> Filters[фильтры / формы / файлы]
```

| Слой | Что хранит |
|------|------------|
| **AuthContext** | `user`, login/logout; hydrate из `sokol_auth` |
| **SokolDataContext** | checks (limit 500) + recommendations (limit 1000) через RQ; CRUD helpers; связи recommendation↔check |
| **React Query** | кэш списков, settings, analytics |
| **localStorage** | auth, профиль ФИО, avatar data URL |
| **location.state** | черновики форм проверки/рекомендации при кросс-навигации |
| **Component state** | фильтры, пагинация, модалки, `File` вложений |

**Redux/Zustand нет.**

## API-слой

| Файл | Backend |
|------|---------|
| `api/client.ts` | Axios, `baseURL = API_BASE_URL`, `toApiError` |
| `api/checks.ts` | CRUD `/checks` |
| `api/recommendations.ts` | CRUD + `parse-recommendations` |
| `api/settings.ts` | auditors / audit_types / effectiveness_ratings |
| `api/tools.ts` | section-ii, section-ii-links, memorandum → blob, timeout 120s |
| `api/analytics.ts` | `GET /analytics/by-person` — **на backend endpoint отсутствует** |
| `api/mappers.ts` | API ↔ frontend types (id string, нормализация статусов) |
| `api/errors.ts` | `ApiError`, FastAPI 422, blob errors |

Типовой поток:

```
UI → useSokolData / useQuery → api/*.ts → axios → mappers → invalidate query keys
```

## Иерархия UI-компонентов

```mermaid
flowchart TB
  App --> AppLayout
  AppLayout --> Sidebar
  AppLayout --> Header[avatar + logout]
  AppLayout --> Outlet

  Outlet --> ChecksTab
  Outlet --> CheckFormPage
  CheckFormPage --> CheckAttachmentsSection
  CheckFormPage --> CheckRecommendationsBlock

  Outlet --> RecommendationsTab
  Outlet --> RecommendationFormPage
  RecommendationFormPage --> IndicatorSelect
  RecommendationFormPage --> MaterialitySelect
  RecommendationFormPage --> RecommendationClosureSection
  RecommendationFormPage --> FileAttachmentsPanel

  Outlet --> AnalyticsTab
  Outlet --> ToolsTab
  ToolsTab --> DocxToolPanel
  Outlet --> SettingsTab
  SettingsTab --> SettingsTableCard
  Outlet --> ProfilePage
  Outlet --> KantslerTab
```

### UI kit (`components/ui`)

`Button`, `Input`, `Select`, `Textarea`, `DatePicker`, `Modal` / `ConfirmDialog`, `PageHeader`, `SegmentedControl`, `StateMessage` (Loading/Error/Empty).

Дизайн: Tailwind + палитра `sber` (navy `#003366`, accent `#6699FF`). Таблицы с тёмным header. Формы — CSS grid helpers `.form-row-3` / `.form-row-4`.

## Ключевые модули домена

### Проверки

- `ChecksTab` — клиентские filter/sort/paginate, «Мои» по ФИО профиля, экспорт.
- `CheckFormPage` — авто `serial_number` (`utils/checkKey`), статус от дат, метаданные документов, импорт рекомендаций из АЗ.
- Вложения (`CheckAttachmentsSection`) — **только в памяти браузера**, на API не уходят.

### Рекомендации

- Полный жизненный цикл + блок закрытия (`RecommendationClosureSection`).
- Статусы/метки в `constants/recommendations.ts`, mappers синхронизируют с backend enum’ами.

### Инструменты

`ToolsTab` → `DocxToolPanel` → `api/tools.ts`:

| UI-действие | Endpoint |
|-------------|----------|
| Раздел II | `POST /tools/section-ii` |
| Раздел II + ссылки | `POST /tools/section-ii-links` |
| Докладная | `POST /tools/memorandum` |

### Экспорт таблиц (клиент)

`utils/exports.ts`: XLSX (Times New Roman 12), DOCX, PDF — без участия backend.

### Auth

```mermaid
sequenceDiagram
  participant U as User
  participant LP as LoginPage
  participant AC as AuthProvider
  participant LS as localStorage
  participant AG as AuthGuard

  U->>LP: username + password
  LP->>AC: login()
  Note over AC: любой non-empty credentials
  AC->>LS: sokol_auth
  LP->>AG: navigate /checks
  AG->>AC: isAuthenticated?
  AC-->>AG: yes
```

Axios **не** ставит `Authorization`. Смена пароля в профиле — UI-only.

## Диаграмма классов (логические типы)

```mermaid
classDiagram
  class Check {
    +string id
    +string serial_number
    +string check_name
    +string check_type
    +string status
    +string check_leader
    +string start_date
    +string end_date
  }
  class Recommendation {
    +string id
    +string check_id
    +string serial_number
    +number sequence_number
    +string status
    +string additional_status
    +string materiality_level
    +string deadline
  }
  class User {
    +string username
    +string displayName
  }
  class SokolDataContextValue {
    +Check[] checks
    +Recommendation[] recommendations
    +addCheck()
    +updateCheck()
    +deleteCheck()
    +addRecommendation()
    +replaceRecommendationsForCheck()
  }
  class AuthContextValue {
    +User user
    +login()
    +logout()
  }
  SokolDataContextValue --> Check
  SokolDataContextValue --> Recommendation
  AuthContextValue --> User
  Check "1" --> "*" Recommendation : serial_number / check_id
```

## Потоки данных

### Создание рекомендации из формы проверки

```mermaid
sequenceDiagram
  participant CF as CheckFormPage
  participant Nav as location.state
  participant RF as RecommendationFormPage
  participant API as Backend

  CF->>Nav: draft + return path
  CF->>RF: navigate /recommendations/new
  RF->>API: POST /recommendations
  RF->>Nav: restore check draft
  RF->>CF: navigate back
```

### Генерация Раздела II

```mermaid
sequenceDiagram
  participant UI as DocxToolPanel
  participant T as api/tools
  participant BE as POST /tools/section-ii
  UI->>T: FormData file
  T->>BE: multipart
  BE-->>T: blob DOCX
  T-->>UI: downloadBlob
```

## Явные ограничения архитектуры

1. Таблицы фильтруются **на клиенте** после bulk-fetch (500/1000) — не server-driven pagination UI.
2. Вложения не персистятся.
3. Analytics зависит от несуществующего backend endpoint.
4. Auth stub — нет защиты API.
5. «Канцлер» — заглушка СЭД.
6. Нет frontend unit/e2e test script в `package.json`.

## Связь с backend docs

Подробности контрактов и DOCX: `sokol-backend/docs/API.md`, `REPORTS.md`, `ARCHITECTURE.md`.
