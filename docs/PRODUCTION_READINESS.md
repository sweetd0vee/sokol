# Что осталось до продакшена

**Дата снимка:** 4 сентября 2026  
**Go-live:** 15 сентября 2026, 09:00  
**Для кого:** разработка, сопровождение, владелец продукта.

Календарь и Go/No-Go — [PLAN.md](../PLAN.md). Этот документ отвечает на другой вопрос: **что ещё нужно сделать, чтобы SOKOL был не «пилот на стенде», а промышленным приложением**, с акцентом на backend и frontend.

Три горизонта:

| Горизонт | Срок | Смысл |
|----------|------|--------|
| **A. Go-live** | до 15.09 | Без этого нельзя открывать UAT/prod |
| **B. Промышленный контур** | сразу после 15.09, пока объём пилотный | Без этого продукт работает, но хрупкий: данные, доступ, сопровождение |
| **C. Идеальный продукт** | после стабилизации пилота | Полнота домена, UX, масштаб, интеграции |

Не начинаем C до закрытия A. B можно параллелить с UAT, если не ломает freeze 13–15.09.

---

## Уже готово — не трогать в этом спринте

Продуктовый контур пилота собран.

| Область | Состояние |
|---------|-----------|
| CRUD проверок и рекомендаций | REST, валидация справочников, RBAC, yearly №, ключ только с backend |
| Вложения | MinIO API, compensation, serial-bucket, UI banner / disabled upload / retry |
| Аналитика | SQL-агрегаты checks / recommendations / monitoring / dva / planning, матрицы |
| Инструменты | Раздел II, ссылки, ДЗ, parse-recommendations, файл контроля, очередь DOCX |
| Конструктор | `/constructor`, localStorage, Playwright smoke |
| Auth | JWT, lookup `is_active` из БД, Basic off в prod, слабый JWT-секрет в prod не стартует |
| Виды проверок | **форма и фильтры читают `/settings/check_kinds`** (`useCheckKindOptions`) |
| Канцлер | снят с nav и routes |
| Prod guards | `SOKOL_ENV=prod` блокирует demo load и `--replace` без `--confirm-prod-replace` |
| Экспорт таблиц | XLSX / PDF / DOCX / HTML на клиенте |
| Visual export | аналитика и планирование |

Закрыто относительно [ACTION_PLAN.md](ACTION_PLAN.md): **P0-03** (виды из справочника). Документы ревью от 04.09 ещё писали про `CHECK_VIEW_OPTIONS` — константы больше нет.

---

## A. Go-live — обязательно до 15.09

Это минимум из [PLAN.md](../PLAN.md). Без закрытия — No-Go.

### Код

| ID | Слой | Задача | Зачем | DoD |
|----|------|--------|-------|-----|
| P0-02 | FE | Метка limited/beta на `/planning` | Раздел в nav выглядит как полноценный модуль: нет месяца, нет аудиторов, coverage игнорирует фильтр департаментов | На странице и желательно в сайдбаре видно, что модуль ограниченный |
| P0-04 | BE / compose | Demo не грузится сам на UAT/prod | Root и `sokol-backend/docker/app` compose: `SOKOL_LOAD_DEMO_DATA:-1`. Guard срабатывает только при `SOKOL_ENV=prod` | UAT/prod: `SOKOL_ENV=prod` и `SOKOL_LOAD_DEMO_DATA=0`. Предпочтительно default `0` в compose; demo только явным opt-in |
| P0-06 | BE | Alembic baseline **или** подписанный порядок `migrate_*` | Схема = `create_all` + ad-hoc migrate. На пустой prod-БД нет history/rollback | `alembic upgrade head` на чистой БД **или** runbook порядка `BOOTSTRAP_MIGRATIONS`, прогнанный на пустом томе и подписанный |
| P0-07 | BE | Import `--dry-run --report` | Сейчас `import_seed_data` сразу пишет в БД | Команда не меняет БД и печатает ok/reject counts + CSV |
| P1-01 | ops / GitHub | Required CI checks | Workflow есть, merge без зелёного CI возможен | `Backend (Python 3.12)` и `Frontend (Node 22)` обязательны. Как включить: [CI.md](CI.md) |
| P1-02 | BE | Import не досоздаёт справочники | API CRUD валидирует labels; import делает `ensure_*` | Неизвестный аудитор / вид / департамент / оценка → reject в report, не silent insert |

