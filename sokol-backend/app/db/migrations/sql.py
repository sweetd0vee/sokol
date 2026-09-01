"""SQL-only schema patches shared by CLI modules and Docker bootstrap."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

from app.db.runtime import execute_sql_statements, run_async_main

MigrateFn = Callable[[], Awaitable[None]]
MainFn = Callable[[], None]


@dataclass(frozen=True)
class SqlPatch:
    name: str
    statements: tuple[str, ...]
    message: str

    async def migrate(self) -> None:
        await execute_sql_statements(self.statements)
        print(self.message)


def bind_sql_patch(patch: SqlPatch) -> tuple[MigrateFn, MainFn]:
    """Return ``(migrate, main)`` callables for ``python -m app.db.migrate_*`` shims."""

    async def migrate() -> None:
        await patch.migrate()

    def main() -> None:
        run_async_main(migrate)

    return migrate, main


async def run_sql_patches(patches: Sequence[SqlPatch]) -> None:
    for patch in patches:
        await patch.migrate()
