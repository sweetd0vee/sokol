"""DB-backed integration tests for checks CRUD endpoints."""

from __future__ import annotations

import asyncio
import os
import unittest
from typing import Any

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_test",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.roles import Role
from app.db.session import get_db_session
from app.main import app
from app.models import Base
from app.models.auditors import Auditor
from app.models.check_kinds import CheckKind
from app.models.effectiveness_ratings import EffectivenessRating
from tests.auth_test_utils import override_current_user

_test_engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
_TestSessionLocal = async_sessionmaker(
    bind=_test_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def _integration_enabled() -> bool:
    return (
        os.getenv("SOKOL_RUN_DB_INTEGRATION_TESTS") == "1"
        or os.getenv("CI", "").lower() == "true"
    )


def _assert_safe_database_url() -> None:
    database_name = make_url(os.environ["DATABASE_URL"]).database or ""
    if "test" not in database_name.lower() and "ci" not in database_name.lower():
        raise RuntimeError(
            "DB integration tests require a DATABASE_URL whose database name "
            "contains 'test' or 'ci'."
        )


async def _reset_schema() -> None:
    async with _test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)


async def _seed_required_dictionaries() -> None:
    async with _TestSessionLocal() as session:
        session.add_all(
            [
                Auditor(full_name="Иванов И.И.", code="III"),
                Auditor(full_name="Петров П.П.", code="PPP"),
                CheckKind(label="Комплексная проверка"),
                EffectivenessRating(label="Эффективно"),
            ]
        )
        await session.commit()


async def _prepare_database() -> None:
    await _reset_schema()
    await _seed_required_dictionaries()


async def _dispose_database() -> None:
    await _reset_schema()
    await _test_engine.dispose()


async def _get_test_db_session():
    async with _TestSessionLocal() as session:
        yield session


class ChecksCrudIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not _integration_enabled():
            raise unittest.SkipTest("DB integration tests are opt-in.")
        _assert_safe_database_url()
        asyncio.run(_prepare_database())

    @classmethod
    def tearDownClass(cls) -> None:
        if _integration_enabled():
            asyncio.run(_dispose_database())

    def setUp(self) -> None:
        override_current_user(Role.ADMIN)
        app.dependency_overrides[get_db_session] = _get_test_db_session
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_checks_crud_lifecycle_uses_real_database(self) -> None:
        created = self._create_check()
        check_id = created["id"]
        serial_number = created["serial_number"]

        self.assertIsInstance(check_id, int)
        self.assertTrue(serial_number)
        self.assertEqual(created["check_name"], "Интеграционная проверка")

        list_response = self.client.get(
            "/api/v1/checks",
            params={"search": "Интеграционная"},
        )
        self.assertEqual(list_response.status_code, 200)
        list_body = list_response.json()
        self.assertEqual(list_body["total"], 1)
        self.assertEqual(list_body["items"][0]["id"], check_id)

        update_response = self.client.patch(
            f"/api/v1/checks/{check_id}",
            json={
                "check_name": "Интеграционная проверка обновлена",
                "status": "completed",
                "check_leader": "Петров П.П.",
            },
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["check_name"], "Интеграционная проверка обновлена")
        self.assertEqual(updated["status"], "completed")
        self.assertNotEqual(updated["serial_number"], serial_number)

        get_response = self.client.get(f"/api/v1/checks/{check_id}")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.json()["serial_number"], updated["serial_number"])

        delete_response = self.client.delete(f"/api/v1/checks/{check_id}")
        self.assertEqual(delete_response.status_code, 204)

        missing_response = self.client.get(f"/api/v1/checks/{check_id}")
        self.assertEqual(missing_response.status_code, 404)

    def _create_check(self) -> dict[str, Any]:
        response = self.client.post(
            "/api/v1/checks",
            json={
                "check_name": "Интеграционная проверка",
                "check_type": "internal",
                "check_view": "Комплексная проверка",
                "start_date": "2026-01-15",
                "end_date": "2026-02-15",
                "check_leader": "Иванов И.И.",
                "status": "not_started",
                "created_at": "2026-01-10",
                "description": "CRUD lifecycle integration fixture",
                "process_effectiveness": "Эффективно",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()
