# Код-ревью: sokol-frontend

Снимок на **10.09.2026**. Разбор текущего React-приложения (`sokol-frontend/`), не исторический backlog из [HISTORY.md](HISTORY.md).

Контекст: внутренний SPA аудита, JWT, списки через bulk-fetch. Слои и UI-kit сильные; слабые места — **доверие к localStorage**, **нет route-level authz**, **нет error boundary**, **тихая обрезка на 10000**, почти нет component-тестов.

**Итоговая оценка: 6.3 / 10**

Для пилота в одном браузере у доверенных людей — работает. Для широкого UAT — закрыть High: гидрация формы rec, 404, даты, баннер truncation, lazy-load.

| | |
|--|--|
| Стек | React 19 · TypeScript strict · Vite 7 · TanStack Query 5 · Axios · Tailwind · Recharts |
| Состояние | Context + React Query, без Redux. Конструктор — localStorage |
| Тесты | 37 Vitest (`*.test.ts`, environment `node`) · Playwright e2e не в CI |
| Нет | Error boundary · `React.lazy` · `AdminGuard` · jsdom/component tests |

---

## Таблица оценок

| # | Блок | Оценка | Коротко |
|---|------|-------:|---------|
| 1 | Архитектура и модули | **7.0** | Чистые слои `api → hooks → components`; провайдеры глобальные |
| 2 | TypeScript | **7.5** | `strict` включён; дыры — `as` на границе API и location.state |
| 3 | Состояние | **6.5** | Query keys централизованы; 10k игнорирует `total`; rec-форма сбрасывается |
| 4 | Auth в UI | **5.0** | Guard на токен есть; роль из localStorage; поля rec не гейтятся |
| 5 | API-клиент | **7.0** | Один axios, 401 → logout; 404 глотается; serial lookup хрупкий |
| 6 | Формы и валидация | **7.0** | Общие shell/токены; rec без ErrorState; скрытый PATCH лидера проверки |
| 7 | Списки / фильтры | **6.5** | Хороший list kit; фильтр по загруженным; N+1 экспорт вложений |
| 8 | Аналитика и конструктор | **7.5** | Отдельные API; keep-alive жрёт RAM; конструктор не бэкапится |
| 9 | a11y и UX | **5.5** | `lang=ru`, есть `<main>`; модалки без dialog-паттерна; логин сломан версткой |
| 10 | Производительность | **5.0** | 10k×2 на каждый логин; нет code splitting |
| 11 | Безопасность | **5.0** | XSS в React нет; JWT в localStorage; роль спуфается в DevTools |
| 12 | Тесты | **6.5** | Утилиты покрыты хорошо; нуль `.tsx`; e2e мокает API |
| 13 | Стили / UI consistency | **7.5** | Tailwind + `formLayout.ts`; логин и модалки из другой палитры |
| 14 | Ошибки и края | **6.0** | Списки с retry; нет boundary; 404 → пустая строка |

Среднее по блокам ≈ 6.4. Итог **6.3**: качество UI-kit выше, чем устойчивость сессии и списков.

---

## Что сделано хорошо

- Слои читаемые: `src/api/` → `hooks/` → `components/`. Списки делят `EntityListHeader`, `ListTableShell`, `useClientTable`. Формы — `FormPageShell` / `formLayout.ts`.
- TypeScript `strict`, `noUnusedLocals`, `verbatimModuleSyntax`. Domain types и mappers существуют.
- `queryKeys.ts` централизован. 401 вне login чистит сессию (`sokol:auth-unauthorized`).
- Аналитика ходит в `/api/v1/analytics/*`, не в 10k-список. Keep-alive вкладок — осознанный UX.
- Нет `dangerouslySetInnerHTML`, нет `eval`, нет `console.log` в `src/` (только warn/error в экспорте).
- Вложения: banner MinIO через `useStorageStatus`; слоты whitelist; zip-пути санитизируются.
- Заголовки HTML-экспорта экранируются (`escapeHtml` на title).
- Lint `--max-warnings 0` в CI. Playwright покрывает login/logout/смену пароля/smoke конструктора.

---

## Сводка findings

### Critical

Нет обхода `AuthGuard` без токена: неаутентифицированный `/` → `/login`. Спуф роли в localStorage **не** даёт реальных admin-API (backend `require_admin`). Это High по UX, не Critical RCE.

