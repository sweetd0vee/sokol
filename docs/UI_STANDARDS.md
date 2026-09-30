# UI

Источник размеров и классов — `src/constants/formLayout.ts`, `src/index.css`, `tailwind.config.js`. Тёмная тема не включена: селектор `[data-theme="dark"]` на странице не ставится. Поведение дашбордов — [ANALYTICS.md](ANALYTICS.md).

## Каркас

| Элемент | Значение |
|---------|----------|
| Sidebar | 224px, navy `#003366`, активный пункт `#6699FF` |
| Header | 88px |
| Списки | padding 32px |
| Формы `/checks` и `/recommendations` (`new`, `edit`) | padding 16px, ширина до 1280px |
| Сайдбар аналитики | 320px |
| Модалка / confirm | max 448px; `wide` — 768px |

Правый хром списков (профиль, «Мои» / «Создать», колонка действий) выровнен одной группой 334px.

## Цвета

| Роль | Hex |
|------|-----|
| Navy: sidebar, шапки таблиц, primary | `#003366` |
| Accent: активный nav, «Мои», активный фильтр | `#6699FF` |
| Save: Сохранить, Создать, Экспорт | `#90EE90`, hover `#7fdc7f` |
| Срок нарушен / высокая существенность | `#FF4347` |

Палитра графиков — `analyticsPalette.ts`. Значки рекомендаций — `indicatorIcons.ts`.

## Формы, списки, kit

Кнопки форм и списков — токены `formLayout.ts`: save зелёный, вторичное действие — обводка `#6699FF`, служебный номер — `bg-green-100`. Поля формы ниже kit и с серым фокусом (`FORM_INPUT_CLASS`). Kit (`Button`, `Input`, `Select`, `DatePicker`) — navy-фокус.

Списки: шапка таблицы navy, hover строки серый, пагинация 10 / 15 / 20 / **50** / 100. Settings: кнопки 140px.

`SegmentedControl` — вкладки аналитики, АЗ/ДЗ в tools, справочники. `LoadingState` / `ErrorState` / `EmptyState` — `StateMessage.tsx`.

Kit: `Button`, `Input`, `Select`, `MultiCheckboxSelect`, `Textarea`, `DatePicker`, `Modal`, `ConfirmDialog`, `PageHeader`, `SegmentedControl`, `StateMessage`.
