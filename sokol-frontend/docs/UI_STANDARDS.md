# UI-стандарты

Источники: `src/constants/formLayout.ts`, `src/index.css`, `src/App.css`, `tailwind.config.js`, `src/components/layout/*`, `src/components/ui/*`.

Тёмная тема выключена: `darkMode` — селектор `[data-theme="dark"]`, на странице его нет.

## Каркас

| Элемент | Значение |
|---------|----------|
| Фон приложения / контент | `bg-white` |
| Фон login / AuthGuard loading | `AuthLayout` — `rgb(245,245,245)`; карточка логина и сплэш — `bg-gray-100` |
| Sidebar | 224px (`w-56`), navy `#003366`, логотип 88px |
| Header | 88px, белый, `border-b border-gray-200`, `pl-6 pr-8` |
| Padding списков / разделов | 32px (`p-8`) |
| Padding форм | 16px (`px-4 py-4`) — только `/checks|recommendations/new` и `/:id/edit` (`COMPACT_FORM_PATHS`) |
| Auth-колонка | max 448px (`AuthLayout` `max-w-md`); карточка внутри — `rounded-[32px] p-16` |
| Analytics / planning sidebar | 320px (`lg:w-80`), sticky, секции `bg-gray-100 p-3.5 rounded-lg` |

Выравнивание правого хрома: группа 334px + `LIST_CHROME_RIGHT_INSET_CLASS` (`pr-[17px]`). Одинаково у `AppHeader` (профиль 288×40 + выход 40×40), `EntityListHeader` («Мои» / «Создать») и колонки действий в таблицах.

**Sidebar:** активный пункт — `bg-sber-light text-white`; hover — `#0066CC`. Пункты: Проверки, Рекомендации, Аналитика, Планирование, Конструктор, Инструменты, Настройки (иконки Lucide 20px).

**Login:** заголовок «СберБанк» сверху слева, «SOKOL» `text-6xl text-sber-dark`, поля `py-5 text-xl`, кнопка входа на всю ширину `rounded-2xl bg-sber-dark`.

## Типографика

| Роль | Класс |
|------|-------|
| Заголовок списка / раздела (`PageHeader`) | `text-2xl font-bold text-sber-dark` |
| Заголовок формы / профиля (`FormPageHeader`) | `text-xl font-bold text-sber-dark` |
| Заголовок секции формы | `FORM_SECTION_TITLE_CLASS` — `text-lg font-semibold text-gray-900` |
| Лейбл поля | `text-sm font-medium text-gray-700` (kit) или `FORM_LABEL_CLASS` (`text-sm leading-relaxed`) |
| Заголовок графика | `text-sm font-semibold text-sber-dark` |

Радиусы: контролы и кнопки — `rounded-lg`; карточки списков — `rounded-xl`; модалки — `rounded-2xl`.

## Формы

Токены — `src/constants/formLayout.ts`. Страница: `FORM_PAGE_CLASS` (`max-w-7xl`, 1280px) + `FORM_STACK_CLASS` (`space-y-8`).

| Токен | Значение |
|-------|----------|
| `FORM_SECTION_CLASS` | белый фон, border `#b8bec8`, padding 20px, `space-y-5`, `rounded-lg` |
| `FORM_SECTION_INNER_STACK_CLASS` | `space-y-5` |
| `FORM_INPUT_CLASS` | `text-sm py-1.5`, фокус серый (`border-gray-400` / `ring-gray-300/40`) — без яркой синей обводки |
| `FORM_TEXTAREA_CLASS` | то же + `min-h-[6.5rem] max-h-48 resize-none` |
| `FORM_SERVICE_INPUT_CLASS` | `bg-green-100` (служебные №) |
| `FORM_EQUAL_CONTROL_CLASS` | высота 2.5rem (`.form-equal-control` в `index.css`) |
| `FORM_FIELD_ERROR_CLASS` | border `#e59a9a`, фокус `#d9534f` |
| `FORM_ROW_3` / `FORM_ROW_4` | сетка в `index.css` |
| `FORM_FIELD_CLASS` | `min-w-0 w-full` |
| `FORM_FIELD_WIDE_CLASS` | в 3-колоночной строке занимает остаток справа |
| `FORM_FIELD_SPAN_2_CLASS` | две стандартные колонки + gutter |
| `FORM_ACTION_BUTTON_CLASS` | ширина 160px |
| `FORM_OUTLINE_BUTTON_CLASS` | accent-обводка 2px `#6699FF` → hover `#3B82F6` |
| `FORM_SAVE_BUTTON_CLASS` | зелёный `#90EE90` → hover `#7fdc7f`, текст `gray-700` |

Сетка полей: с `md` колонка = `(100% − 8.25rem) / 4`, gutter `2.75rem`. Строка из трёх полей той же ширины, выровнена влево. Tools использует секции без рамки (`border-0`).

## Списки и таблицы

| Элемент | Значение |
|---------|----------|
| Карточка таблицы | `rounded-xl border border-gray-200 bg-white` |
| Строка фильтров | `bg-gray-50`, контролы `listFilterClass()` |
| Активный фильтр | заливка `#6699FF` (как нажатое «Мои») |
| Шапка | `#003366`, белый текст; сортировка — `ListSortHeader` |
| Hover строки | `hover:bg-gray-50` |
| Кнопки списка | `LIST_ACTION_BUTTON_CLASS` 160×38px; группа `LIST_ACTION_GROUP_CLASS` 334px |
| «Мои» | accent-обводка; активное — заливка `#6699FF` |
| «Создать» / «Экспорт» | зелёный save |
| Действие в строке | navy-обводка `#003366` → hover `#3B82F6` |
| Пагинация | круги 36px, navy chevron; размеры страницы 10 / 15 / 20 / **50** / 100 |
| Settings | кнопки 140px; колонка «Действия» 300px (`ActionButtons`) |