Ближайшее к Critical по продукту: **тихая неполнота данных после 10000** (списки, «Мои», экспорт) и **сброс полей формы рекомендации** после refetch — потеря работы аудитора.

### High

1. JWT + роль в `localStorage` (`sokol_auth`); UI `isAdmin` из этой копии, не из `/me`.
2. `canManageRecommendation` гейтит только delete и вложения — поля формы чужой rec остаются editable.
3. `useRecommendationForm` сбрасывает поля при любом новом `source` (нет `hydratedId`, как у проверки).
4. `getErrorMessage` возвращает `''` на любом 404 — пустой красный бокс / пустая форма.
5. Нет React error boundary — throw в Recharts/html-to-image = белый экран.
6. `SokolDataProvider` грузит 10k+10k на **каждый** залогиненный маршрут, `total` игнорируется.
7. Нет `React.lazy` — analytics/export/docx в главном бандле.
8. Форма rec в edit без ErrorState, если fetch упал.
9. `personMatch`: username без инициалов матчит всех однофамильцев.

### Medium / Low

`toInputDate` через `new Date("YYYY-MM-DD")` (UTC); Vite fallback 8800 vs README 8802; keep-alive четырёх дашбордов; конструктор только localStorage; модалки без `role="dialog"`; N+1 экспорт вложений.

---

## 1. Архитектура и модули — 7.0 / 10

```
QueryClient → AuthProvider → SokolDataProvider → AnalyticsConstructorProvider → BrowserRouter
```

Все провайдеры **выше** роутера (`AppProviders.tsx`). После логина Settings / Tools / Profile всё равно гидрируют 10k checks + 10k rec + библиотеку конструктора.

Нет `React.lazy` / `Suspense` (`AppRoutes.tsx`). Recharts, exceljs, pdfmake, docx, html-to-image, xlsx, jszip в главном чанке. Vite warning по размеру уже задокументирован в [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md) — это не «ожидаемо», это долг.

Неизвестный путь → `Navigate` на `/checks`. Сломанный букмарк выглядит как «домашняя».

`AuthLayout` жмёт Outlet в `max-w-md`; `LoginPage` рисует карточку `max-w-4xl` + `min-h-screen` внутри. Логин обрезан / двойная оболочка. Первое впечатление сломано.

Дубли экспорта: `utils/tableExport/`, `utils/visualExport/`, `utils/constructor*Export.ts`, `utils/exports.ts`. Три Excel-стека: `xlsx`, `xlsx-js-style`, `exceljs`.

**Фикс:** провайдеры списков только под `/checks`/`/recommendations`/формы; конструктор только под `/constructor`; lazy на analytics/tools/constructor; отдельный 404; логин без `max-w-md`.

---

## 2. TypeScript — 7.5 / 10

`strict` работает. Дыры на границах:

| Sev | Где | Что |
|-----|-----|-----|
| Med | `api/mappers.ts` | `api.check_type as CheckType` без runtime-guard |
| Med | `useCheckForm` / `useRecommendationForm` | `location.state as …FormLocationState` — можно подсунуть stale/поддельный объект и **пропустить** `fetchCheck`/`fetchRecommendation` |
| Med | `RecommendationFormPage` | `value as Recommendation['status']` / `as MaterialityLevel` |
| Low | `reactGridLayout.ts`, `constructorXlsxLayout.ts` | единственные `as unknown as` |
| Low | `SokolDataContext` | ошибки кверятся как `Error \| null`, реально `ApiError` |

`tsconfig.app.json` **exclude** `src/**/*.test.ts` — тесты не проверяет `tsc -b`. Vitest `include: ['src/**/*.test.ts']` — **нет `*.test.tsx`**, environment `node`, не jsdom.

Один `eslint-disable`: `analyticsFilterCaptionContext.tsx` (`react-refresh/only-export-components`). TODO/FIXME в src нет.

---

## 3. Состояние — 6.5 / 10

### H1. Bulk-fetch 10000, `total` игнорируется

```22:32:sokol-frontend/src/contexts/SokolDataContext.tsx
const LIST_FETCH_LIMIT = 10000;
// ...
queryFn: () => fetchChecks({ limit: LIST_FETCH_LIMIT }),
```

`data.total` не используется. Списки, фильтр «Мои», годовые ID, table export — по загруженному срезу. Пагинация пишет «из Z» для **загруженного** Z. Баннера truncation нет. Это задокументировано как лимит пилота и всё равно **ошибка корректности**, как только строк станет 10001.