### Эксплуатация и данные

| ID | Задача | DoD |
|----|--------|-----|
| P1-04 | Backup/restore drill PostgreSQL + MinIO | Restore PG на чистый том; MinIO volume/`mc mirror`; сверка `attachments`. Документы есть: [MINIO.md](MINIO.md), [ALEMBIC_AND_DATA.md](../sokol-backend/docs/ALEMBIC_AND_DATA.md) |
| P1-05 | UAT deploy checklist | `.env`, секреты, порты, DNS, TLS, CORS; `/api/v1/status` и UI открываются |
| P1-06 | Пилот 10–20 проверок | 3 карточки сверены бизнесом |
| P1-07 | Полная загрузка на UAT | Count API = freeze-файл |
| P1-08 | DOCX smoke на 2–3 эталонных АЗ | section-ii, section-ii-links, memorandum, parse-recommendations |
| P1-09 | Сквозной smoke 30 минут | Login → lists → create/edit check и recommendation → вложение → analytics → tools |
| P1-10 | Runbook сопровождения | Старт/стоп, логи, backup, restore, rollback, контакты, known limits |

Лимиты пилота, которые **не чиним до 15.09**, но обязаны быть в runbook: [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md).

---

## B. Backend — промышленный контур

CRUD и аналитика для пилота готовы (оценка ревью ~8.7). Ниже — дыры, из-за которых контур нельзя считать «просто идеальным».

### B1. Схема и данные — P0/P1

| ID | Задача | Почему это не «мелочь» | DoD |
|----|--------|------------------------|-----|
| BE-01 | Внедрить Alembic | Без history нельзя откатить схему, нельзя понять, какой стенд на какой ревизии | `alembic.ini` + baseline текущей схемы; entrypoint: `upgrade head`; `create_all` только в ephemeral tests |
| BE-02 | Import dry-run + reject (P0-07 / P1-02) | Тихий `ensure_*` разъезжает справочники относительно Settings | `--dry-run --report`; неизвестные labels — reject |
| BE-03 | HTTP-импорт Excel **или** жёсткий CLI-runbook | Сейчас bulk только CLI `python -m app.db.import_seed_data`. В банке это сделает не разработчик | Либо admin-endpoint с dry-run и отчётом, либо одностраничный runbook + кто запускает |
| BE-04 | Сверка после import | Нет команды «count и контрольные serial» | Скрипт: counts checks/recommendations, дубли serial, orphan attachments, неизвестные labels |

Схема сейчас: FK на **строковые labels**, не UUID. Массив `recommendations.audit_object` дублирует junction `recommendation_audit_objects`. Аналитика читает массив. Это работает на пилотном объёме; полная нормализация — горизонт C, не A.

`audit_types` в Settings **не связан** с `check_type` (planned/V/K ≠ КП/ВП/ПП). Не ломать ключ проверки до явного решения бизнеса.

