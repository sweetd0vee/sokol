# Гайд по коду проекта SOKOL

Этот документ помогает быстро понять проект, если ты новый разработчик и только начинаешь читать код. Он не заменяет подробную документацию backend/frontend, а дает карту: где что лежит, как данные проходят через систему и с каких файлов начинать.

## Что делает проект

SOKOL - внутренний инструмент аудита. В нем ведут проверки, рекомендации по проверкам, вложения, справочники, аналитику и DOCX-инструменты для аудиторских документов.

Основной стек:

- `sokol-frontend` - React 19 + TypeScript + Vite, пользовательский интерфейс.
- `sokol-backend` - FastAPI + async SQLAlchemy + PostgreSQL, API и бизнес-логика.
- `sokol-instruments` - старый Streamlit-прототип. Для новой разработки обычно не используется.
- `docs` - общая документация по проекту, код-ревью и план действий.

## Как читать проект сверху вниз

Начинай не с отдельных функций, а с пользовательского сценария.

Например, пользователь открывает список проверок:

1. Браузер открывает frontend на `http://localhost:5180`.
2. React-роутер показывает страницу `/checks`.
3. `SokolDataProvider` загружает проверки через `src/api/checks.ts`.
4. Axios-клиент добавляет JWT-токен в заголовок `Authorization`.
5. Backend принимает запрос `GET /api/v1/checks`.
6. Endpoint вызывает service-слой.
7. Service вызывает CRUD-функции.
8. CRUD делает SQL-запрос через async SQLAlchemy.
9. PostgreSQL возвращает данные.
10. Backend отдает JSON, frontend превращает его в TypeScript-типы и рисует таблицу.

Главная идея: экран не ходит в базу напрямую. Экран вызывает frontend API-клиент, клиент вызывает backend endpoint, endpoint вызывает бизнес-логику, бизнес-логика работает с БД и хранилищем.

## Структура репозитория

```text
sokol/
├── README.md                 # быстрый старт и общая карта проекта
├── DOCKER.md                 # запуск через Docker
├── docs/                     # общие документы проекта
├── sokol-backend/            # FastAPI backend
├── sokol-frontend/           # React frontend
└── sokol-instruments/        # legacy Streamlit-инструменты
```

Для ежедневной разработки чаще всего нужны только `sokol-backend` и `sokol-frontend`.

## Backend: что где лежит

Backend стартует из `sokol-backend/app/main.py`.

Ключевые папки:

- `app/main.py` - создает FastAPI-приложение, подключает CORS и общий API-роутер.
- `app/api/router.py` - подключает версию API из `app/api/v1/router.py`.
- `app/api/v1/endpoints/` - HTTP endpoints: auth, checks, recommendations, analytics, attachments, tools, справочники.
- `app/api/deps.py` - зависимости FastAPI: текущий пользователь, JWT/Bearer auth, проверка ролей.
- `app/core/` - настройки, роли, безопасность, JWT.
- `app/db/session.py` - async engine и `AsyncSession` для SQLAlchemy.
- `app/models/` - ORM-модели таблиц PostgreSQL.
- `app/schemas/` - Pydantic-схемы входных и выходных JSON.
- `app/services/` - бизнес-логика: проверки, рекомендации, вложения, аналитика, DOCX-отчеты.
- `app/crud/` - низкоуровневые операции с БД.
- `tests/` - backend-тесты.

### Backend request flow

Типовой путь запроса:

```text
HTTP request
→ app/api/v1/endpoints/*.py
→ app/services/*.py
→ app/crud/*.py
→ app/models/*.py
→ PostgreSQL
```

Пример для проверок:

- Frontend вызывает `GET /api/v1/checks`.
- Запрос попадает в `app/api/v1/endpoints/checks.py`.
- Endpoint вызывает `checks_service.list_checks`.
- Service вызывает `checks_crud.list_checks` и `checks_crud.count_checks`.
- CRUD строит SQLAlchemy-запрос к модели `Check`.
- Ответ возвращается как `CheckListResponse`.

### Где живут основные сущности

`Check` в `app/models/checks.py` - проверка. У нее есть ключ `serial_number`, название, тип, вид, даты, руководитель, статус и служебные поля документов.