То же на словарях/users: `limit: 200`, `total` не сравнивается.

### H2. Гидрация формы рекомендации

`useCheckForm` держит `hydratedCheckId` и не перетирает поля после refetch. `useRecommendationForm` — нет:

```82:101:sokol-frontend/src/hooks/useRecommendationForm.ts
  useEffect(() => {
    if (isEditMode && source) {
      setFields((prev) => recommendationFormFieldsFromSource(source, prev.checkLeader));
      return;
    }
    // ...
  }, [source, isEditMode, navigationState, location.key, ...]);
```

Любой `invalidateAll` (соседняя вкладка, чужой CRUD) меняет identity `source` → эффект сбрасывает форму. Потеря несохранённых правок.

`refetch` в контексте зависит от объектов кверей → value провайдера прыгает, потребители ре-рендерятся пачкой.

Конструктор `persist` на каждый drag layout. Quota / private mode: `setItem` падает молча, «сохранено» врёт.

`useCurrentUserName`: имя из JWT **или** leftover `sokol_profile_info`. Logout чистит `sokol_auth`, не профиль/аватар/конструктор — следующий пользователь на той же машине видит чужие дашборды и аватар.

Analytics `staleTime: 60_000` — после правок дашборд врёт до минуты. Capabilities 5 мин. Задокументировано, в QA выглядит как баг.

QueryClient: `retry: 1` даже после 401 (интерцептор уже снял токен).

---

## 4. Auth в UI — 5.0 / 10

`AuthGuard` проверяет `!!user?.accessToken`. Роль:

```74:78:sokol-frontend/src/contexts/AuthContext.tsx
    isAuthenticated: !!user?.accessToken,
    isAdmin: !!user?.role && ADMIN_ROLES.has(user.role),
```

`ADMIN_ROLES` = `admin` **и** `department_head`. Роль пишется в `localStorage` вместе с токеном (`authSession.ts`). Правка `"role":"admin"` в DevTools включает кнопки удаления, справочники, создание пользователей. Backend 403-ит мутации — в UI это «кнопка есть, сейв упал». Путаница для аудиторов и ложное чувство контроля.

`GET /auth/me` на бэке есть. Фронт после login его **не** вызывает и не сверяет роль.

### H3. Поля рекомендации не закрыты

`canManageRecommendation` используется для **delete** и `canModifyAttachments`. Статус, аудитор, текст, closure, Save — всегда доступны. Save всегда зовёт `updateRecommendation`. Если API когда-нибудь начнёт отдавать 403 — UX будет «форма врёт, что можно». Сейчас API пускает (см. [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md) B-H1) — дыра сквозная.

`/settings` открыт всем ролям; `canManage={isAdmin}` прячет кнопки записи. Аудитор видит все словари.

### H4. `personMatch` без инициалов

```58:60:sokol-frontend/src/utils/personMatch.ts
  if (!userParts.initials) {
    return true;
  }
```

«Мои» на рекомендациях и `canManageRecommendation` становятся шире, чем ФИО. На проверках «Мои» — **точный** `check_leader.toLowerCase() === normalizedMyName`. Один тумблер, разный смысл.

Нет return URL: логин всегда `/checks`. `/login` доступен уже залогиненному. JWT `exp` не читается — «залогинен» до первого 401 (до 8 часов, см. лимиты).

`LoginPage`: клиентский allowlist `SIMPLE_LOGINS = admin | auditor` + «Фамилия И.О.». Лишняя валидация, которой API не требует; алиасы вроде короткого логина аудитора отвалятся на клиенте.

---

## 5. API-клиент — 7.0 / 10

Один axios, Bearer, FormData Content-Type снимается интерцептором (иначе захардкоженный `multipart/form-data` без boundary ломает upload). `toApiError` разбирает FastAPI `detail`.

### H5. 404 → пустая строка

```104:109:sokol-frontend/src/api/errors.ts
export function getErrorMessage(error: unknown, fallback?: string) {
  const apiError = toApiError(error);
  if (apiError.status === 404 || apiError.code === 'http_404') {
    return '';
  }
```

Тест **фиксирует** это поведение (`errors.test.ts`: «returns empty string for 404»). Edit rec с несуществующим id — пустой description, не «не найдено».

### H6. Поиск проверки по serial