### B2. Auth, пользователи, ИБ — P1

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| BE-10 | Users PATCH / deactivate / reset password | Только `GET` + `POST` (роль строго `auditor`). `is_active` есть в модели, из API/UI выключить нельзя | Admin: деактивация, сброс пароля, правка `display_name` / `aliases`. DELETE пользователя — только если нет ссылок, иначе deactivate |
| BE-11 | Политика пароля | Min **4** символа. Seed defaults `admin` / `auditor` | Prod: длина ≥ 10, не совпадает с username; seed defaults запрещены при `SOKOL_ENV=prod` (или обязателен override) |
| BE-12 | Смена пароля инвалидирует сессии | JWT 480 мин, logout только на клиенте, refresh нет | Короткий TTL **или** password-changed-at / token version в БД; смена пароля рвёт старые токены |
| BE-13 | Rate limit на login | Нет | 429 после N неудачных попыток с одного IP/username |
| BE-14 | CORS в prod | Пустой `SOKOL_CORS_ORIGINS` → `*` без credentials | В prod пустой список — **не стартовать**, как слабый JWT |
| BE-15 | Swagger в prod | `/docs` открыт | Выключить OpenAPI UI в prod или закрыть Basic/IP |
| BE-16 | HTTPS MinIO | `SOKOL_MINIO_SECURE` default false | На UAT/prod `true`, если MinIO не в docker-сети localhost |
| BE-17 | Audit log | Нет истории кто менял статусы, справочники, пользователей | Таблица событий: actor, entity, action, at. Минимум: login fail, user create/deactivate, dictionary mutate, check/recommendation delete, import |
| BE-18 | Upgrade legacy plaintext password | `verify_password` ещё принимает plaintext (миграция) | После первого успешного login перехешировать в pbkdf2; в prod отклонять plaintext-hashes |

OIDC/Keycloak — **не блокер 15.09**, если банк не выдал IdP. Заложить как B/C: не плодить кастомные роли, которые потом не смапятся на IdP.

`department_head` сейчас ∈ `ADMIN_ROLES` (как admin). Если бизнесу нужен «руководитель видит всё, но не удаляет проверки / не правит справочники» — это отдельное решение, не hotfix.

### B3. Надёжность API — P1

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| BE-20 | Readiness, не только liveness | `GET /status` → `{status: ok}` без проверки БД/MinIO | `/health/live` (процесс) и `/health/ready` (Postgres ping; MinIO — если включён) |
| BE-21 | Request id + structured logs | Нет prometheus / otel / request-id | `X-Request-ID` в ответ и в лог; JSON-логи в Docker |
| BE-22 | Идемпотентность тяжёлых tools | Повтор клика = второй job в очереди | Idempotency-Key **или** явный 409 «уже считается» |
| BE-23 | Прогресс DOCX job | Клиент 10 минут ждёт blob. 503 + `Retry-After` при переполнении очереди | Хотя бы `Retry-After` стабильно в ответе; лучше job id + `GET /tools/jobs/{id}` |
| BE-24 | Переходы статусов | API не ограничивает lifecycle | Согласовать с бизнесом матрицу (проверка, рекомендация, additional_status) и валидировать; иначе оставить явно «свободный» в runbook |
| BE-25 | List search на сервере | Query `search` есть, UI почти не использует: грузит 10000 и фильтрует сам | Пока объём < 10000 — ок. Контракт `skip/limit/search` не ломать. При росте — серверная пагинация обязательна |
| BE-26 | Batch recommendations | До 200, без progress | Для пилота ок. Большой replace из АЗ > 200 — резать чанками или поднять лимит осознанно |

### B4. Аналитика и отчёты — P1/P2

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| BE-30 | Planning: фильтр департаментов влияет на coverage | Backend считает охват по **всем** департаментам справочника; UI-фильтр на KPI охвата не действует | Либо починить SQL, либо убрать фильтр с этой карточки и написать в UI |
| BE-31 | Planning: аудиторы и месяц | API: `months` есть, `auditors` нет. UI месяца и аудиторов нет | Если модуль остаётся limited — задокументировать. Если «идеальный» — добавить `auditors` и считать месяц |
| BE-32 | Analytics читает `audit_object[]` | Junction уже есть, аналитика его не использует | Перевести агрегаты на junction; массив оставить как кэш или убрать |
| BE-33 | Drill-down | Клиент не может открыть список сущностей графика | `GET /analytics/.../items?` или reuse list API с теми же фильтрами |
| BE-34 | Серверные сохранённые отчёты / конструктор | Конструктор только localStorage | `GET/POST/PATCH/DELETE /dashboards` — горизонт C, контракт набросан в [CONSTRUCTOR.md](../sokol-frontend/docs/CONSTRUCTOR.md) |
| BE-35 | Кэш аналитики | Каждый фильтр = SQL по всей БД | При росте: materialized view или Redis. На пилоте 60 с staleTime на FE достаточно |
| BE-36 | Visual export на сервере | DOM capture на клиенте | Не делать до go-live. После: JSON виджетов + агрегаты → PDF/DOCX на backend |

