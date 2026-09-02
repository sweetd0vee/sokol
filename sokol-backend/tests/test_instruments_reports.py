"""DOCX tool upload streaming and result download."""

from __future__ import annotations

import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, PropertyMock, patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient

from app.api.v1.endpoints.instruments_reports import DOCX_MIME, _save_upload_to_temp
from app.core.config import settings
from app.db.session import get_db_session
from app.main import app
from tests.auth_test_utils import override_current_user


class SaveUploadToTempTests(unittest.IsolatedAsyncioTestCase):
    async def test_writes_upload_to_disk(self) -> None:
        payload = b"PK" + b"docx-bytes"
        upload = UploadFile(filename="az.docx", file=io.BytesIO(payload))
        path = await _save_upload_to_temp(upload)
        try:
            self.assertEqual(path.read_bytes(), payload)
            self.assertTrue(path.name.endswith(".docx"))
        finally:
            path.unlink(missing_ok=True)

    async def test_reads_in_chunks(self) -> None:
        payload = b"abcdefghij"
        upload = UploadFile(filename="az.docx", file=io.BytesIO(payload))
        with patch("app.api.v1.endpoints.instruments_reports.UPLOAD_CHUNK_SIZE", 3):
            path = await _save_upload_to_temp(upload)
        try:
            self.assertEqual(path.read_bytes(), payload)
        finally:
            path.unlink(missing_ok=True)

    async def test_rejects_oversize_and_removes_temp(self) -> None:
        payload = b"x" * 32
        upload = UploadFile(filename="az.docx", file=io.BytesIO(payload))
        created: list[str] = []
        real_ntf = tempfile.NamedTemporaryFile

        def tracking_ntf(*args, **kwargs):
            tmp = real_ntf(*args, **kwargs)
            created.append(tmp.name)
            return tmp

        with (
            patch(
                "app.api.v1.endpoints.instruments_reports.tempfile.NamedTemporaryFile",
                side_effect=tracking_ntf,
            ),
            patch.object(type(settings), "max_upload_bytes", new_callable=PropertyMock, return_value=8),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await _save_upload_to_temp(upload)

        self.assertEqual(ctx.exception.status_code, 413)
        self.assertTrue(created)
        self.assertFalse(os.path.exists(created[0]))


class SectionIIApiTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        override_current_user()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_section_ii_streams_result_file(self) -> None:
        def fake_process(input_path: str, output_path: str, with_hyperlinks: bool):
            self.assertTrue(Path(input_path).is_file())
            self.assertEqual(Path(input_path).read_bytes(), b"PK-source")
            Path(output_path).write_bytes(b"PK-result")
            return output_path, [], None

        with patch(
            "app.api.v1.endpoints.instruments_reports.docx_generator.process_document",
            side_effect=fake_process,
        ):
            response = self.client.post(
                "/api/v1/tools/section-ii",
                files={"file": ("report.docx", b"PK-source", DOCX_MIME)},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PK-result")
        disposition = response.headers["content-disposition"]
        self.assertIn("attachment", disposition)
        self.assertIn("report_section_ii.docx", disposition)

    def test_section_ii_rejects_oversize_upload(self) -> None:
        with patch.object(type(settings), "max_upload_bytes", new_callable=PropertyMock, return_value=4):
            response = self.client.post(
                "/api/v1/tools/section-ii",
                files={"file": ("report.docx", b"12345", DOCX_MIME)},
            )
        self.assertEqual(response.status_code, 413)


class ControlFileApiTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        override_current_user()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_control_file_streams_xlsx(self) -> None:
        def fake_generate(input_path, output_path, *, check_leader, check_date):
            self.assertEqual(check_leader, "Иванов И.И.")
            self.assertEqual(check_date, "02.09.2026")
            Path(output_path).write_bytes(b"PK-xlsx")
            return output_path, None

        with patch(
            "app.api.v1.endpoints.instruments_reports.generate_control_file_template",
            side_effect=fake_generate,
        ):
            response = self.client.post(
                "/api/v1/tools/control-file",
                files={"file": ("report.docx", b"PK-source", DOCX_MIME)},
                data={"check_leader": "Иванов И.И.", "check_date": "2026-09-02"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PK-xlsx")
        self.assertIn("report_control.xlsx", response.headers["content-disposition"])

    def test_control_file_returns_parse_error_detail(self) -> None:
        with patch(
            "app.api.v1.endpoints.instruments_reports.generate_control_file_template",
            return_value=(None, "В документе не найден Раздел II. Загрузите АЗ с заполненным Разделом II."),
        ):
            response = self.client.post(
                "/api/v1/tools/control-file",
                files={"file": ("report.docx", b"PK-source", "application/zip")},
                data={"check_leader": "Иванов И.И.", "check_date": "02.09.2026"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Раздел II", response.json()["detail"])

    def test_control_file_rejects_missing_leader(self) -> None:
        response = self.client.post(
            "/api/v1/tools/control-file",
            files={"file": ("report.docx", b"PK-source", DOCX_MIME)},
            data={"check_leader": "  ", "check_date": "2026-09-02"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("руководителя", response.json()["detail"].lower())

