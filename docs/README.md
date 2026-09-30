# Документация SOKOL

Вся продуктовая документация лежит в этом каталоге. README в `sokol-backend/` и `sokol-frontend/` — только запуск, env и скрипты.

## Живые документы

| Документ | Содержание |
|----------|------------|
| [PROJECT_CODE_GUIDE.md](PROJECT_CODE_GUIDE.md) | Карта кода для нового разработчика |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Слои backend/frontend, auth, инварианты, bootstrap |
| [RECOMMENDATION_INDICATORS.md](RECOMMENDATION_INDICATORS.md) | Автостатус и индикаторы рекомендаций: правила, приоритет, код |
| [API.md](API.md) | HTTP `/api/v1` |
| [DATA_AND_DB.md](DATA_AND_DB.md) | Модель, enum'ы, FK, seed, import, миграции, бэкапы |
| [STORAGE.md](STORAGE.md) | MinIO: layout, API, консоль, `mc`, бэкап |
| [ANALYTICS.md](ANALYTICS.md) | Дашборды `/analytics`, `/planning`, конструктор `/constructor` |
| [REPORTS.md](REPORTS.md) | Раздел II, ДЗ, файл контроля, parse |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Каркас, формы, списки, цвета, UI kit |
| [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md) | Лимиты, тонкости, типовые ошибки |
| [CI.md](CI.md) | GitHub Actions и merge gate |
| [REVIEW.md](REVIEW.md) | Код-ревью и готовность к продакшену |
| [../README.md](../README.md) · [../DOCKER.md](../DOCKER.md) | Быстрый старт |

Скриншоты и DOCX аналитики: [SOKOL_Аналитика.docx](SOKOL_Аналитика.docx), [ANALYTICS_TZ.docx](ANALYTICS_TZ.docx), [analytics-screenshots/](analytics-screenshots/). Генерация: из `sokol-frontend` — `npm run docs:analytics-tz:full`.

Запуск: [../sokol-backend/README.md](../sokol-backend/README.md), [../sokol-frontend/README.md](../sokol-frontend/README.md). Оценка продакшена — [REVIEW.md](REVIEW.md). Исторический backlog — [HISTORY.md](HISTORY.md), календарь того спринта — [PLAN.md](../PLAN.md).