### B5. Файлы и инструменты — P1

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| BE-40 | Результаты tools в MinIO (опционально) | Blob сразу в HTTP, temp cleanup | Для аудита «какой файл ушёл пользователю» — класть в bucket `tools-output` с TTL |
| BE-41 | Эталонные АЗ в CI | Golden unittest есть; живые банковские файлы — вручную | 2–3 обезличенных эталона в repo/fixtures + P1-08 протокол |
| BE-42 | MIME/антивирус вложений | 415 по MIME, вируса нет | На банковском контуре — согласовать с ИБ (ClamAV sidecar или внешний шлюз) |
| BE-43 | Retention вложений | Нет политики удаления | Срок хранения + кто имеет право purge |

### B6. Тесты backend

Сейчас ~200 unittest + DB integration в CI (`SOKOL_RUN_DB_INTEGRATION_TESTS=1`). Нет:

- миграционного теста «пустая БД → upgrade head → seed → import dry-run»;
- e2e бизнес-сценария login → create check → attach → analytics;
- контрактных тестов OpenAPI snapshot (не обязательно, но ловит случайный camelCase).

Минимум после Alembic: один integration-тест bootstrap на пустой БД.

---

## C. Frontend — промышленный контур и «идеал»

Сценарии аудитора закрыты (оценка ревью ~8.6). Ниже — то, что мешает считать UI законченным.

### C1. Честность продукта — P0/P1

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| FE-01 | Planning limited (P0-02) | `PlanningTab` — только заголовок «Планирование» | Badge/подзаголовок: ограниченный модуль; что не умеет (месяц, аудиторы, coverage) |
| FE-02 | Конструктор — клиентский задел | `localStorage` `sokol.constructor.library.v1`; нет шаринга между браузерами | До серверного API: явная пометка «только на этом компьютере». После API — см. BE-34 |
| FE-03 | Неизвестный URL → `/checks` | Нет страницы 404 | Либо 404 «раздел не найден», либо оставить redirect, но не для пользователя, который ждал Канцлер |
| FE-04 | Settings mutate без AdminGuard | Права внутри страницы через `isAdmin` | Auditor не видит опасные кнопки (уже так). Проверить, что URL `/settings` не выглядит сломанным для auditor |

### C2. Данные и списки — P1

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| FE-10 | Banner «показано N из M» | Bulk-fetch `limit=10000`, пагинация таблицы по 50, banner нет | Если `total` с API > загруженных — предупреждение. Иначе пользователь думает, что видит всё |
| FE-11 | Server pagination / search | Клиентский filter/sort после 10000 | Пока объём пилота < 10000 — не трогать. Контракт готовки: не сломать bulk-fetch до явного перехода |
| FE-12 | Фильтры аналитики, которые API уже умеет | `statuses`, `additionalStatuses`, `materialityLevels` в API, в сайдбаре нет. Месяц в API, в UI нет | Для «идеала»: вывести в сайдбар рекомендаций/мониторинга. Месяц — если бизнес просит |
| FE-13 | «Мои» только на клиенте | Сравнение ФИО JWT через `personMatch` | Ок для пилота. При однофамильцах — сверка с `username`, не только display name |
| FE-14 | Черновик формы проверки | Draft в state есть | `beforeunload` / «уйти без сохранения» на `/checks/:id/edit` и рекомендациях |
| FE-15 | Пользователи в профиле | Admin создаёт auditor. Нельзя выключить, сбросить пароль, завести `department_head` | Зеркало BE-10 |

### C3. UX инструментов и вложений — P1

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| FE-20 | Прогресс / очередь DOCX | Спиннер до 10 минут, без позиции в очереди | Текст: «файл в очереди, лимит N параллельных»; на 503 — показать Retry-After |
| FE-21 | Разбор ошибок parse-recommendations | Нестандартный АЗ → неполный JSON | Построчный preview (уже есть блок) + явный «проверьте глазами» перед batch |
| FE-22 | Storage banner | `useStorageStatus` сделан | Не регрессить: disabled upload + retry на форме проверки и рекомендации |

