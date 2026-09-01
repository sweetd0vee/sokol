# UI-стандарты

Источники: `src/constants/formLayout.ts`, `tailwind.config.js`, `index.css`.

## Каркас

| Элемент | Значение |
|---------|----------|
| Фон приложения / контент | `bg-white` |
| Фон login | `rgb(245,245,245)` |
| Sidebar | 224px (`w-56`), navy `#003366` |
| Header | 88px |
| Padding списков | 32px (`p-8`) |
| Padding форм | 16px (`px-4 py-4`) |
| Auth-карточка | max 448px (`max-w-md`) |
| Analytics sidebar | 320px (`lg:w-80`) |

## Формы

| Токен | Значение |
|-------|----------|
| `FORM_PAGE_CLASS` | max-w-7xl (1280px) |
| Секции | белый фон, border `#b8bec8`, padding 20px, gap 20–32px |
| Сетка полей | `.form-row-3` / `.form-row-4` в `index.css` |
| Кнопки списка | `LIST_ACTION_BUTTON_CLASS` 160×38px; группа 334px |

Полный список токенов — в `formLayout.ts`.

## Цвета (`sber` palette)

| Token | Hex |
|-------|-----|
| dark / navy | `#003366` |
| DEFAULT | `#2563EB` |
| light / accent | `#6699FF` |
| muted | `#1D4ED8` |
| save | `#90EE90` |

Таблицы: тёмный header. Кнопки primary — navy/accent; «Сохранить» — зелёный.

## Модалки

| Тип | Ширина |
|-----|--------|
| Обычное | max 448px (`max-w-md`) |
| Широкое | max 768px (`max-w-3xl`), max-h 90vh |

Оверлей: `bg-black/50`, padding 16px (`p-4`), карточка `rounded-2xl`.  
`ConfirmDialog` экспортируется из `Modal.tsx`.

## Компоненты UI kit

`Button`, `Input`, `Select`, `MultiCheckboxSelect`, `Textarea`, `DatePicker`, `Modal` / `ConfirmDialog`, `PageHeader`, `SegmentedControl`, `StateMessage`.
