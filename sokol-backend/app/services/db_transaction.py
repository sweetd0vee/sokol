"""Roll back a service write when it fails. Commit stays at the call site."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from logging import Logger

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainError
from app.core.logging import log_caught_exception


@asynccontextmanager
async def rollback_on_error(
    session: AsyncSession,
    *,
    logger: Logger | None = None,
    message: str = "",
    message_args: tuple[object, ...] = (),
) -> AsyncIterator[None]:
    try:
        yield
    except DomainError:
        await session.rollback()
        raise
    except Exception:
        if logger is not None and message:
            log_caught_exception(logger, message, *message_args)
        await session.rollback()
        raise