### C4. Аналитика, планирование, экспорт — P1/P2

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| FE-30 | Drill-down с графика в список | Нет | Клик по сегменту → `/checks` или `/recommendations` с предзаполненными фильтрами (нужен BE-33 или клиентский filter по загруженным 10000) |
| FE-31 | Live-виджеты конструктора | Снимок payload, лист устаревает | Хранить `kind + filters + layout`, при открытии перезапрашивать analytics |
| FE-32 | Visual export | `html-to-image` по DOM; off-screen карточки хрупкие | Короткий: перед экспортом монтировать карточки. Долгий: серверный отчёт (BE-36) |
| FE-33 | Экспорт конструктора из истории | Без открытого холста снимок пустой | Либо запретить пункт в меню, либо открывать холст и экспортировать (как сейчас) — подписать в UI |
| FE-34 | Planning coverage UX | Фильтр департаментов не влияет на охват | Вместе с BE-30: не оставлять «тихий» фильтр |

### C5. Оболочка, качество UI — P1/P2

| ID | Задача | Сейчас | DoD |
|----|--------|--------|-----|
| FE-40 | Route lazy loading | `AppRoutes` импортирует все вкладки статически; Vite chunk warning | `React.lazy` на analytics / constructor / tools / settings |
| FE-41 | ErrorBoundary | Нет | Обрыв вкладки не роняет всё приложение; кнопка «на главную» |
| FE-42 | Playwright в CI | 5 auth + constructor локально; в GitHub Actions нет | Job `e2e` или nightly. CRUD e2e (create check) — следующий шаг |
| FE-43 | A11y pass | Точечные `aria-*` на графиках, пагинации, конструкторе | Клавиатура: модалки, селекты, экспорт; фокус после ошибок формы |
| FE-44 | Адаптив | Десктоп (sidebar 224px, analytics filter 320px). Тёмной темы нет **намеренно** | Пилот — десктоп. Мобильный вид — не обещать |
| FE-45 | Аватары | Только localStorage | Либо оставить и написать в профиле «только в этом браузере», либо BE storage |
| FE-46 | Тосты / единый error | Часть форм — inline, часть — `getErrorMessage` | Один `ErrorState` паттерн на мутациях: 409/403/502 понятным русским |

Стандарты вёрстки уже есть: [UI_STANDARDS.md](../sokol-frontend/docs/UI_STANDARDS.md). Новые экраны не изобретают отступы и цвета.

### C6. Тесты frontend

- Vitest ~160 — держать: mappers, list filters, form payload, constructor library.
- Playwright: auth, constructor. Нет e2e «создать проверку → импорт из АЗ → увидеть в списке».
- Visual export и DOCX в браузере не автотестируются — ручной протокол P1-08/P1-09.

---

## D. Идеальный продукт (горизонт C) — после стабилизации

Не мешают 15.09. Нужны, если цель — «приложение просто идеальное», а не пилот.

| Приоритет | Backend | Frontend |
|-----------|---------|----------|
| P2 | OIDC/Keycloak | Login через IdP, без local password (кроме break-glass admin) |
| P2 | Server pagination + export-all | Списки и поиск без потолка 10000; banner N из M |
| P2 | CRUD наблюдений | Раздел/сущность Observation, связь с рекомендациями, участие в аналитике |
| P2 | Dashboards API | Конструктор как общий артефакт команды, права, шаринг |
| P2 | Materialized analytics / cache | Тяжёлые дашборды на полном архиве |
| P2 | FK UUID вместо labels | Меньше каскадных rename; миграция данных |
| P2 | Аналитика с junction, не с массива | Одна правда об объектах аудита |
| P3 | Интеграция СЭД Канцлер | Маршрут и nav только после контракта |
| P3 | Серверный visual export | Стабильные PDF/DOCX без html-to-image |
| P3 | История статусов в UI | Таймлайн на карточке рекомендации |
| P3 | Users: роли admin / department_head из UI | Когда RBAC разъедется с «оба = admin» |

