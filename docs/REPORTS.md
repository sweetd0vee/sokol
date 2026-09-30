# Документы

HTTP: `app/api/v1/endpoints/instruments_reports.py`. Логика: `app/services/reports/`. Нужна авторизация.

Вход — `.docx` в поле `file`, лимит `SOKOL_MAX_UPLOAD_MB` (100). Файл стримится во временный каталог, ждёт слот (`SOKOL_DOCX_MAX_CONCURRENT` / `SOKOL_DOCX_MAX_QUEUE` / `SOKOL_DOCX_QUEUE_WAIT_SECONDS`) и обрабатывается в `asyncio.to_thread`. Результат не пишется в MinIO. Переполнение или timeout очереди → **503** и `Retry-After`. Лимиты — `GET /capabilities`.

Если таблицы Раздела II нет, докладная, parse и файл контроля читают наблюдения раздела III. Нестандартная вёрстка АЗ может разобраться неполно; content-control и таблица имеют запасные пути.

| Method | Path | Результат |
|--------|------|-----------|
| `POST` | `/tools/section-ii` | таблица Раздела II после Раздела I, `*_section_ii.docx` |
| `POST` | `/tools/section-ii-links` | то же плюс закладки и ссылки на наблюдения |
| `POST` | `/tools/memorandum` | ДЗ из АЗ, `*_dz.docx`; объекты аудита канонизируются по `departments` |
| `POST` | `/tools/parse-recommendations` | JSON `{ name, observation_name, audit_object, manager, deadline }` для формы проверки |
| `GET` | `/tools/control-file-template` | пустой XLSX из `sokol-backend/data/` |
| `POST` | `/tools/control-file` | XLSX из АЗ; form `file`, `check_leader`, `check_date` (`YYYY-MM-DD` или `DD.MM.YYYY`) |

`observation_name` может быть пустым. Неизвестное подразделение в parse → **400**. Дата в шаблон файла контроля пишется как `DD.MM.YYYY`.

Парсинг → **400**, файл не создан → **500**, слишком большой → **413**, нет шаблона → **404**, очередь полна → **503**.

После parse UI вызывает `POST /recommendations/batch`. Backend ещё раз прогоняет автостатус. Правила значков — [RECOMMENDATION_INDICATORS.md](RECOMMENDATION_INDICATORS.md).
