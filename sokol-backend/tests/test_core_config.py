"""Unit tests for Settings helpers."""

from __future__ import annotations

import os
import unittest

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.core.config import Settings, parse_cors_origins
from app.core.startup_validation import DEFAULT_JWT_SECRET


class ParseCorsOriginsTests(unittest.TestCase):
    def test_empty_allows_all(self) -> None:
        self.assertEqual(parse_cors_origins(""), ["*"])
        self.assertEqual(parse_cors_origins("   "), ["*"])
        self.assertEqual(parse_cors_origins(", ,"), ["*"])

    def test_splits_and_strips(self) -> None:
        self.assertEqual(
            parse_cors_origins("http://a.example, http://b.example"),
            ["http://a.example", "http://b.example"],
        )


class SettingsHelperTests(unittest.TestCase):
    def test_jwt_default_matches_startup_constant(self) -> None:
        self.assertEqual(Settings.model_fields["sokol_jwt_secret"].default, DEFAULT_JWT_SECRET)

    def test_max_upload_bytes_floors_at_one_megabyte(self) -> None:
        self.assertEqual(Settings(sokol_max_upload_mb=0).max_upload_bytes, 1024 * 1024)
        self.assertEqual(Settings(sokol_max_upload_mb=2).max_upload_bytes, 2 * 1024 * 1024)

    def test_docx_queue_limits_floor_at_safe_minimums(self) -> None:
        tight = Settings(
            sokol_docx_max_concurrent=0,
            sokol_docx_max_queue=-1,
            sokol_docx_queue_wait_seconds=-5,
        )
        self.assertEqual(tight.docx_max_concurrent, 1)
        self.assertEqual(tight.docx_max_queue, 0)
        self.assertEqual(tight.docx_queue_wait_seconds, 0.0)
        self.assertEqual(Settings().docx_max_concurrent, 2)
        self.assertEqual(Settings().docx_max_queue, 8)

    def test_basic_auth_defaults_by_env(self) -> None:
        self.assertTrue(Settings(sokol_env="development", sokol_enable_basic_auth=None).basic_auth_enabled)
        self.assertFalse(Settings(sokol_env="prod", sokol_enable_basic_auth=None).basic_auth_enabled)
        self.assertTrue(Settings(sokol_env="prod", sokol_enable_basic_auth=True).basic_auth_enabled)
        self.assertFalse(Settings(sokol_env="development", sokol_enable_basic_auth=False).basic_auth_enabled)

    def test_minio_enabled_requires_all_credentials(self) -> None:
        self.assertFalse(
            Settings(
                sokol_minio_endpoint="localhost:9000",
                sokol_minio_access_key="",
                sokol_minio_secret_key="",
            ).minio_enabled
        )
        self.assertTrue(
            Settings(
                sokol_minio_endpoint=" localhost:9000 ",
                sokol_minio_access_key=" key ",
                sokol_minio_secret_key=" secret ",
            ).minio_enabled
        )
        self.assertEqual(
            Settings(sokol_minio_endpoint=" localhost:9000 ").minio_endpoint,
            "localhost:9000",
        )

    def test_cors_origins_property(self) -> None:
        self.assertEqual(Settings(sokol_cors_origins="").cors_origins, ["*"])
        self.assertEqual(
            Settings(sokol_cors_origins="http://localhost:5180").cors_origins,
            ["http://localhost:5180"],
        )

    def test_log_json_defaults_to_production_only(self) -> None:
        self.assertFalse(Settings(sokol_env="development", sokol_log_json=None).log_json)
        self.assertTrue(Settings(sokol_env="prod", sokol_log_json=None).log_json)
        self.assertTrue(Settings(sokol_env="development", sokol_log_json=True).log_json)
        self.assertFalse(Settings(sokol_env="prod", sokol_log_json=False).log_json)

    def test_log_level_parses_name(self) -> None:
        import logging

        self.assertEqual(Settings(sokol_log_level="DEBUG").log_level, logging.DEBUG)
        self.assertEqual(Settings(sokol_log_level="nope").log_level, logging.INFO)


if __name__ == "__main__":
    unittest.main()
