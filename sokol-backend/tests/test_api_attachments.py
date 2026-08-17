"""HTTP smoke tests for attachments endpoints (mocked DB/storage)."""

from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, PropertyMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import get_db_session
from app.main import app
from app.models.attachments import Attachment
from tests.auth_test_utils import override_current_user
from app.core.roles import Role


class AttachmentsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        override_current_user(Role.ADMIN)
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_storage_status_when_minio_disabled(self) -> None:
        with patch.object(Settings, "minio_enabled", new_callable=PropertyMock, return_value=False):
            response = self.client.get("/api/v1/attachments/storage/status")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["enabled"])
        self.assertFalse(body["reachable"])
        self.assertIn("bucket_layout", body)

    def test_list_attachments_ok(self) -> None:
        row = Attachment(
            id=1,
            entity_type="check",
            entity_id=10,
            slot="az",
            check_serial_number="26IVP1P1",
            bucket="check-26ivp01p1",
            object_key="az/uuid_file.pdf",
            original_name="file.pdf",
            content_type="application/pdf",
            size_bytes=12,
            created_at=datetime(2026, 8, 11, tzinfo=timezone.utc),
        )
        with (
            patch(
                "app.services.attachments_service.resolve_attachment_target",
                new_callable=AsyncMock,
                return_value=("26IVP1P1", None, None),
            ),
            patch(
                "app.services.attachments_service.attachments_crud.list_attachments",
                new_callable=AsyncMock,
                return_value=[row],
            ),
            patch(
                "app.services.attachments_service.attachments_crud.count_attachments",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            response = self.client.get(
                "/api/v1/attachments",
                params={"entity_type": "check", "entity_id": 10},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["items"][0]["original_name"], "file.pdf")
        self.assertEqual(body["items"][0]["slot"], "az")

    def test_list_attachments_rejects_bad_entity_type(self) -> None:
        response = self.client.get(
            "/api/v1/attachments",
            params={"entity_type": "observation", "entity_id": 1},
        )
        self.assertEqual(response.status_code, 422)

    def test_upload_returns_503_when_storage_disabled(self) -> None:
        with patch.object(Settings, "minio_enabled", new_callable=PropertyMock, return_value=False):
            response = self.client.post(
                "/api/v1/attachments",
                data={
                    "entity_type": "check",
                    "entity_id": "1",
                    "slot": "az",
                },
                files={"file": ("note.txt", b"hello", "text/plain")},
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("хранилищ", response.json()["detail"].lower())

    def test_upload_rejects_invalid_slot(self) -> None:
        with (
            patch.object(Settings, "minio_enabled", new_callable=PropertyMock, return_value=True),
            patch(
                "app.services.attachments_service.resolve_attachment_target",
                new_callable=AsyncMock,
                return_value=("26IVP1P1", None, None),
            ),
        ):
            response = self.client.post(
                "/api/v1/attachments",
                data={
                    "entity_type": "check",
                    "entity_id": "1",
                    "slot": "not_a_slot",
                },
                files={"file": ("note.txt", b"hello", "text/plain")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("слот", response.json()["detail"].lower())

    def test_get_missing_attachment_download_404(self) -> None:
        with (
            patch.object(Settings, "minio_enabled", new_callable=PropertyMock, return_value=True),
            patch(
                "app.services.attachments_service.attachments_crud.get_attachment",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            response = self.client.get("/api/v1/attachments/999/download")

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
