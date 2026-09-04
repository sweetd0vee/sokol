# CI gate

Workflow: `.github/workflows/ci.yml`.

## Что проверяет

| Job | Проверки |
|-----|----------|
| `Backend (Python 3.12)` | `compileall app scripts tests`, `unittest discover -s tests -p "test_*.py"` |
| `Frontend (Node 22)` | `npm run lint`, `npm test` (Vitest), `npm run build` |

Backend поднимает PostgreSQL 16 и гоняет тесты с:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_test
SOKOL_JWT_SECRET=ci-test-jwt-secret
SOKOL_RUN_DB_INTEGRATION_TESTS=1
```

**Не входит в CI:** Playwright (`npm run test:e2e` — auth + constructor). Его нужно гонять локально или отдельным job.

## Обязательный merge gate

Красный CI блокирует merge в default branch.

Это делает GitHub ruleset **CI merge gate** (не YAML CI сам по себе). Его создаёт и поддерживает `.github/workflows/protect-main.yml` при push этого файла / `ci.yml` в `main`/`master` или по `workflow_dispatch`.

Правила:

- merge только через pull request;
- обязательны checks `Backend (Python 3.12)` и `Frontend (Node 22)`;
- ветка должна быть up to date с default;
- force-push и удаление default branch запрещены.

Проверка: `Settings` → `Rules` / `Rulesets` → `CI merge gate`, либо `Settings` → `Branches`.

Если Actions вернул 403 на rulesets API, включить вручную:

1. `Settings` → `Branches` → branch protection для `main`/`master`.
2. `Require a pull request before merging`.
3. `Require status checks to pass before merging`.
4. Required checks: `Backend (Python 3.12)`, `Frontend (Node 22)`.
5. `Require branches to be up to date before merging`.