Scope freeze до 15.09 это подтверждает: новые модули не начинаем.

---

## Безопасность — чеклист на cutover

Закрыто в коде: weak JWT не стартует в prod, Basic off, demo/replace guards, merge-only `sync_dictionaries`.

Осталось проверить руками на UAT:

1. `SOKOL_ENV=prod`, JWT ≥ 32 и не default.
2. `SOKOL_CORS_ORIGINS` = точный HTTPS origin UI, не `*`.
3. `SOKOL_LOAD_DEMO_DATA=0`.
4. Пароли seed сменены, defaults `admin`/`auditor` не живы.
5. Postgres и MinIO не доступны с пользовательской сети.
6. Swagger `/docs` закрыт или недоступен снаружи.
7. Backup/restore прогнан (P1-04).
8. HTTP с UI на API — только через TLS-прокси.

Пароль min 4 и JWT 8 часов — допустимо для закрытого пилота, **не** для «идеального» контура (BE-11, BE-12).

---

## Рекомендуемый порядок работ

```text
сейчас → 08.09     P0-02 planning badge
                   P0-04 compose demo default / UAT flags
                   P0-06 Alembic или подписанный migrate-runbook
                   P0-07 dry-run import

09.09 → 12.09      P1-01 CI required
                   P1-02 import reject справочников
                   P1-04 restore drill
                   DATA пилот + полная загрузка
                   P1-05 UAT URL/TLS/CORS

13.09 → 15.09      freeze: только P0/P1 баги
                   P1-08 DOCX smoke, P1-09 сквозной smoke, P1-10 runbook
                   Go/No-Go

после 15.09        B: users PATCH, пароли, readiness, CORS/Swagger prod,
                   audit log, planning coverage, ErrorBoundary, lazy routes
                   C: OIDC, pagination, наблюдения, конструктор API
```

Параллелить фронт и бек:

- FE-01 не зависит от Alembic — сделать в первый день.
- Import dry-run не зависит от UI.
- Users PATCH лучше сразу с FE-15, иначе API без экрана.

---

## Definition of Done «идеального» пилота

Не путать с DoD go-live. Это планка, к которой идём после 15.09.

**Backend**

- Схема только Alembic; пустой стенд поднимается одной командой.
- Import не портит справочники; dry-run обязателен перед боем.
- Пользователя можно создать, выключить, сбросить пароль.
- `/health/ready` смотрит на БД (и MinIO, если включён).
- Логи с request id; login rate-limited; CORS и Swagger закрыты в prod.
- Есть audit log критичных действий.

**Frontend**

- Ни один ограниченный модуль не выглядит законченным (planning, constructor).
- Списки честно говорят, если данных больше, чем загружено.
- Падение виджета не роняет приложение.
- Tools показывают очередь/ошибку, а не вечный спиннер.
- Критичные маршруты в Playwright CI.
- Analytics: фильтры, которые уже есть в API, доступны в UI; drill-down хотя бы в клиентский список.

**Ops**

- HTTPS URL, секреты не в git, backup/restore сверён, runbook у сопровождения.

---

## Связанные документы

| Документ | Роль |
|----------|------|
| [PLAN.md](../PLAN.md) | Календарь 01.09–15.09, Go/No-Go |
| [ACTION_PLAN.md](ACTION_PLAN.md) | Короткий список открытого из ревью |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Оценки блоков |
| [APP_LIMITS_AND_GOTCHAS.md](APP_LIMITS_AND_GOTCHAS.md) | Что пользователи примут за баги |
| [CI.md](CI.md) · [MINIO.md](MINIO.md) | Merge gate и файлы |
| [sokol-backend/docs](../sokol-backend/docs/README.md) | API, БД, storage, reports |
| [sokol-frontend/docs](../sokol-frontend/docs/README.md) | Архитектура, analytics, constructor, UI |
