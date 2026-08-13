# Лимиты и тонкости SOKOL

Документ для разработчиков, сопровождения и пользователей пилота. Здесь собраны ограничения, которые могут выглядеть как баги, если о них не знать заранее.

## Коротко

| Область | Текущий лимит / поведение | Что важно знать |
|---------|---------------------------|-----------------|
| Списки проверок и рекомендаций | До **10000** строк за один запрос | Для ожидаемого объёма пилота это полный набор данных. Если станет больше 10000, нужна server pagination/search. |
| Пользователи и справочники | До **200** строк через API endpoint | Для справочников нормально; при росте справочников надо расширять limit или добавлять поиск. |
| Загрузка файлов | `SOKOL_MAX_UPLOAD_MB`, default **100 МБ** | Лимит общий для DOCX tools и вложений; frontend берёт его из `/api/v1/capabilities`. |
| DOCX tools | Frontend ждёт ответ **120 секунд** | Большие/нестандартные `.docx` могут упереться в timeout или в память worker. |
| Ollama / audit opinion | Backend timeout default **600 секунд** | UI audit-opinion сейчас не является частью текущего frontend tools flow. |
| JWT session | `SOKOL_JWT_EXPIRE_MINUTES`, default **480 минут** | При 401 frontend очищает localStorage и разлогинивает пользователя. |
| Analytics cache | React Query `staleTime` обычно **60 секунд** | После изменения данных аналитика может обновиться не мгновенно. |
| Capabilities cache | Upload limits кешируются **5 минут** | При изменении `SOKOL_MAX_UPLOAD_MB` пользователь может увидеть старый лимит до refetch/reload. |
| Vite build | Есть warning о крупном bundle | Сейчас это ожидаемо из-за analytics/export зависимостей; route lazy loading в backlog. |

## Списки и объём данных

### Что загружается

Frontend `SokolDataContext` при входе пользователя загружает:

- `GET /api/v1/checks?limit=10000`
- `GET /api/v1/recommendations?limit=10000`

Backend endpoints принимают `limit` до `10000`. Это сделано осознанно: ожидаемый объём данных до 10000 рекомендаций считается небольшим для текущего пилота, поэтому UI работает с полным набором на клиенте.

### Что увидит пользователь

- Таблицы показывают все загруженные из базы проверки/рекомендации.
- Фильтры, сортировка, пагинация таблицы и экспорт работают по этим данным.
- Сообщения вида “Показано 1000 из 1175” быть не должно.

### Что может пойти не так

- Если в базе станет больше 10000 проверок или рекомендаций, текущий bulk-load уже не гарантирует полный набор.
- Большой набор данных увеличит время первого открытия после login и размер данных в памяти браузера.
- Клиентская сортировка/фильтрация на 10000 строк приемлема для пилота, но может стать заметно тяжелее на слабых рабочих станциях.

### Что делать при росте объёма

Если данных станет больше 10000 или пользователи начнут жаловаться на долгую загрузку:

1. Перевести `ChecksTab` и `RecommendationsTab` на server-side pagination/search.
2. Добавить явный export mode: “текущая страница” / “все записи через backend export”.
3. Для форм использовать точечные lookup endpoints (`GET by id`, поиск по serial), а не весь список.

## API limits

| Endpoint | Default | Max | Где задано |
|----------|---------|-----|------------|
| `GET /api/v1/checks` | 200 | 10000 | `sokol-backend/app/api/v1/endpoints/checks.py` |
| `GET /api/v1/recommendations` | 200 | 10000 | `sokol-backend/app/api/v1/endpoints/recommendations.py` |
| `GET /api/v1/users` | 50 | 200 | `sokol-backend/app/api/v1/endpoints/users.py` |
| Dictionary endpoints | 50 | 200 | `sokol-backend/app/api/v1/dictionary_router.py` |
| Attachments list | По entity | Не общий list | `sokol-backend/app/api/v1/endpoints/attachments.py` |

Практический вывод: большие доменные списки сейчас разрешены только для checks/recommendations. Пользователи и справочники рассчитаны на компактный набор.

## Файлы и MinIO

### Общий upload limit

Лимит размера файла задаётся через:

