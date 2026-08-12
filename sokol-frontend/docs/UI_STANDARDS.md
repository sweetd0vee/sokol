# UI-стандарты

Источники: `src/constants/formLayout.ts`, `tailwind.config.js`, `index.css`.

## Каркас

| Элемент | Значение |
|---------|----------|
| Фон приложения | `rgb(245,245,245)` |
| Sidebar | 224px (`w-56`) |
| Header | 88px |
| Padding списков | 32px (`p-8`) |
| Padding форм | 16px (`px-4 py-4`) |
| Auth-карточка | max 448px |

## Формы

| Токен | Значение |
|-------|----------|
| `FORM_PAGE_CLASS` | max-w-7xl (1280px) |
| Секции | белый фон, border `#b8bec8`, padding 20px, gap 20–32px |
| Сетка полей | `.form-row-3` / `.form-row-4` в `index.css` |

Полный список токенов — в `formLayout.ts`.

## Цвета (`sber` palette)

| Token | Hex |
|-------|-----|
| navy | `#003366` |
| accent | `#6699FF` |

Таблицы: тёмный header. Кнопки primary — navy/accent.

## Модалки

| Тип | Ширина |
|-----|--------|
| Обычное | max 448px |
| Широкое | max 768px, max-h 90vh |

Оверлей: `bg-black/50`, padding 24px, `rounded-2xl`.

## Компоненты UI kit

`Button`, `Input`, `Select`, `Textarea`, `DatePicker`, `Modal`, `ConfirmDialog`, `PageHeader`, `SegmentedControl`, `StateMessage`.