```31:38:sokol-frontend/src/api/checks.ts
export async function fetchCheckBySerialNumber(serialNumber: string): Promise<Check | null> {
  const { items } = await fetchChecks({ search: normalized, limit: 50 });
  return items.find((check) => check.serial_number === normalized) ?? null;
}
```

Бэкенд: `ilike %search%` по имени, лидеру **и** serial, сортировка `start_date DESC`. Если 50 более новых проверок содержат подстроку (имя/лидер), точная строка **не попадёт** в выдачу. Форма rec останется без linked check → скрытый PATCH лидера не сработает / создастся ощущение «проверки нет».

Нет dedicated `GET /checks/by-serial/{serial}`.

Подсказка сети говорит uvicorn **8802**, `API_DISPLAY_URL` fallback — `localhost:8800`. `.env.development` ставит `VITE_DEV_API_PORT=8802`; `vite.config.ts` fallback без env — **8800**. Три источника правды.

Нет default timeout (кроме DOCX 10 мин) — зависший `GET /checks` держит спиннер вечно.

`filename*` (RFC 5987) при скачивании вложений не парсится — кириллица → `attachment-123`.

---

## 6. Формы и валидация — 7.0 / 10

Общие required-helpers, banner валидации, confirm delete, автостатус от дедлайнов. Check create → navigate на edit, чтобы включить вложения. CheckFormPage при ошибке fetch показывает `ErrorState`. RecommendationFormPage — **нет**:

```55:61:sokol-frontend/src/components/recommendations/RecommendationFormPage.tsx
  if (form.isEditMode && form.isFetching && !form.source) {
    return ( <LoadingState /> );
  }
  // нет ветки isError
```

Если fetch 404/500 и нет строки в контексте — рисуется пустая «новая» форма. Save уйдёт как create или упадёт молча.

`persistCheckLeaderIfNeeded`: сохранение рекомендации **патчит linked check**, если в дропдауне сменили руководителя. Это меняет `serial_number` и MinIO bucket на бэке. Скрытый побочный эффект на другую сущность, без confirm.

Пароль: `MIN_PASSWORD_LENGTH = 4` (профиль и admin-создание users). `DatePicker` / `Select` — label не связан через `htmlFor` (у `Input` есть `useId`). Login без `autoComplete="username"` / `current-password`.

---

## 7. Списки / фильтры — 6.5 / 10

Хороший kit: фильтр+сорт, `MultiCheckboxSelect`, локальный date range, пагинация 10–100, loading/error/empty на Checks и Recs, keys по `id`.

Фильтры работают **только** по загруженным ≤10000. Экспорт таблиц — тоже.

ID-фильтр проверок: `yearlyId.includes(filters.idFilter.trim())` — **case-sensitive**, в отличие от ключа/имени. `RecommendationsTab` всегда передаёт `statuses: []` — мёртвое поле, статус только через индикатор.

Экспорт вложений проверки: N+1 `fetchAttachments` на каждую строку + blob на файл, последовательно, плюс `window.alert` на ошибке. 200 проверок = сотни запросов, UI заморожен.

Hover-карточка рекомендации — только `onMouseEnter`. Клавиатура/тач не видят observation/execution. Скролл (включая overflow самой карточки) закрывает её.

---

## 8. Аналитика и конструктор — 7.5 / 10

Отдельные bootstrap + filtered query. Период / аудитор / департамент. Planning — тот же shell. Конструктор: локальная библиотека, grid, add-from-analytics, HTML/XLSX/PDF.

### H7. Keep-alive всех посещённых дашбордов

```25:27:sokol-frontend/src/components/tabs/AnalyticsTab.tsx
function KeepAlivePanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? 'w-full' : 'hidden'}>{children}</div>;
}
```

Открыл все четыре вкладки — четыре семьи кверей + Recharts остаются смонтированными. Переключение быстрое, idle-cost высокий.

Два `SegmentedControl` делят один `activeTab`. У неактивной группы **нет** выбранной кнопки — выглядит сломанным.

Конструктор: localStorage, не привязан к user id, нет сервера. `migrateLegacyWidgets` почти не валидирует форму. Другой ПК / инкогнито = пусто. Quota глотается.

HTML-экспорт: title экранируется, **сырой** `htmlMarkup` / `svgMarkup` из живых чартов вставляется как есть. Если в подписи серии когда-нибудь окажется разметка — XSS в скачанном HTML. Для внутреннего пилота Medium; не открывать экспорт как «файл с сайта» в чужом браузере.