`Recommendation` в `app/models/recommendations.py` - рекомендация по проверке. Она связана с проверкой через `check_id` и дополнительно хранит `serial_number` проверки для удобства поиска и отображения.

`Attachment` в `app/models/attachments.py` - вложение. Файл лежит в MinIO, а в PostgreSQL хранится метаинформация: к какой сущности относится файл, bucket, object key, имя, тип и размер.

Справочники лежат отдельными моделями: аудиторы, подразделения, типы аудита, виды проверок, оценки эффективности.

### Auth и роли

Авторизация устроена через JWT.

- Login идет через endpoint auth.
- Frontend сохраняет токен в `localStorage`.
- Axios добавляет `Authorization: Bearer <token>`.
- Backend зависимость `get_current_user` декодирует токен и находит пользователя.
- `require_admin` ограничивает опасные операции, например удаление проверок, рекомендаций и вложений.

Поэтому при чтении endpoint всегда смотри на `Depends(...)`: там часто видно, нужна ли авторизация или роль admin.

### Проверки

Проверки - один из центральных доменов.

Важные файлы:

- `sokol-frontend/src/components/tabs/ChecksTab.tsx` - список проверок, фильтры, сортировка, пагинация, экспорт.
- `sokol-frontend/src/components/checks/CheckFormPage.tsx` - форма создания/редактирования.
- `sokol-frontend/src/api/checks.ts` - frontend API-клиент проверок.
- `sokol-backend/app/api/v1/endpoints/checks.py` - HTTP API проверок.
- `sokol-backend/app/services/checks_service.py` - service-слой.
- `sokol-backend/app/crud/checks_crud.py` - SQLAlchemy-запросы.
- `sokol-backend/app/models/checks.py` - таблица `checks`.

Особенность: `serial_number` генерируется на backend. Frontend не должен сам придумывать ключ проверки. Если меняются поля, влияющие на ключ, backend может пересчитать ключ и обновить связанные рекомендации и вложения.

### Рекомендации

Рекомендации привязаны к проверке.

Важные файлы:

- `sokol-frontend/src/components/tabs/RecommendationsTab.tsx` - список рекомендаций.
- `sokol-frontend/src/components/recommendations/RecommendationFormPage.tsx` - форма рекомендации.
- `sokol-frontend/src/components/checks/CheckRecommendationsBlock.tsx` - рекомендации внутри карточки проверки.
- `sokol-frontend/src/api/recommendations.ts` - frontend API-клиент.
- `sokol-backend/app/api/v1/endpoints/recommendations.py` - HTTP API.
- `sokol-backend/app/services/recommendations_service.py` - создание, batch-сохранение, обновление, удаление.
- `sokol-backend/app/crud/recommendations_crud.py` - SQLAlchemy-запросы.
- `sokol-backend/app/models/recommendations.py` - таблица `recommendations`.

У рекомендаций есть обычный CRUD и batch-операция. Batch нужен, когда frontend добавляет или заменяет список рекомендаций для конкретной проверки, например после парсинга из аудиторского заключения.

### Вложения

Вложения используют два хранилища:

- PostgreSQL хранит metadata.
- MinIO хранит сами файлы.

Важные файлы:

- `sokol-frontend/src/api/attachments.ts` - загрузка, список, скачивание, удаление.
- `sokol-backend/app/api/v1/endpoints/attachments.py` - HTTP API вложений.
- `sokol-backend/app/services/attachments_service.py` - проверки слотов, размера, content-type и работа с MinIO.
- `sokol-backend/app/services/storage/minio_storage.py` - низкоуровневая работа с MinIO.
- `sokol-backend/app/models/attachments.py` - metadata вложений.

У вложений есть `entity_type`: файл может относиться к проверке или к рекомендации. Для рекомендации backend сначала находит связанную проверку, потому что bucket строится вокруг ключа проверки.

### Аналитика

Аналитика считается на backend и отдается готовыми агрегатами.

Важные файлы:

