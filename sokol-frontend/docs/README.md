# SOKOL Frontend — документация

Каталог описывает **актуальное** состояние UI (июль 2026): архитектуру, пользовательские сценарии, запуск, BPMN, код-ревью и алгоритм генерации Раздела II.

## Что читать

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Структура, провайдеры, API-слой, компоненты, диаграммы |
| [USER_STORIES.md](USER_STORIES.md) | Пользовательские истории и потоки |
| [RUNBOOK.md](RUNBOOK.md) | Установка, env, Docker, проверки |
| [BPMN.md](BPMN.md) | BPMN 2.0 XML основных процессов |
| [SECTION_II_ALGORITHM.md](SECTION_II_ALGORITHM.md) | Полный алгоритм парсинга АЗ и генерации таблицы Раздела II |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Размеры блоков/окон (px), сетка форм, стандарты цветов с кодами |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Замечания по коду и риски |

## Кратко о приложении

SPA «Сокол» (React 19 + Vite 7): проверки, рекомендации, аналитика, DOCX-инструменты, справочники, профиль. Данные — через `/api/v1` к `sokol-backend`. Auth — **stub** (localStorage), Keycloak планируется.

## Стек

| Пакет | Назначение |
|-------|------------|
| React 19 / React Router 7 | UI, маршруты |
| TanStack Query 5 | серверный кэш |
| Axios | HTTP |
| Tailwind 3 | стили (`sber` palette) |
| xlsx-js-style / docx / pdfmake | клиентский экспорт таблиц |
| lucide-react, react-datepicker | иконки, даты |

## Dev-порты (актуально)

| Сервис | Порт |
|--------|------|
| Vite UI | **5180** (`VITE_DEV_SERVER_PORT`) |
| API proxy target | **8802** (`VITE_DEV_API_PORT`) |

Прокси Vite: `/api` → `http://127.0.0.1:8802`. Backend должен слушать тот же порт (`run_dev.ps1`).