Неизвестный id конструктора → редирект на список с вспышкой «Загрузка дашборда…», не «не найден».

Filtered analytics keys собраны руками, не через `queryKeys.analytics.*` (кроме bootstrap) — invalidate сложнее.

---

## 9. a11y и UX — 5.5 / 10

Есть `html lang="ru"`, `<main>`, aria-label на toggle пароля, у части чартов `role="img"`, MultiCheckboxSelect — listbox.

Нет skip-link. Sidebar `<nav>` без `aria-label`. Клавиатура каждый раз проходит 7 пунктов.

`Modal`: overlay `role="presentation"`. Нет `role="dialog"`, `aria-modal`, focus trap, initial focus, restore. `ConfirmDialog` **не передаёт** `onClose` → Escape и клик по оверлею **не закрывают** (удаление проверки/rec легко «залипает» для мыши вне карточки).

`Select` / `DatePicker` / `SegmentedControl`: лейблы не wired; сегменты не `tab` / `aria-selected`. Ошибка логина — `<p>` без `role="alert"`. Таблицы без `<caption>` / `scope="col"`, checks `min-w-[1616px]` без sticky первой колонки.

Логин: «СберБанк» `absolute` внутри узкого `AuthLayout` — первая страница продукта визуально сломана.

---

## 10. Производительность — 5.0 / 10

| Sev | Что |
|-----|-----|
| High | 10k×2 JSON на **каждый** залогиненный сеанс, в т.ч. Settings/Tools/Profile |
| High | Нет code splitting |
| High | Context churn от `refetch` identity |
| Med | Analytics keep-alive × Recharts |
| Med | `useEntityAttachments` — sequential `await uploadAttachment` |
| Med | Constructor persist на каждый drag |
| Low | Почти нет `React.memo` на строках — при page size 50 не bottleneck |

Фильтры мемоизированы (`useMemo`), но O(n) по 10k на каждый keystroke фильтра.

---

## 11. Безопасность — 5.0 / 10

React 19 экранирует текст. CSRF при Bearer-в-header не главная угроза (куки не используются). Не переключаться на cookie-auth, пока CORS может быть `*`.

| Sev | Что |
|-----|-----|
| High | Access token + role в JS-readable storage, TTL 8ч. Любой будущий XSS = сессия |
| High | UI-роль из storage, не из `/me` |
| High | `xlsx` + `xlsx-js-style` в зависимостях при уже существующем exceljs — лишняя supply-chain поверхность |
| Med | Экспорт HTML/SVG без санитайза internals |
| Med | Пароль от 4 символов; TLS должен быть на шлюзе (фронт сам его не обеспечит) |
| Med | `isDocxFile` — только расширение/MIME |
| Low | Нет CSP / referrer-policy в `index.html` (лучше заголовок nginx) |
| Low | Аватар в том же origin localStorage, что и токен |

Данные проверок/рекомендаций живут в памяти React Query всю сессию — DevTools их видит. Для внутреннего аудита приемлемо, если сеть доверенная.

---

## 12. Тесты — 6.5 / 10

37 файлов, почти все **чистые утилиты**: фильтры списков, payload форм, yearly numbers, analytics series, constructor library. Это ценно.

Нет component-тестов: AuthGuard, формы, таблицы, аналитика. `vite.config.ts` `environment: 'node'`. Playwright мокает API — не бьёт живой 401, не различает admin vs auditor на мутациях, не ловит сброс формы rec.

Не покрыто: `personMatch` без инициалов, `toInputDate` TZ, truncation banner (его нет), AuthGuard, 404 message.

`tsconfig.app.json` исключает тесты из `tsc -b`.

---

## 13. Стили / UI consistency — 7.5 / 10

Токены `formLayout.ts`, шапка `#003366`, sber-dark/light, бейджи статусов и материальности согласованы. Списки выглядят одним продуктом.

Логин — другой серый, огромный type, вложен в `AuthLayout`. Модальный primary — лайм `#90EE90`, остальное приложение — navy. Analytics: два segmented row ломают паттерн «одна выбранная вкладка». Sidebar template-string с рваным отступом. Только `color-scheme: light`.

---

## 14. Ошибки и края — 6.0 / 10

