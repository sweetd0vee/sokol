"""HTTP smoke tests for analytics endpoints (mocked services, no live DB)."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from fastapi.testclient import TestClient

from app.db.session import get_db_session
from app.main import app
from app.schemas.analytics import (
    ChecksAnalyticsFilterOptions,
    ChecksAnalyticsResponse,
    ChecksSummary,
    RecommendationsAnalyticsResponse,
    RecommendationsSummary,
    RecommendationsSummaryByAdditional,
    RecommendationsSummaryByMateriality,
    RecommendationsSummaryByStatus,
)
from tests.auth_test_utils import override_current_user
from app.core.roles import Role


def _empty_checks_payload() -> ChecksAnalyticsResponse:
    return ChecksAnalyticsResponse(
        universe_total=0,
        filtered_total=0,
        granularity="year",
        summary=ChecksSummary(total=0, not_started=0, in_progress=0, completed=0),
        completion_share=0,
        period_series=[],
        view_distribution=[],
        type_distribution=[],
        department_map=[],
        effectiveness_matrix=[],
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=[],
            departments=[],
            anchor_dates=["2025-01-01", "2026-12-01"],
        ),
    )


def _empty_recommendations_payload() -> RecommendationsAnalyticsResponse:
    return RecommendationsAnalyticsResponse(
        universe_total=0,
        filtered_total=0,
        granularity="year",
        summary=RecommendationsSummary(
            total=0,
            by_status=RecommendationsSummaryByStatus(
                completed=0,
                unresolved=0,
                on_control=0,
                in_progress=0,
            ),
            by_materiality=RecommendationsSummaryByMateriality(низкий=0, средний=0, высокий=0),
            by_additional=RecommendationsSummaryByAdditional(
                on_time=0,
                deadline_violated=0,
                on_control=0,
            ),
            with_extensions=0,
            with_completion_date=0,
            completion_rate=0,
            violation_rate=0,
        ),
        period_series=[],
        materiality_distribution=[],
        indicator_distribution=[],
        check_links=[],
        materiality_matrix=[],
        object_distribution=[],
        status_distribution=[],
        additional_status_distribution=[],
        filter_options=ChecksAnalyticsFilterOptions(
            auditors=[],
            departments=[],
            anchor_dates=["2025-01-01", "2026-12-01"],
        ),
    )


class AnalyticsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        override_current_user(Role.ADMIN)
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_get_checks_analytics_ok(self) -> None:
        payload = _empty_checks_payload()
        with patch(
            "app.api.v1.endpoints.analytics.build_checks_analytics",
            new_callable=AsyncMock,
            return_value=payload,
        ) as mocked:
            response = self.client.get(
                "/api/v1/analytics/checks",
                params=[
                    ("granularity", "month"),
                    ("years", "2025"),
                    ("auditors", "Иванов"),
                ],
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["universeTotal"], 0)
        self.assertEqual(body["granularity"], "year")
        self.assertIn("filterOptions", body)
        self.assertIn("effectivenessMatrix", body)
        mocked.assert_awaited_once()
        kwargs = mocked.await_args.kwargs
        self.assertEqual(kwargs["granularity"], "month")
        self.assertEqual(kwargs["years"], ["2025"])
        self.assertEqual(kwargs["auditors"], ["Иванов"])

    def test_get_recommendations_analytics_ok(self) -> None:
        payload = _empty_recommendations_payload()
        with patch(
            "app.api.v1.endpoints.analytics.build_recommendations_analytics",
            new_callable=AsyncMock,
            return_value=payload,
        ) as mocked:
            response = self.client.get(
                "/api/v1/analytics/recommendations",
                params=[("materialityLevels", "высокий")],
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["filteredTotal"], 0)
        self.assertIn("byStatus", body["summary"])
        self.assertIn("materialityMatrix", body)
        mocked.assert_awaited_once()
        self.assertEqual(mocked.await_args.kwargs["materiality_levels"], ["высокий"])

    def test_get_checks_analytics_rejects_bad_granularity(self) -> None:
        response = self.client.get(
            "/api/v1/analytics/checks",
            params={"granularity": "week"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
