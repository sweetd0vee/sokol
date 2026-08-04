# SOKOL Frontend — документация

Каталог описывает **актуальное** состояние UI (август 2026): архитектуру, пользовательские сценарии, запуск, BPMN, код-ревью и алгоритм генерации Раздела II.

## Что читать

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Структура, провайдеры, API-слой, компоненты, диаграммы |
| [USER_STORIES.md](USER_STORIES.md) | Пользовательские истории и потоки |
| [RUNBOOK.md](RUNBOOK.md) | Установка, env, Docker, проверки |
| [BPMN.md](BPMN.md) | BPMN 2.0 XML основных процессов |
| [SECTION_II_ALGORITHM.md](SECTION_II_ALGORITHM.md) | Полный алгоритм парсинга АЗ и генерации таблицы Раздела II |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Размеры блоков/окон (px), сетка форм, стандарты цветов |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Замечания по коду и риски |

## Кратко о приложении

SPA «Сокол» (React 19 + Vite 7): проверки, рекомендации, клиентская аналитика, DOCX-инструменты (Раздел II, ДЗ, аудиторское мнение), справочники, профиль. Заготовки: наблюдения, планирование, канцлер. Данные — через `/api/v1` к `sokol-backend` (кроме аналитики — считается на клиенте). Auth — **stub** (localStorage), Keycloak планируется.

Общие токены форм create/edit: `src/constants/formLayout.ts`.

## Стек

| Пакет | Назначение |
|-------|------------|
| React 19 / React Router 7 | UI, маршруты |
| TanStack Query 5 | серверный кэш |
| Axios | HTTP |
| Tailwind 3 | стили (`sber` palette) |
| Recharts | графики аналитики |
| xlsx-js-style / docx / pdfmake / html-to-image | клиентский экспорт |
| lucide-react, react-datepicker | иконки, даты |

## Dev-порты (актуально)

| Режим | UI | API |
|-------|----|-----|
| Локальная разработка | **5180** | **8802** (`VITE_DEV_API_PORT`) |
| Docker (коробка) | **5180** | **8800** (`VITE_API_URL`) |

Локально: прокси Vite `/api` → `http://127.0.0.1:8802`. Backend: `run_dev.ps1`.