Компоненты: `EntityListHeader`, `ListExportControls`, `ListPagination`, `ListSortHeader`.

## Цвета

Палитра `sber` в `tailwind.config.js` (токен `save` в теме **нет** — зелёный задаётся hex):

| Token / роль | Hex | Где |
|--------------|-----|-----|
| `sber-dark` / navy | `#003366` | sidebar, шапки таблиц, Button primary, заголовки, DatePicker |
| `sber` DEFAULT | `#2563EB` | палитра графиков |
| `sber-light` / accent | `#6699FF` | активный nav, outline-кнопки, «Мои», активный фильтр |
| `sber-muted` | `#1D4ED8` | hover Button primary |
| save | `#90EE90` / hover `#7fdc7f` | Сохранить, Создать, Экспорт, Добавить, `ModalActions` submit |
| hover fill | `#3B82F6` | hover outline / navy-border кнопок |
| nav hover | `#0066CC` | неактивный пункт sidebar |
| срок нарушен / high materiality | `#FF4347` | индикаторы рекомендаций, planning |

Индикаторы статусов рекомендаций — `src/components/recommendations/indicatorIcons.ts`. Палитры графиков — `src/components/analytics/analyticsPalette.ts`.

## Кнопки

Два слоя: kit `Button` (модалки, вложения) и доменные токены форм/списков.

| Вариант | Вид |
|---------|-----|
| `Button` primary | navy fill, hover `sber-muted`, `rounded-lg px-6 py-2` |
| `Button` secondary | обводка `sber-light` → fill при hover |
| `Button` ghost | обводка `gray-200` |
| Save / Создать / Экспорт | `FORM_SAVE_BUTTON_CLASS` |
| Назад / Сбросить / вторичные действия форм | `FORM_OUTLINE_BUTTON_CLASS` |
| Tools secondary | как `Button` secondary, часто ширина 288px |

## Контролы

Базовый chrome kit (`Input`, `Select`, `Textarea`, `DatePicker`, триггер `MultiCheckboxSelect`): `rounded-lg border-gray-300 px-3 py-2`, фокус `border-sber-dark ring-2 ring-sber-dark/20`.

На формах поверх kit кладётся `FORM_INPUT_CLASS` / `FORM_EQUAL_CONTROL_CLASS` (ниже и серый фокус). Календарь DatePicker — navy-шапка (`App.css`).

`MultiCheckboxSelect` — выпадающий мультивыбор с поиском, «Все» / «Сбросить»; меню вниз или вверх.

`SegmentedControl` — сегмент `min-w-[156px]`; активный `bg-sber-dark text-white`, иначе `bg-gray-100`. Используется в Analytics (два ряда вкладок), Tools (АЗ / ДЗ), Settings.

## Модалки

| Тип | Ширина |
|-----|--------|
| Обычное / `ConfirmDialog` | max 448px (`max-w-md`) |
| Широкое (`wide`) | max 768px (`max-w-3xl`), max-h 90vh, scroll |

Оверлей: `bg-black/50`, padding 16px (`p-4`), карточка `rounded-2xl border-gray-200 p-6`. Escape и клик по оверлею закрывают, если передан `onClose`.

`ModalActions`: submit зелёный save, отмена `Button` secondary.  
`ConfirmDialog`: Да — `Button` primary, Нет — ghost. Экспорт из `Modal.tsx`.

## Состояния

`LoadingState` — спиннер `sber-dark`. `ErrorState` — `border-red-200 bg-red-50`. `EmptyState` — `bg-gray-50`, по центру.

## Аналитика и планирование

Каркас: `AnalyticsDashboardFrame` — сайдбар фильтров + основная колонка (`lg:-mt-[84px]`, чтобы сетка поднялась к уровню шапки).

- Фильтры: год / квартал (`MultiCheckboxSelect`), аудиторы, департаменты; сброс — outline; экспорт — save + select формата.
- Сетка: `react-grid-layout`, карточки `static` (без drag). KPI-сводка («Итого») над сеткой.
- `ChartCard`: `rounded-lg border bg-white shadow-sm`, тулбар (экспорт секции, fullscreen, PNG/SVG/PDF).
- `KpiCard`: цветная заливка по `tone` / `accentColor`.
- Матрицы: `MatrixChartShell`, сортируемые заголовки navy.

Подробнее по вкладкам и API — [ANALYTICS.md](ANALYTICS.md), [PLANNING.md](PLANNING.md), [CONSTRUCTOR.md](CONSTRUCTOR.md).

## Компоненты UI kit

`src/components/ui/`: `Button`, `Input`, `Select`, `MultiCheckboxSelect`, `Textarea`, `DatePicker`, `Modal` / `ModalActions` / `ConfirmDialog`, `PageHeader`, `SegmentedControl`, `LoadingState` / `ErrorState` / `EmptyState`.

Рядом, не kit, но общие: `FormPageHeader`, `EntityListHeader`, list-контролы, `ActionButtons`, `ChartCard` / `KpiCard`.