- `sokol-backend/app/api/v1/endpoints/analytics.py` - endpoints аналитики.
- `sokol-backend/app/services/analytics/` - расчет метрик.
- `sokol-frontend/src/api/analytics.ts` - frontend API-клиент.
- `sokol-frontend/src/components/tabs/AnalyticsTab.tsx` - общая вкладка аналитики.
- `sokol-frontend/src/components/analytics/` - dashboard-компоненты.

Основные endpoints: `checks`, `recommendations`, `monitoring`, `dva`, `planning`.

### DOCX-инструменты

DOCX-инструменты работают на backend. Они принимают `.docx`, разбирают документ и возвращают обработанный файл или распарсенные данные.

Важные файлы:

- `sokol-backend/app/api/v1/endpoints/instruments_reports.py` - HTTP endpoints инструментов.
- `sokol-backend/app/services/reports/section_ii/` - логика раздела II.
- `sokol-backend/app/services/reports/memorandum/` - докладная записка и парсинг рекомендаций.
- `sokol-frontend/src/components/tabs/ToolsTab.tsx` - экран инструментов.
- `sokol-frontend/src/api/tools.ts` - frontend API-клиент инструментов.

Старый вариант похожей логики лежит в `sokol-instruments`, но новая разработка должна идти через backend-сервисы.

## Frontend: что где лежит

Frontend стартует из `sokol-frontend/src/App.tsx`.

Ключевые папки:

- `src/App.tsx` - провайдеры и маршруты приложения.
- `src/api/` - все HTTP-запросы к backend, axios-клиент и mappers.
- `src/components/` - страницы и UI-компоненты.
- `src/contexts/` - глобальные контексты: auth и данные SOKOL.
- `src/hooks/` - переиспользуемые React-хуки.
- `src/types/` - TypeScript-типы доменных сущностей.
- `src/constants/` - статусы, опции форм, CSS-классы.
- `src/utils/` - форматирование дат, экспорт, аналитические helpers.

### Frontend app flow

В `App.tsx` приложение оборачивается в провайдеры:

```text
QueryClientProvider
→ AuthProvider
→ SokolDataProvider
→ BrowserRouter
→ Routes
```

Что это значит:

- `QueryClientProvider` дает React Query для кеширования запросов.
- `AuthProvider` хранит пользователя, токен и роль.
- `SokolDataProvider` загружает общие данные: проверки и рекомендации.
- `BrowserRouter` выбирает экран по URL.

### Маршруты

Основные маршруты:

- `/login` - вход.
- `/checks` - список проверок.
- `/checks/new` и `/checks/:id/edit` - форма проверки.
- `/recommendations` - список рекомендаций.
- `/recommendations/new` и `/recommendations/:id/edit` - форма рекомендации.
- `/analytics` - аналитика.
- `/planning` - планирование.
- `/tools` - DOCX-инструменты.
- `/settings` - справочники, доступ к изменению ограничен admin.
- `/profile` - профиль.
- `/kantsler` - заглушка.

Все основные маршруты закрыты `AuthGuard`. `SettingsTab` дополнительно закрыт `AdminGuard`.

### Frontend API layer

Весь frontend ходит в backend через `src/api`.

Главный файл - `src/api/client.ts`:

- создает axios instance;
- выставляет `baseURL`;
- добавляет Bearer-токен;
- при `401` очищает auth-состояние и отправляет событие logout;
- корректно пропускает multipart upload для файлов.

Доменные файлы API:

- `checks.ts` - проверки.
- `recommendations.ts` - рекомендации и парсинг рекомендаций из DOCX.
- `attachments.ts` - вложения.
- `analytics.ts` - аналитика.
- `settings.ts` - справочники.
- `tools.ts` - DOCX-инструменты.
- `auth.ts` - login и текущий пользователь.
- `mappers.ts` - преобразование backend JSON в frontend-типы и обратно.

Если нужно добавить новый backend endpoint, почти всегда нужно добавить рядом frontend-функцию в `src/api`.

### Где хранится состояние

В проекте нет Redux или Zustand. Используются React Context, React Query и локальный state компонентов.

- Auth-состояние: `AuthContext`.
- Общие проверки и рекомендации: `SokolDataProvider`.
- Кеш запросов: React Query.
- Фильтры, сортировки, открытые модалки: `useState` внутри компонентов.

