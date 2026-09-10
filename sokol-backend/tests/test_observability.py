"""Request-id, exception type logging, and /status metrics."""

from __future__ import annotations

import logging
import os
import unittest
from unittest.mock import patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from fastapi.testclient import TestClient

from app.core.exceptions import ResourceNotFoundError
from app.core.logging import format_caught_error, log_caught_exception
from app.main import app
from app.core.roles import Role
from tests.auth_test_utils import override_current_user


class LoggingHelpersTests(unittest.TestCase):
    def test_format_caught_error_keeps_type_when_message_empty(self) -> None:
        class EmptyError(Exception):
            def __str__(self) -> str:
                return ""

        self.assertEqual(format_caught_error(EmptyError()), "EmptyError")
        self.assertEqual(format_caught_error(ValueError("bad date")), "ValueError: bad date")

    def test_log_caught_exception_puts_type_on_message_line(self) -> None:
        logger = logging.getLogger("app.tests.observability")
        with self.assertLogs(logger, level="ERROR") as captured:
            try:
                raise RuntimeError("boom")
            except RuntimeError:
                log_caught_exception(logger, "unit failed")
        self.assertTrue(any("[RuntimeError]" in line for line in captured.output))


class ObservabilityApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_status_echoes_request_id_and_metrics(self) -> None:
        response = self.client.get("/api/v1/status", headers={"X-Request-ID": "obs-test-id"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-request-id"), "obs-test-id")
        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("uptime_seconds", body)
        self.assertIn("requests_total", body)
        self.assertGreaterEqual(body["requests_total"], 1)
        self.assertIn("requests_4xx", body)
        self.assertIn("requests_5xx", body)

    def test_status_generates_request_id_when_missing(self) -> None:
        response = self.client.get("/api/v1/status")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers.get("x-request-id"))

    def test_unhandled_error_logs_type_and_hides_internals(self) -> None:
        with patch(
            "app.api.v1.endpoints.health.snapshot_metrics",
            side_effect=RuntimeError("secret internals"),
        ):
            with self.assertLogs("app", level="ERROR") as captured:
                response = self.client.get("/api/v1/status")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Внутренняя ошибка сервера."})
        self.assertTrue(response.headers.get("x-request-id"))
        self.assertTrue(any("[RuntimeError]" in line for line in captured.output))
        self.assertNotIn("secret internals", response.text)

    def test_domain_error_is_logged_with_type(self) -> None:
        override_current_user(Role.ADMIN)
        with patch(
            "app.services.checks_service.get_check",
            side_effect=ResourceNotFoundError("Проверка не найдена."),
        ):
            with self.assertLogs("app.api.exception_handlers", level="WARNING") as captured:
                response = self.client.get("/api/v1/checks/1")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Проверка не найдена."})
        self.assertTrue(any("[ResourceNotFoundError]" in line for line in captured.output))

    def test_http_exception_is_not_swallowed_by_unhandled_handler(self) -> None:
        response = self.client.get("/api/v1/checks")
        self.assertEqual(response.status_code, 401)
        self.assertIn("detail", response.json())


if __name__ == "__main__":
    unittest.main()
