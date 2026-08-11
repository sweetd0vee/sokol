# SOKOL Frontend — документация

Каталог описывает **актуальное** состояние UI (август 2026). **План развития:** [PLAN.md](../../PLAN.md).

## Что читать

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Структура, провайдеры, API-слой, компоненты, диаграммы |
| [ANALYTICS.md](ANALYTICS.md) | Дашборды аналитики, бизнес-смысл карточек, фильтры и экспорт |
| [ANALYTICS_TZ.docx](ANALYTICS_TZ.docx) | ТЗ / описание дашбордов со скриншотами |
| [PLANNING.md](PLANNING.md) | Дашборды планирования: охват, аналитика департаментов, красные рекомендации |
| [USER_STORIES.md](USER_STORIES.md) | Пользовательские истории и потоки |
| [RUNBOOK.md](RUNBOOK.md) | Установка, env, Docker, проверки |
| [BPMN.md](BPMN.md) | BPMN 2.0 XML основных процессов |
| [SECTION_II_ALGORITHM.md](SECTION_II_ALGORITHM.md) | Алгоритм парсинга АЗ и генерации Раздела II |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Размеры, сетка форм, цвета |
| [ROADMAP.md](ROADMAP.md) | Frontend backlog |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Замечания по коду и риски |

Backend: [sokol-backend/docs](../../sokol-backend/docs/README.md), в т.ч. [ALEMBIC_AND_DATA.md](../../sokol-backend/docs/ALEMBIC_AND_DATA.md).

## Кратко о приложении

SPA «Сокол» (React 19 + Vite 7):

- CRUD проверок и рекомендаций, справочники, профиль (stub auth).
- **Аналитика:** backend API — `GET /api/v1/analytics/{checks|recommendations|monitoring|dva}`.
- **Планирование:** `GET /api/v1/analytics/planning` (`PlanningAnalyticsDashboard`); экспорт пока отключён.
- **Вложения:** через backend attachments API + MinIO (не только память браузера).
- DOCX-инструменты: Раздел II, ДЗ, аудиторское мнение (Ollama).
- Наблюдения — демо-таблица без backend CRUD; канцлер — заглушка.

Общие токены форм: `src/constants/formLayout.ts`.

## Стек

| Пакет | Назначение |
|-------|------------|
| React 19 / React Router 7 | UI, маршруты |
| TanStack Query 5 | серверный кэш |
| Axios | HTTP |
| Tailwind 3 | стили (`sber` palette) |
| Recharts | графики аналитики |
| react-grid-layout | статическая сетка дашбордов |
| xlsx-js-style / docx / pdfmake / html-to-image | клиентский экспорт |
| Vitest | unit-тесты (`npm test`) |

Пересборка `ANALYTICS_TZ.docx` (нужен UI на `:5180`): `npm run docs:analytics-tz:full`.

## Dev-порты

| Режим | UI | API |
|-------|----|-----|
| Локальная разработка | **5180** | **8802** (`VITE_DEV_API_PORT`) |
| Docker (коробка) | **5180** | **8800** (`VITE_API_URL`) |

Локально: прокси Vite `/api` → `http://127.0.0.1:8802`.