Например, `ChecksTab` берет `checks` из `useSokolData()`, а затем уже на клиенте фильтрует, сортирует и разбивает их по страницам.

## Как добавить новую фичу

Для простой CRUD-фичи порядок обычно такой:

1. Backend model: добавить или изменить ORM-модель в `app/models`.
2. Backend schema: описать вход/выход в `app/schemas`.
3. Backend CRUD: добавить SQLAlchemy-запросы в `app/crud`.
4. Backend service: описать бизнес-правила в `app/services`.
5. Backend endpoint: открыть HTTP API в `app/api/v1/endpoints`.
6. Router: подключить endpoint в `app/api/v1/router.py`, если это новый модуль.
7. Frontend types: добавить TypeScript-типы в `src/types`.
8. Frontend API: добавить функции в `src/api`.
9. Frontend UI: добавить экран или компонент в `src/components`.
10. Tests: добавить backend/frontend тесты на самое рискованное поведение.

Если фича меняет существующую сущность, сначала найди все места, где она используется: model, schema, mapper, API-клиент, форма, список, экспорт, аналитика.

## Как запускать

Backend:

```powershell
cd sokol-backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .secrets\sokol.env.example .secrets\sokol.env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
```

Frontend:

```powershell
cd sokol-frontend
npm install
npm run dev
```

Открыть UI: `http://localhost:5180`.

Swagger backend: `http://localhost:8802/docs`.

Dev-логины из README: `admin`/`admin` и `auditor`/`auditor`.

## Как запускать проверки качества

Frontend:

```powershell
cd sokol-frontend
npm run lint
npm test
npm run build
```

Backend:

```powershell
cd sokol-backend
python -m compileall app tests
py -3.12 -m unittest discover -s tests
```

## С чего начать junior-разработчику

Хороший порядок чтения:

1. `README.md` в корне - понять запуск и возможности.
2. `sokol-frontend/src/App.tsx` - увидеть маршруты и провайдеры.
3. `sokol-frontend/src/api/client.ts` - понять, как frontend общается с backend.
4. `sokol-frontend/src/contexts/SokolDataContext.tsx` - понять общую загрузку проверок и рекомендаций.
5. `sokol-backend/app/main.py` - понять старт backend.
6. `sokol-backend/app/api/v1/router.py` - увидеть все API-разделы.
7. `sokol-backend/app/api/v1/endpoints/checks.py` - прочитать простой endpoint.
8. `sokol-backend/app/services/checks_service.py` и `app/crud/checks_crud.py` - увидеть service и SQLAlchemy.
9. `sokol-backend/app/models/checks.py` и `app/models/recommendations.py` - понять основные таблицы.
10. После этого читать конкретную фичу, которую нужно менять.

## Частые ориентиры в коде

Если нужно понять, почему не работает экран:

- смотри компонент в `src/components`;
- потом функцию запроса в `src/api`;
- потом endpoint в `app/api/v1/endpoints`;
- потом service и CRUD;
- затем модель и данные в БД.

Если не сходятся поля frontend/backend:

- смотри `src/api/mappers.ts`;
- смотри Pydantic-схему в `app/schemas`;
- смотри ORM-модель в `app/models`.

Если проблема с правами:

- смотри `AuthContext`, `AuthGuard`, `AdminGuard` на frontend;
- смотри `app/api/deps.py` и `require_admin` на backend.

Если проблема с файлами:

- смотри `attachments.ts` на frontend;
- смотри `attachments.py`, `attachments_service.py` и `minio_storage.py` на backend;
- проверь MinIO-настройки в env.

Если проблема с аналитикой:

- смотри `src/api/analytics.ts`;
- смотри нужный dashboard в `src/components/analytics`;
- смотри `app/api/v1/endpoints/analytics.py`;
- смотри соответствующий файл в `app/services/analytics`.

## Главное правило

Не пытайся сразу понять весь проект целиком. Выбери один сценарий, например создание проверки, и пройди его от кнопки на frontend до записи в PostgreSQL. После двух-трех таких сценариев структура проекта станет намного понятнее.
