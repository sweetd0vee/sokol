"""Service tests for recommendation lifecycle orchestration."""

from __future__ import annotations

import asyncio
import os
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.api.deps import CurrentUser
from app.core.roles import Role
from app.models.recommendations import (
    Recommendation,
    RecommendationAdditionalStatus,
    RecommendationStatus,
)
from app.schemas.recommendations import RecommendationBatchRequest, RecommendationCreate
from app.services import recommendations_service


def _recommendation_create(name: str = "Рекомендация") -> RecommendationCreate:
    return RecommendationCreate(
        serial_number="26IVP01P1",
        name=name,
        audit_object="Процесс",
        auditor="Иванов И.И.",
        manager="Петров П.П.",
        status=RecommendationStatus.ON_CONTROL,
        additional_status=RecommendationAdditionalStatus.ON_CONTROL,
        created_at=date(2026, 8, 12),
    )


class RecommendationsServiceTests(unittest.TestCase):
    def test_delete_recommendation_cleans_attachments_and_renumbers(self) -> None:
        session = AsyncMock()
        recommendation = Recommendation(
            id=10,
            check_id=20,
            serial_number="26IVP01P1",
            auditor="Иванов И.И.",
        )
        admin = CurrentUser(username="Админ А.А.", display_name="Администратор", role=Role.ADMIN)

        async def run() -> None:
            with (
                patch(
                    "app.services.recommendations_service.get_recommendation",
                    new_callable=AsyncMock,
                    return_value=recommendation,
                ),
                patch(
                    "app.services.recommendations_service.attachments_service.delete_attachments_for_entity",
                    new_callable=AsyncMock,
                ) as mock_cleanup,
                patch(
                    "app.services.recommendations_service.recommendations_crud.delete_recommendation_row",
                    new_callable=AsyncMock,
                ) as mock_delete,
                patch(
                    "app.services.recommendations_service.recommendations_crud.renumber_recommendations_for_check",
                    new_callable=AsyncMock,
                ) as mock_renumber,
            ):
                await recommendations_service.delete_recommendation(session, recommendation.id, admin)

            mock_cleanup.assert_awaited_once_with(
                session,
                entity_type="recommendation",
                entity_id=10,
            )
            mock_delete.assert_awaited_once_with(session, recommendation)
            mock_renumber.assert_awaited_once_with(session, 20)
            session.commit.assert_awaited_once()

        asyncio.run(run())

    def test_batch_replace_deletes_old_rows_and_creates_new_rows_once(self) -> None:
        session = AsyncMock()
        check = SimpleNamespace(id=20, serial_number="26IVP01P1")
        existing = [Recommendation(id=10, check_id=20, serial_number="26IVP01P1")]
        created = Recommendation(
            id=11,
            check_id=20,
            serial_number="26IVP01P1",
            sequence_number=1,
            name="Новая рекомендация",
            audit_object=["Процесс"],
            auditor="Иванов И.И.",
            manager="Петров П.П.",
            status=RecommendationStatus.ON_CONTROL,
            additional_status=RecommendationAdditionalStatus.ON_CONTROL,
            created_at=date(2026, 8, 12),
            description="",
            indicator="не указан",
            materiality_level="средний",
        )

        async def run() -> None:
            with (
                patch(
                    "app.services.recommendations_service.checks_crud.get_check_by_serial",
                    new_callable=AsyncMock,
                    return_value=check,
                ),
                patch(
                    "app.services.recommendations_service.validate_recommendation_dictionary_fields",
                    new_callable=AsyncMock,
                ),
                patch(
                    "app.services.recommendations_service.canonicalize_audit_objects",
                    new_callable=AsyncMock,
                    return_value=["Процесс"],
                ),
                patch(
                    "app.services.recommendations_service.recommendations_crud.list_recommendations_for_check",
                    new_callable=AsyncMock,
                    return_value=existing,
                ),
                patch(
                    "app.services.recommendations_service.attachments_service.delete_attachments_for_entity",
                    new_callable=AsyncMock,
                ) as mock_cleanup,
                patch(
                    "app.services.recommendations_service.recommendations_crud.delete_recommendation_row",
                    new_callable=AsyncMock,
                ) as mock_delete,
                patch(
                    "app.services.recommendations_service.recommendations_crud.add_recommendation_row",
                    new_callable=AsyncMock,
                    return_value=created,
                ) as mock_add,
            ):
                result = await recommendations_service.batch_recommendations(
                    session,
                    RecommendationBatchRequest(
                        serial_number="26IVP01P1",
                        mode="replace",
                        items=[_recommendation_create("Новая рекомендация")],
                    ),
                )

            self.assertEqual(result.total, 1)
            mock_cleanup.assert_awaited_once()
            mock_delete.assert_awaited_once_with(session, existing[0])
            mock_add.assert_awaited_once()
            self.assertEqual(mock_add.await_args.kwargs["sequence_number"], 1)
            session.commit.assert_awaited_once()

        asyncio.run(run())

    def test_delete_recommendations_batch_cleans_and_renumbers_once(self) -> None:
        session = AsyncMock()
        first = Recommendation(id=10, check_id=20, serial_number="26IVP01P1", auditor="Иванов И.И.")
        second = Recommendation(id=11, check_id=20, serial_number="26IVP01P1", auditor="Иванов И.И.")
        admin = CurrentUser(username="Админ А.А.", display_name="Администратор", role=Role.ADMIN)

        async def run() -> None:
            with (
                patch(
                    "app.services.recommendations_service.get_recommendation",
                    new_callable=AsyncMock,
                    side_effect=[first, second],
                ),
                patch(
                    "app.services.recommendations_service.attachments_service.delete_attachments_for_entity",
                    new_callable=AsyncMock,
                ) as mock_cleanup,
                patch(
                    "app.services.recommendations_service.recommendations_crud.delete_recommendation_row",
                    new_callable=AsyncMock,
                ) as mock_delete,
                patch(
                    "app.services.recommendations_service.recommendations_crud.renumber_recommendations_for_check",
                    new_callable=AsyncMock,
                ) as mock_renumber,
            ):
                await recommendations_service.delete_recommendations_batch(session, [10, 11], admin)

            self.assertEqual(mock_cleanup.await_count, 2)
            self.assertEqual(mock_delete.await_count, 2)
            mock_renumber.assert_awaited_once_with(session, 20)
            session.commit.assert_awaited_once()

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
