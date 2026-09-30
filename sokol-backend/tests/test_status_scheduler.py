"""Unit tests for the nightly status refresh loop (no live database)."""

from __future__ import annotations

import os
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.models.checks import CheckStatus
from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus
from app.services.recommendation_status_refresh import (
    refresh_check_statuses,
    refresh_recommendation_statuses,
    status_scheduler_enabled,
)


class _FakeResult:
    def __init__(self, entities: list[object]) -> None:
        self._entities = entities

    def scalars(self) -> list[object]:
        return self._entities


class _FakeSession:
    def __init__(self, entities: list[object]) -> None:
        self.entities = entities
        self.committed = False
        self.rolled_back = False

    async def execute(self, _statement: object) -> _FakeResult:
        return _FakeResult(self.entities)

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True


class _FakeSessionMaker:
    def __init__(self, session: _FakeSession) -> None:
        self.session = session

    def __call__(self) -> "_FakeSessionMaker":
        return self

    async def __aenter__(self) -> _FakeSession:
        return self.session

    async def __aexit__(self, *_args: object) -> bool:
        return False


def _open_recommendation(today: date = date(2026, 9, 10)) -> SimpleNamespace:
    del today
    return SimpleNamespace(
        deadline=date(2026, 8, 1),
        actual_completion_date=None,
        deadline_extensions=None,
        extension_1_date=None,
        extension_2_reason=None,
        control_removals=None,
        remove_from_control_date=None,
        remove_from_control_comment=None,
        indicator="на контроле",
        additional_indicator="на контроле",
        status=RecommendationStatus.ON_CONTROL,
        additional_status=RecommendationAdditionalStatus.ON_CONTROL,
    )


class StatusSchedulerTests(unittest.IsolatedAsyncioTestCase):
    def test_env_flag_off_disables_scheduler(self) -> None:
        with patch.dict(os.environ, {"SOKOL_STATUS_SCHEDULER": "0", "PYTEST_CURRENT_TEST": ""}):
            self.assertFalse(status_scheduler_enabled())

    def test_pytest_env_disables_scheduler(self) -> None:
        with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "tests/test_status_scheduler.py"}):
            self.assertFalse(status_scheduler_enabled())

    async def test_recommendation_refresh_commits_when_status_changes(self) -> None:
        entity = _open_recommendation()
        session = _FakeSession([entity])
        with (
            patch(
                "app.services.recommendation_status_refresh.AsyncSessionLocal",
                _FakeSessionMaker(session),
            ),
            patch(
                "app.services.recommendation_status_refresh.today_moscow",
                return_value=date(2026, 9, 10),
            ),
        ):
            updated = await refresh_recommendation_statuses()
        self.assertEqual(updated, 1)
        self.assertTrue(session.committed)
        self.assertFalse(session.rolled_back)
        self.assertEqual(entity.status, RecommendationStatus.IN_PROGRESS)

    async def test_recommendation_refresh_rolls_back_when_unchanged(self) -> None:
        entity = _open_recommendation()
        entity.deadline = date(2026, 12, 1)
        session = _FakeSession([entity])
        with (
            patch(
                "app.services.recommendation_status_refresh.AsyncSessionLocal",
                _FakeSessionMaker(session),
            ),
            patch(
                "app.services.recommendation_status_refresh.today_moscow",
                return_value=date(2026, 9, 10),
            ),
        ):
            updated = await refresh_recommendation_statuses()
        self.assertEqual(updated, 0)
        self.assertFalse(session.committed)
        self.assertTrue(session.rolled_back)

    async def test_check_refresh_advances_planned_to_in_progress(self) -> None:
        check = SimpleNamespace(
            start_date=date(2026, 9, 1),
            dz_document_date=None,
            status=CheckStatus.NOT_STARTED,
        )
        session = _FakeSession([check])
        with (
            patch(
                "app.services.recommendation_status_refresh.AsyncSessionLocal",
                _FakeSessionMaker(session),
            ),
            patch(
                "app.services.recommendation_status_refresh.today_moscow",
                return_value=date(2026, 9, 10),
            ),
        ):
            updated = await refresh_check_statuses()
        self.assertEqual(updated, 1)
        self.assertTrue(session.committed)
        self.assertEqual(check.status, CheckStatus.IN_PROGRESS)