```bash
SOKOL_MAX_UPLOAD_MB=100
```

По умолчанию это 100 МБ. Backend также отдаёт лимит через:

```text
GET /api/v1/capabilities
```

Frontend использует этот endpoint в:

- `ToolsTab`
- `CheckAttachmentsSection`
- `FileAttachmentsPanel`

Если backend недоступен или capabilities ещё не загрузились, frontend использует fallback 100 МБ.

### DOCX tools

DOCX tools принимают только `.docx`:

- `POST /api/v1/tools/section-ii`
- `POST /api/v1/tools/section-ii-links`
- `POST /api/v1/tools/memorandum`
- `POST /api/v1/tools/parse-recommendations`

Тонкости:

- frontend timeout для DOCX tools: 120 секунд;
- backend читает upload в память, проверяет размер и пишет временный `.docx`;
- результат не сохраняется в MinIO, а сразу возвращается пользователю;
- очень большой или нестандартно размеченный `.docx` может обрабатываться долго или падать с ошибкой парсинга.

### Вложения

Вложения check/recommendation используют metadata в PostgreSQL и файл в MinIO/S3-compatible storage.

Что важно:

- MinIO должен быть настроен через `SOKOL_MINIO_*`;
- если MinIO не настроен, upload вложений вернёт 503;
- если MinIO недоступен во время операции, backend может вернуть 502;
- backend умеет компенсировать DB failure после upload и чистить object;
- при изменении serial проверки backend переносит bucket/object metadata.

Открытая UX-тонкость: frontend получает upload size limit, но общий banner “хранилище недоступно” ещё не везде выведен до попытки загрузки. Endpoint `GET /api/v1/attachments/storage/status` есть на backend.

## Auth и сессии

Текущий основной flow:

1. Login через `POST /api/v1/auth/login`.
2. Frontend хранит access token в `localStorage`.
3. Axios interceptor добавляет `Authorization: Bearer ...`.
4. При любом 401 вне login frontend очищает auth storage и отправляет пользователя на login.

Лимиты и настройки:

| Настройка | Значение по умолчанию | Комментарий |
|-----------|-----------------------|-------------|
| `SOKOL_JWT_EXPIRE_MINUTES` | 480 | TTL токена. |
| `SOKOL_JWT_SECRET` | dev default | В prod default/weak secret должен блокироваться guard'ом. |
| `SOKOL_AUTH_USERS` | пусто | Если пусто, используются dev users. |

Трудности:

- OIDC/Keycloak пока не реализован как основной flow.
- HTTP Basic fallback отмечен как риск для production: второй auth-flow сложнее контролировать.
- При ручной очистке localStorage пользователь будет разлогинен.
- Смена пароля подключена к backend endpoint, но при переходе на OIDC сценарий профиля нужно пересмотреть.

## CORS, порты и окружения

Локальный режим:

| Сервис | URL |
|--------|-----|
| Frontend | `http://localhost:5180` |
| Backend Swagger | `http://localhost:8802/docs` |
| PostgreSQL | `localhost:5433` |

Docker:

| Сервис | URL |
|--------|-----|
| Frontend | `http://localhost:5180` |
| Backend Swagger | `http://localhost:8800/docs` |
| PostgreSQL | `localhost:5433` |

Тонкости:

- Для локального frontend dev proxy нужен backend на `8802`.
- `VITE_DEV_API_PORT` влияет на Vite proxy только при запуске dev server.
- `VITE_API_URL` встраивается на build-time. Если поменять API URL для production UI, нужно пересобрать frontend.
- `SOKOL_CORS_ORIGINS` пустой означает `*`; для стендов лучше указывать точный origin UI.
- После изменения backend env обычно нужен restart backend.

## Analytics и export

Analytics dashboards получают агрегаты с backend и кешируют запросы примерно на 60 секунд через React Query.

Что важно пользователю:

- После редактирования данных аналитика может не обновиться мгновенно.
- Обновление страницы или смена фильтра обычно приводит к новому запросу.
- Planning export отключён.

Что важно разработчику:

- `exports.ts` и visual export остаются крупными и хрупкими зонами.
- Vite build предупреждает о большом bundle; это связано с analytics/export зависимостями.
- Route-level lazy loading и split exports находятся в backlog.
- DOM capture для визуальных export может ломаться при изменении layout/скрытых элементов.

