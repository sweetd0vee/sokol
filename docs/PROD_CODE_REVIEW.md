# Код-ревью перед продакшеном

Снимок **30.09.2026**. Повторный проход по backend (`sokol-backend`) и frontend (`sokol-frontend`), Docker и CI. Краткий статус-скоринг — [REVIEW.md](REVIEW.md). Этот документ — **детальный остаток работ** с причинами.

## Контекст и границы

| Условие | Решение |
|---------|---------|
| Контур | Внутренний пилот одного департамента аудита (~15 человек), доступ за VPN |
| Чтение данных | **Осознанно общее**: любой вошедший видит все проверки, рекомендации и дашборды |
| Запись | Режется ролями (`auditor` / `department_head` / `admin`) через `ensure_user_can_manage_*` |
| Demo | Compose default `SOKOL_LOAD_DEMO_DATA=0`; в `SOKOL_ENV=prod` demo и seed-replace запрещены |
| Swagger | В prod `/docs`, `/redoc`, `/openapi.json` выключены |
| Postgres / MinIO | Порты на хост **не** публикуются; доступ только из сети Docker `sokol` |
| Бэкапы | Сервис `backup`, 00:05 Europe/Moscow, 14 дней, том `~/docker-share/sokol-backups` |
| Freeze (не ломать без золотых тестов) | автостатус, SQL аналитики, парсер Раздела II, `person_match`, каскад serial, section id экспорта |

**Вердикт:** для пилота за VPN продукт можно выкатывать после **операционного чеклиста** и закрытия короткого списка блокер-находок ниже. Открытый интернет-контур — нет.

---

## Что уже в порядке (не требует реализации)

- Слои API: endpoint → service → CRUD; CRUD не коммитит (`tests/test_crud_layer_boundary.py`).
- Роль на каждый запрос читается из БД, не из JWT claim.
- Prod startup: слабый JWT, demo-load, seed-replace → отказ старта.
- Ошибки домена → `{detail}` без traceback; request-id; JSON-логи в prod; `/metrics` Prometheus.
- Вложения: whitelist слотов и content-type, лимит размера, UI-баннер статуса MinIO.
- DOCX tools: temp upload + очередь слотов (`docx_queue`) с 503 + `Retry-After`.
- Frontend: `AuthGuard` / `AdminGuard`, lazy-роуты, ErrorBoundary, аналитика с серверных SQL API.
- CI: backend unittest + Postgres integration; frontend lint/Vitest/build/Playwright (API замокан).

---

## Сводная таблица: что осталось до прода

Легенда severity:

| Уровень | Смысл |
|--------|--------|
| **blocker** | Без этого нельзя честно называть стенд «прод» (даже за VPN — см. колонку «Пилот») |
| **should-fix** | Для пилота можно стартовать с риском; закрыть в ближайший цикл |
| **nice** | Улучшение; не держит выкат пилота |
| **ops** | Не код, а действие на стенде / в GitHub / сети |