Списки и analytics shell: loading, error+retry, empty. Storage banner + poll. DOCX timeout message. Form `saveError`. 401 → logout.

Нет error boundary в `main.tsx`. Rec form fetch failure без UI. 404 → `''`. Tools 503 (очередь) без чтения `Retry-After` — пользователь долбит «Обработать». ConfirmDialog не закрывается по оверлею.

---

## Каталог ошибок (что чинить)

| ID | Sev | Где | Что сломано | Фикс |
|----|-----|-----|-------------|------|
| F-H1 | High | `SokolDataContext.tsx` | `total` игнорируется, нет баннера 10k | Показать `loaded / total`; потом server pagination |
| F-H2 | High | `useRecommendationForm.ts` | Сброс полей на refetch | `hydratedId`, как в `useCheckForm` |
| F-H3 | High | `RecommendationFormPage.tsx` | Поля чужой rec editable | Disable / спрятать Save при `!canManage` |
| F-H4 | High | `authSession.ts`, `AuthContext.tsx` | Роль из localStorage | После login `/me`; UI-роль только оттуда |
| F-H5 | High | `api/errors.ts` | 404 → `''` | Русский not-found; поправить тест |
| F-H6 | High | `main.tsx` | Нет error boundary | Boundary на табы и ChartCard |
| F-H7 | High | `RecommendationFormPage.tsx` | Нет ErrorState на fetch fail | Как `CheckFormPage` |
| F-H8 | High | `AppProviders.tsx`, `AppRoutes.tsx` | 10k на всех маршрутах; нет lazy | Split providers; `React.lazy` |
| F-H9 | High | `personMatch.ts` | Surname-only = match | Требовать инициалы |
| F-H10 | High | `api/checks.ts` | Serial lookup limit 50 + ilike | `GET /checks/by-serial` |
| F-M1 | Med | `utils/dates.ts` `toInputDate` | `new Date("YYYY-MM-DD")` = UTC | Парсить как local, как `parseDateValue` |
| F-M2 | Med | `useRecommendationForm.ts` | Save патчит check_leader | Confirm или отдельный API |
| F-M3 | Med | `AuthGuard` | Нет return URL; `/login` для залогиненных | `state.from`; редирект с логина |
| F-M4 | Med | `LoginPage` + `AuthLayout` | Карточка в `max-w-md` | Убрать обёртку / другую раскладку |
| F-M5 | Med | `Modal.tsx` | Нет dialog, Confirm без `onClose` | `role="dialog"`, focus trap, `onClose={onCancel}` |
| F-M6 | Med | `AnalyticsTab.tsx` | Keep-alive ×4; два segmented | Unmount + sessionStorage фильтров; один tablist |
| F-M7 | Med | constructor library | Только localStorage, silent quota | Toast; сервер или per-user key |
| F-M8 | Med | HTML export | Сырой SVG/HTML | DOMPurify / только raster |
| F-M9 | Med | `exportCheckAttachments.ts` | N+1 + `alert` | Zip на бэке или пул + прогресс |
| F-M10 | Med | QueryClient | retry после 401 | `retry: (n, err) => err.status !== 401` |
| F-M11 | Med | settings/users API | cap 200 без предупреждения | Как F-H1 |
| F-M12 | Med | `checkList.ts` | ID filter case-sensitive | Normalize |
| F-M13 | Med | `RecommendationsTab` | `statuses: []` мёртвый | Убрать или колонка |
| F-M14 | Med | `config/env.ts` vs vite vs README | 8800 vs 8802 | Один fallback |
| F-M15 | Med | password UI | min 4 | 8+ |
| F-M16 | Med | `xlsx` / `xlsx-js-style` | Лишние зависимости | Оставить exceljs |
| F-M17 | Med | Tools 503 | Нет Retry-After | Disable + countdown |
| F-M18 | Med | JWT exp | Ждём 401 | Decode exp для UX-logout |
| F-L1 | Low | `AppRoutes` `*` | Тихий редирект | Страница 404 |
| F-L2 | Low | Sidebar nav | Нет aria-label, нет skip-link | Добавить |
| F-L3 | Low | DatePicker/Select | Нет htmlFor | Как Input |
| F-L4 | Low | Login | Нет autocomplete | username / current-password |
| F-L5 | Low | `SIMPLE_LOGINS` | Лишняя клиентская политика | Убрать |
| F-L6 | Low | logout | Не чистит avatar/constructor | Чистить или namespace по user |
| F-L7 | Low | attachments download | Нет filename* | RFC 5987 |
| F-L8 | Low | multipart Content-Type | Задан руками | Не ставить, пусть браузер |
| F-L9 | Low | timeout GET | Нет | 30s default |
| F-L10 | Low | Confirm overlay | Не закрывает | `onClose={onCancel}` |
| F-L11 | Low | Vitest | Нет jsdom/tsx | Testing Library на Guard и формы |
| F-L12 | Low | Playwright | Только моки | Один контрактный путь на роль |