## Справочники и валидация

Backend валидирует ряд строковых полей по справочникам при create/update. Но часть доменных связей хранится как текст, а не как физический FK.

Практические последствия:

- Импорт исторических Excel проще, но нормализация ФИО/подразделений критична.
- Переименование справочника не всегда автоматически переписывает старые строки в checks/recommendations.
- Пользовательские значения могут быть отклонены API, если их нет в справочнике.

## Ключ проверки и serial number

`serial_number` генерируется backend-only. Frontend не должен отправлять или пересчитывать его вручную.

Тонкости:

- При изменении даты/руководителя/типа проверки backend может пересчитать serial.
- Backend синхронизирует serial в рекомендациях и attachments metadata.
- Для редких массовых пересчётов нужен отдельный runbook и backup.

## DOCX parsing и импорт рекомендаций из АЗ

Импорт рекомендаций из АЗ зависит от структуры документа.

Что может пойти не так:

- `.docx` нестандартной структуры может распарситься неполно или не распарситься.
- Даты должны распознаваться в ожидаемом формате.
- Названия объектов аудита проходят canonicalization по справочникам.
- Batch import рекомендаций атомарен на backend, но пользователь всё равно должен проверять результат глазами.

## Ошибки, которые выглядят похожими

| Симптом | Частая причина | Что проверить |
|---------|----------------|---------------|
| `ECONNREFUSED` / “Не удалось связаться с API” | Backend не запущен или не тот порт | `http://localhost:8802/docs` для dev, `8800` для Docker |
| 401 после работы в UI | Истёк/сброшен JWT | Перелогиниться |
| 413 при upload | Файл больше `SOKOL_MAX_UPLOAD_MB` | `/api/v1/capabilities`, размер файла |
| 502/503 при вложениях | MinIO недоступен или не настроен | `SOKOL_MINIO_*`, backend logs, `/attachments/storage/status` |
| DOCX tool висит/падает | Большой файл, сложная структура, backend timeout/memory | Размер, формат `.docx`, backend logs |
| CORS error | Origin UI не разрешён backend | `SOKOL_CORS_ORIGINS`, restart API |
| В таблице нет новой записи | React Query cache или ошибка refetch | Обновить страницу, проверить network/API |
| Build warning про chunk | Большой frontend bundle | Это известный P2 backlog, не runtime-ошибка |

## Что нужно перезапускать после изменений

| Изменение | Что перезапустить |
|-----------|-------------------|
| Backend env (`SOKOL_*`, `DATABASE_URL`) | Backend process/container |
| Frontend env (`VITE_*`) | Dev server; для production — пересборка UI |
| Backend code | Backend process/container |
| Frontend code | Vite dev подхватит HMR; для production — build/deploy |
| Docker compose env/volumes | Соответствующие containers |

## Что проверять перед показом пользователю

Минимальный smoke:

1. Login.
2. Открыть список проверок и рекомендаций.
3. Проверить, что количество рекомендаций больше 1000 отображается без banner про усечение.
4. Создать/отредактировать проверку.
5. Создать/отредактировать рекомендацию.
6. Загрузить и скачать вложение, если MinIO включён.
7. Запустить DOCX tool на эталонном `.docx`.
8. Открыть analytics dashboards.
9. Выполнить table export.

Команды качества:

```bash
cd sokol-frontend && npm run lint && npm test && npm run build
cd sokol-backend && py -3.12 -m compileall app tests
cd sokol-backend && py -3.12 -m unittest discover -s tests -p "test_*.py" -v
```

## Когда менять архитектуру

Текущее решение подходит для пилота с ограниченным объёмом. Архитектурные изменения нужны, если:

- checks/recommendations стабильно больше 10000;
- первый экран после login грузится заметно долго;
- браузер тормозит при фильтрации/сортировке;
- export должен гарантированно включать все записи независимо от текущего UI state;
- DOCX tools начинают обрабатывать много файлов параллельно;
- MinIO становится критичным для production и нужен полноценный storage health UX;
- требуется OIDC/SSO вместо internal JWT.