| ID | Сторона | Что | Почему важно | Severity | Пилот VPN | Действие | Effort |
|----|---------|-----|--------------|----------|-----------|----------|--------|
| **FE-SEC-03** | FE | Docker UI крутит `npm run dev` (`sokol-frontend/docker/Dockerfile`) | Dev-сервер, HMR, исходники на `:5180` — это не prod-артефакт | **blocker** | **да** | Multi-stage: `npm run build` + nginx/static, CSP headers | M |
| **SEC-01** | BE | `verify_password` принимает legacy plaintext (`app/core/security.py`) | Утечка `password_hash` = рабочие пароли для немигрированных строк | **blocker** | **да** | В prod отклонять non-`pbkdf2_sha256$`; мигрировать хеши | S |
| **SEC-05** | BE | `python-multipart==0.0.9` | Известные DoS CVE на multipart (upload/tools) | **blocker** | **да** | Обновить до ≥0.0.27 и прогнать upload/tools тесты | S |
| **OPS-A** | Ops | Env не заточен под prod | Без `SOKOL_ENV=prod`, своего JWT (≥32), явного CORS и своих seed-паролей стенд стартует «как dev» | **ops / blocker** | **да** | Заполнить `.env`; demo/replace выключены | S |
| **OPS-B** | Ops | В БД могут остаться plaintext пароли | Код всё ещё примет их (SEC-01), пока строки не PBKDF2 | **ops / blocker** | **да** | Сверить/перехешировать всех users | S |
| **OPS-C** | Ops | Restore drill не зафиксирован | Бэкап есть, но восстановление не доказано | **ops** | **да** | Один restore на копии стенда → запись в runbook | M |
| **OPS-D** | Ops | Required CI checks не включены в GitHub | Красный CI не блокирует merge | **ops** | желательно | Branch protection: Backend + Frontend jobs | S |
| **SEC-02** | BE | Пустой `SOKOL_CORS_ORIGINS` → `*` (`config.py`) | Prod **не** падает на `*`; любой origin может бить API с Bearer | **blocker** без VPN/same-origin proxy; иначе should-fix | при явном CORS — ок | В prod запретить `*` / пустой CORS на старте | S |
| **SEC-03** | BE | Нет rate limit на `/auth/login` | Перебор паролей (особенно при дефолтных seed) | should-fix за VPN; **blocker** если API снаружи | желательно | Лимит на proxy/WAF или backoff в приложении | S–M |
| **SEC-04** | BE | Дефолты seed `admin`/`auditor`, MinIO/Postgres `change-me` | Первый sync создаёт слабые учётки, если env не сменили | **ops** + should-fix в коде | **да** (env) | Свои пароли; опционально prod-guard на дефолты | S |
| **SEC-06** | BE | JWT TTL 480 мин, logout только на клиенте | Украденный токен живёт долго | should-fix | нет | Укоротить TTL в prod (30–60 мин) | S |
| **SEC-07** | BE | Мин. длина пароля = 4 | Слабые пароли через UI/API | should-fix | нет | Поднять минимум (например 8) | S |
| **FE-SEC-01** | FE | JWT в `localStorage` (`authSession.ts`) | XSS = полный захват сессии | accepted risk за VPN; **blocker** open contour | принято | HttpOnly cookie / OIDC позже; до этого — жёсткий CSP | L |
| **FE-SEC-02** | FE | Роль в UI из login+storage, без `/me` | Подмена storage открывает admin UI (API всё равно откажет запись) | should-fix | нет | При старте сверка роли с API | M |
| **DATA-01** | BE | ~~Нет Alembic~~ → **закрыто 30.09.2026** (`alembic/`, baseline `20260930_0001`, `ensure_schema`) | Версионирование схемы | ~~should-fix~~ **done** | — | Новые изменения только через `alembic revision` | — |
| **DATA-02** | BE | Import Excel `ensure_*` досоздаёт справочники | Плохой Excel тихо портит словари (в отличие от UI CRUD) | should-fix | нет | `--strict` / dry-run reject report | M |
| **DATA-04** | BE | MinIO delete до `commit` (check/attachments) | Rollback БД после удаления объектов → потеря файлов | should-fix | нет | Удалять объекты после успешного commit | M |
| **DATA-03** | BE | Нет UNIQUE(`check_id`,`sequence_number`) | Гонка двух create → дубликаты sequence | should-fix | нет при низкой нагрузке | Unique + lock | M |
| **DATA-06** | BE | Ночной refresh грузит все checks/recs в память | Рост таблиц → пик RAM в том же процессе, что API | should-fix | нет при ~15×5 лет | Batch / `yield_per` | M |
| **FE-UX-01** | FE | Списки `limit: 10000`, `total` не сверяется | Тихая обрезка данных выше 10k | should-fix | нет при текущем объёме | Warn по `total`; потом pagination | L |
| **FE-UX-02** | FE | Analytics KeepAlive держит посещённые вкладки | Рост RAM после обхода дашбордов | should-fix | нет | Unmount / лимит keep-alive | S |
| **FE-UX-03** | FE | `requestId` не показывается в UI | Нельзя быстро свести ошибку с логами API | should-fix | желательно | Показать «Код запроса» на ErrorState | S |
| **FE-OPS-01** | FE | `VITE_ERROR_REPORT_URL` не задан | Клиентские падения только в console | should-fix | желательно | Beacon/Sentry URL в prod | S–M |
| **FE-OPS-02** | FE | У Axios нет default timeout | Зависший API → вечный spinner | should-fix | желательно | Timeout 30–60s (tools — отдельно) | S |
| **OPS-01** | Ops | API наружу `:8800`, TLS только на gateway | Без reverse proxy трафик plain HTTP | ops | **да** | VPN и/или TLS proxy; задокументировать | S |
| **OPS-02** | Ops | Бэкапы рядом с данными на том же хосте | Потеря хоста = данные + бэкапы | ops | **да** | Копия снимков off-host | S |
| **CODE-01** | BE | Login/auth: полный `list_users` + линейный поиск | Медленнее с ростом users | nice | нет | Lookup по username/alias | M |
| **CODE-02** | BE | Attachment upload `file.read()` целиком в RAM | Пик памяти на больших файлах | nice / should-fix | нет | Stream в MinIO | M |
| **SEC-08** | BE | Aliases без уникальности | Два пользователя с одним alias → неоднозначный login | should-fix | нет | Уникальность username∪aliases | M |
| **SEC-09** | BE | `/status` и `/metrics` без auth | Утечка метрик/env флагов | nice за VPN | нет | Закрыть сетью / scrape token | S |
| **FE-UX-06** | FE | `/planning` без метки limited | Выглядит как полный модуль | nice | нет | Badge «ограниченный» | S |
| **FE-OPS-03** | FE | Playwright только с моком API | Регресс FE↔BE не ловится CI | nice | нет | Опциональный smoke против живого API | M |
| **OPS-05** | BE | Нет API deactivate/delete user | Offboarding через SQL | nice | нет | Admin deactivate | M |