---

## Подводные камни

1. **Пилот 10000.** «Показано X–Y из Z» — Z загруженных, не Postgres. Экспорт ≠ «все строки БД». Словари/users — тот же класс бага на 200.
2. **JWT в `sokol_auth`.** Logout = `removeItem`. Единственный сигнал истечения — 401.
3. **`department_head` = `isAdmin`.** Удаление проверок, запись словарей, **создание users**.
4. **Location state** на edit (`state={{ check }}`) может пропустить fetch — stale или поддельные данные.
5. **`toInputDate` vs `parseDateValue`.** ISO `YYYY-MM-DD` в `new Date()` = UTC midnight. В Москве (UTC+3) календарный день обычно совпадает; западнее UTC пикер покажет предыдущий день. Сохранение идёт через `toIsoDate` (local) — round-trip может сдвинуть дату.
6. **Сохранение рекомендации может переписать руководителя проверки и serial.**
7. **Конструктор не бэкап.** Другой браузер / инкогнито = пусто. Quota errors глотаются.
8. **Analytics cache 60с.** Поменял проверку — графики врут до минуты. Capabilities 5 мин — лимит upload отстаёт.
9. **DOCX: 10 мин timeout, очередь 503.** UI плохо объясняет очередь.
10. **Порты:** README и `.env.development` → 8802; `API_DISPLAY_URL` и vite fallback → 8800; Docker API → 8800. «API не запущен» часто = не тот порт.
11. **FormData Content-Type.** Интерцептор спасает; копипаста `multipart/form-data` в новый клиент без него сломает upload.
12. **StrictMode** в dev дважды монтирует эффекты (constructor persist, storage poll).
13. **Keep-alive analytics.** Первый визит lazy; после этого платишь за все посещённые вкладки до reload.
14. **Три Excel-стека** (`xlsx` / `xlsx-js-style` / exceljs).
15. **Hover-карточки** игнорируют клавиатуру и закрываются на любой scroll.
16. **Нет error boundary.** Один throw чарта валит вкладку.
17. **Зелёный Playwright ≠ тест авторизации.** E2E не утверждает роли.
18. **Logout не чистит конструктор/аватар.** Следующий человек за тем же профилем ОС видит чужое.
19. **Фильтр «Мои».** Проверки — exact string; рекомендации — fuzzy `personMatch`.
20. **Виды проверок** в фильтрах должны приходить из `/settings/check_kinds` (`useCheckKindOptions`), не из захардкоженного enum. Новые виды без refetch словаря не появятся в фильтре.

---

## Приоритетный план

1. **P0.** One-shot hydrate rec form; ErrorState на fetch fail; не глотать 404.
2. **P0.** Гейтить поля/Save по `canManageRecommendation` (согласовать с бэкенд-authz).
3. **P0.** Баннер `loaded < total`; не врать в пагинации/экспорте.
4. **P1.** `/me` как источник роли; не доверять storage.role. Чистить constructor/avatar на logout или ключ с username.
5. **P1.** Error boundary; lazy analytics/tools/constructor; не грузить 10k на Settings.
6. **P1.** `toInputDate` как local parse; serial lookup dedicated endpoint.
7. **P2.** Dialog a11y; починить login layout; один tablist аналитики; Retry-After на tools.
8. **P2.** jsdom-тесты на Guard, hydrate rec, 404 message, truncation; Playwright с ролями без полной мок-стены.
9. **P2.** Убрать `xlsx`/`xlsx-js-style`; debounce persist конструктора; zip-экспорт вложений.

Связанные доки: [ARCHITECTURE.md](ARCHITECTURE.md), [UI_STANDARDS.md](UI_STANDARDS.md), [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md), [ANALYTICS.md](ANALYTICS.md), [CODE_REVIEW_BACKEND.md](CODE_REVIEW_BACKEND.md).
