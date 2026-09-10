"""HTTP tests for transactional recommendation batch endpoints."""

from __future__ import annotations

import os
import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from fastapi.testclient import TestClient

from app.db.session import get_db_session
from app.main import app
from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus
from app.schemas.recommendations import RecommendationListResponse, RecommendationRead
from app.core.exceptions import StorageOperationError
from tests.auth_test_utils import override_current_user


def _recommendation_read() -> RecommendationRead:
    return RecommendationRead(
        id=1,
        serial_number="26IVP1P1",
        sequence_number=1,
        name="Рекомендация",
        observation_name="Наблюдение",
        description="Рекомендация",
        indicator="не указан",
        materiality_level="средний",
        audit_object="Процесс",
        deadline=None,
        auditor="Иванов И.И.",
        manager="Петров П.П.",
        status=RecommendationStatus.ON_CONTROL,
        additional_status=RecommendationAdditionalStatus.ON_CONTROL,
        created_at=date(2026, 8, 12),
    )


class RecommendationsBatchApiTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        override_current_user()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    @patch("app.services.recommendations_service.batch_recommendations", new_callable=AsyncMock)
    def test_batch_recommendations_returns_created_items(self, mock_batch: AsyncMock) -> None:
        mock_batch.return_value = RecommendationListResponse(items=[_recommendation_read()], total=1)

        response = self.client.post(
            "/api/v1/recommendations/batch",
            json={
                "serial_number": "26IVP1P1",
                "mode": "append",
                "items": [
                    {
                        "serial_number": "26IVP1P1",
                        "name": "Рекомендация",
                        "audit_object": "Процесс",
                        "auditor": "Иванов И.И.",
                        "manager": "Петров П.П.",
                        "status": "on_control",
                        "additional_status": "on_control",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["total"], 1)
        mock_batch.assert_awaited_once()

    @patch("app.services.recommendations_service.delete_recommendation", new_callable=AsyncMock)
    def test_delete_recommendation_maps_storage_failure_to_502(self, mock_delete: AsyncMock) -> None:
        mock_delete.side_effect = StorageOperationError("Не удалось удалить файл из хранилища.")

        response = self.client.delete("/api/v1/recommendations/1")

        self.assertEqual(response.status_code, 502)
        self.assertIn("хранилищ", response.json()["detail"].lower())


if __name__ == "__main__":
    unittest.main()
