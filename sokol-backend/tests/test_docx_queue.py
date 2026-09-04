"""In-process DOCX job queue: concurrency cap, wait queue, 503 overflow."""

from __future__ import annotations

import asyncio
import os
import unittest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.endpoints.instruments_reports import DOCX_MIME
from app.db.session import get_db_session
from app.main import app
from app.services.reports.docx_queue import (
    QUEUE_BUSY_DETAIL,
    DocxJobLimiter,
    reset_docx_job_limiter,
)
from tests.auth_test_utils import override_current_user


class DocxJobLimiterTests(unittest.IsolatedAsyncioTestCase):
    async def test_runs_within_capacity(self) -> None:
        limiter = DocxJobLimiter(max_concurrent=2, max_queue=0, wait_seconds=1)
        seen: list[int] = []

        async def job(value: int) -> None:
            async with limiter.slot():
                seen.append(value)

        await asyncio.gather(job(1), job(2))
        self.assertEqual(sorted(seen), [1, 2])

    async def test_overflow_returns_503_when_queue_is_full(self) -> None:
        limiter = DocxJobLimiter(max_concurrent=1, max_queue=1, wait_seconds=2)
        started = asyncio.Event()
        release = asyncio.Event()

        async def holder() -> None:
            async with limiter.slot():
                started.set()
                await release.wait()

        holder_task = asyncio.create_task(holder())
        await started.wait()

        waiter_started = asyncio.Event()

        async def waiter() -> None:
            waiter_started.set()
            async with limiter.slot():
                pass

        waiter_task = asyncio.create_task(waiter())
        await waiter_started.wait()
        await asyncio.sleep(0.05)

        with self.assertRaises(HTTPException) as ctx:
            async with limiter.slot():
                pass
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertIn("очеред", ctx.exception.detail.lower())
        self.assertEqual(ctx.exception.headers.get("Retry-After"), "15")

        release.set()
        await holder_task
        await waiter_task

    async def test_wait_timeout_returns_503(self) -> None:
        limiter = DocxJobLimiter(max_concurrent=1, max_queue=1, wait_seconds=0.05)
        started = asyncio.Event()
        release = asyncio.Event()

        async def holder() -> None:
            async with limiter.slot():
                started.set()
                await release.wait()

        holder_task = asyncio.create_task(holder())
        await started.wait()

        with self.assertRaises(HTTPException) as ctx:
            async with limiter.slot():
                pass
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertIn("ждал", ctx.exception.detail.lower())

        release.set()
        await holder_task


class SectionIIQueueApiTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        override_current_user()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        reset_docx_job_limiter(None)
        app.dependency_overrides.clear()
        self.client.close()

    def test_section_ii_returns_503_when_queue_is_full(self) -> None:
        class BusyLimiter:
            @asynccontextmanager
            async def slot(self):
                raise HTTPException(
                    status_code=503,
                    detail=QUEUE_BUSY_DETAIL,
                    headers={"Retry-After": "15"},
                )
                yield

        reset_docx_job_limiter(BusyLimiter())
        response = self.client.post(
            "/api/v1/tools/section-ii",
            files={"file": ("report.docx", b"PK-source", DOCX_MIME)},
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers.get("retry-after"), "15")
        self.assertIn("очеред", response.json()["detail"].lower())

    def test_capabilities_exposes_docx_queue_limits(self) -> None:
        response = self.client.get("/api/v1/capabilities")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("max_upload_bytes", body)
        self.assertGreaterEqual(body["docx_max_concurrent"], 1)
        self.assertGreaterEqual(body["docx_max_queue"], 0)
        self.assertGreaterEqual(body["docx_queue_wait_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