---

## Блокеры пилота (сделать до выката)

### 1. FE-SEC-03 — UI Docker = Vite dev

**Где:** `sokol-frontend/docker/Dockerfile` → `CMD npm run dev`.

**Почему:** на «проде» отдаётся режим разработки, а не собранный бандл. Это и безопасность (лишняя поверхность), и нестабильность.

**Сделать:** образ `build` → nginx (или аналог) со static; `VITE_API_URL` на этапе build/runtime.

### 2. SEC-01 — plaintext пароли всё ещё валидны

**Где:** `app/core/security.py` → `_verify_legacy_plaintext`.

**Почему:** чеклист «только PBKDF2» не выполняется кодом. При дампе БД старые строки = открытые пароли.

**Сделать:** в `SOKOL_ENV=prod` не принимать legacy; заранее перегнать всех users на PBKDF2.

### 3. SEC-05 — старый python-multipart

**Где:** `sokol-backend/requirements.txt` → `python-multipart==0.0.9`.

**Почему:** multipart используется uploads и tools; известные DoS.

**Сделать:** bump + регресс upload/tools.

### 4. Ops-чеклист стенда

| Шаг | Зачем |
|-----|--------|
| `SOKOL_ENV=prod` | Включает guards, выключает docs/Basic default |
| Свой `SOKOL_JWT_SECRET` (≥32, не дефолт) | Иначе API не стартует / слабая подпись |
| Явный `SOKOL_CORS_ORIGINS` (не `*`) | Иначе любой browser origin |
| `SOKOL_LOAD_DEMO_DATA=0`, без replace | Нет синтетики на боевых данных |
| Свои `SOKOL_ADMIN_PASSWORD` / `SOKOL_DEFAULT_USER_PASSWORD`, MinIO, Postgres | Дефолты `admin`/`auditor`/`change-me` |
| Все `users.password_hash` = PBKDF2 | Закрывает SEC-01 на данных |
| UI/API только через VPN (или TLS proxy) | Порты 5180/8800 не в интернет |
| Restore drill + off-host копия бэкапов | Иначе backup — теория |
| Required checks в GitHub | Качество merge |

---

## Should-fix (ближайший цикл после выката)

| ID | Кратко |
|----|--------|
| SEC-02 | Prod-guard: запрет CORS `*` |
| SEC-03 | Rate limit login |
| SEC-06 / SEC-07 | Короткий JWT TTL, пароль ≥8 |
| FE-SEC-02 | `/me` или сверка роли при boot |
| DATA-02 | Strict import / dry-run |
| DATA-04 | MinIO delete after commit |
| FE-UX-01…03, FE-OPS-01…02 | Truncation warn, keep-alive, requestId в UI, timeout, error beacon |

---

## Accepted risk / не делаем сейчас

| Тема | Почему ок для пилота |
|------|----------------------|
| Общее чтение (нет ACL на read) | Зафиксировано бизнесом 30.09.2026 |
| JWT в `localStorage` | VPN + малый XSS-surface до cookie/OIDC |
| Нет server pagination | Объём ≪ 10k на горизонте 5 лет при 15 проверках/год |
| OIDC / Keycloak | Не блокер пилота |
| Audit log, users PATCH/DELETE | Nice |
| Sentry/Grafana | Есть Prometheus + логи; full APM не обязателен |

---

## Зависимости между работами

```text
FE-SEC-03 (prod UI image) ──► можно выкатывать UI
SEC-01 + OPS-B (PBKDF2) ──► безопасные учётки
SEC-05 (multipart) ──► безопасные upload/tools
OPS-A (env) ──► всё остальное имеет смысл
     │
     ▼
выкат пилота за VPN
     │
     ▼
SEC-02/03, FE supportability (requestId, timeout, beacon)
```

DATA-01 (Alembic) закрыт baseline `20260930_0001`.

---

## Как пользоваться этим документом

1. Закрывать строки таблицы сверху вниз по колонке «Пилот VPN = да».
2. После выката — блок should-fix.
3. Не трогать freeze-зоны без золотых тестов ([REVIEW.md](REVIEW.md)).
4. Demo-команды — [DEMO.md](DEMO.md); бэкап/restore — [DATA.md](DATA.md); Docker — [DOCKER.md](../DOCKER.md).

Исторический план спринта — [PLAN.md](../PLAN.md); он не заменяет эту таблицу.
