"""In-process queue for CPU-heavy DOCX tools.

Keeps a small number of documents in the thread pool and parks extra
requests until a slot frees, instead of letting every upload run at once.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

QUEUE_BUSY_DETAIL = (
    "Сейчас обрабатывается слишком много документов. "
    "Повторите через несколько секунд — запрос встанет в очередь."
)
QUEUE_TIMEOUT_DETAIL = (
    "Документ слишком долго ждал свободного слота обработки. "
    "Повторите попытку через минуту."
)
RETRY_AFTER_SECONDS = "15"


def _queue_unavailable(detail: str) -> ServiceUnavailableError:
    return ServiceUnavailableError(detail, headers={"Retry-After": RETRY_AFTER_SECONDS})


class DocxJobLimiter:
    def __init__(
        self,
        *,
        max_concurrent: int,
        max_queue: int,
        wait_seconds: float,
    ) -> None:
        self.max_concurrent = max(1, max_concurrent)
        self.max_queue = max(0, max_queue)
        self.wait_seconds = max(0.0, wait_seconds)
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        self._lock = asyncio.Lock()
        self._inflight = 0

    @property
    def capacity(self) -> int:
        return self.max_concurrent + self.max_queue

    async def _enter(self) -> None:
        async with self._lock:
            if self._inflight >= self.capacity:
                raise _queue_unavailable(QUEUE_BUSY_DETAIL)
            self._inflight += 1
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=self.wait_seconds)
        except asyncio.TimeoutError:
            async with self._lock:
                self._inflight -= 1
            raise _queue_unavailable(QUEUE_TIMEOUT_DETAIL) from None
        except BaseException:
            async with self._lock:
                self._inflight -= 1
            raise

    async def _leave(self) -> None:
        self._semaphore.release()
        async with self._lock:
            self._inflight = max(0, self._inflight - 1)

    def snapshot(self) -> dict[str, int]:
        return {
            "docx_jobs_inflight": self._inflight,
            "docx_jobs_capacity": self.capacity,
            "docx_max_concurrent": self.max_concurrent,
            "docx_max_queue": self.max_queue,
        }

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        await self._enter()
        try:
            yield
        finally:
            await self._leave()


_limiter: DocxJobLimiter | None = None


def get_docx_job_limiter() -> DocxJobLimiter:
    global _limiter
    if _limiter is None:
        _limiter = DocxJobLimiter(
            max_concurrent=settings.docx_max_concurrent,
            max_queue=settings.docx_max_queue,
            wait_seconds=settings.docx_queue_wait_seconds,
        )
    return _limiter


def reset_docx_job_limiter(limiter: DocxJobLimiter | None = None) -> None:
    global _limiter
    _limiter = limiter


@asynccontextmanager
async def docx_job_slot() -> AsyncIterator[None]:
    async with get_docx_job_limiter().slot():
        yield
