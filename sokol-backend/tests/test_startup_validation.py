"""Startup security validation."""

from __future__ import annotations

import unittest

from app.core.startup_validation import (
    DEFAULT_JWT_SECRET,
    MIN_PROD_JWT_SECRET_LEN,
    assert_app_startup_safe,
    assert_demo_data_safe_for_env,
    assert_jwt_secret_safe_for_env,
    assert_seed_replace_safe_for_env,
    destructive_dictionary_sync_enabled,
    env_flag_enabled,
    is_production_env,
)


class StartupValidationTests(unittest.TestCase):
    def test_is_production_env(self) -> None:
        self.assertTrue(is_production_env("prod"))
        self.assertTrue(is_production_env("production"))
        self.assertTrue(is_production_env(" PROD "))
        self.assertFalse(is_production_env("development"))
        self.assertFalse(is_production_env("dev"))

    def test_dev_allows_default_secret(self) -> None:
        assert_jwt_secret_safe_for_env(
            jwt_secret=DEFAULT_JWT_SECRET,
            env="development",
        )

    def test_prod_rejects_default_secret(self) -> None:
        with self.assertRaises(RuntimeError) as ctx:
            assert_jwt_secret_safe_for_env(
                jwt_secret=DEFAULT_JWT_SECRET,
                env="prod",
            )
        self.assertIn("default dev value", str(ctx.exception))

    def test_prod_rejects_short_secret(self) -> None:
        with self.assertRaises(RuntimeError) as ctx:
            assert_jwt_secret_safe_for_env(
                jwt_secret="x" * (MIN_PROD_JWT_SECRET_LEN - 1),
                env="production",
            )
        self.assertIn(str(MIN_PROD_JWT_SECRET_LEN), str(ctx.exception))

    def test_prod_accepts_strong_secret(self) -> None:
        assert_jwt_secret_safe_for_env(
            jwt_secret="x" * MIN_PROD_JWT_SECRET_LEN,
            env="prod",
        )

    def test_env_flag_parsing(self) -> None:
        self.assertTrue(env_flag_enabled("1", default=False))
        self.assertTrue(env_flag_enabled("YES", default=False))
        self.assertTrue(env_flag_enabled("on", default=False))
        self.assertFalse(env_flag_enabled("0", default=True))
        self.assertFalse(env_flag_enabled("OFF", default=True))
        self.assertFalse(env_flag_enabled(None, default=False))
        self.assertTrue(env_flag_enabled(None, default=True))
        self.assertTrue(env_flag_enabled("", default=True))
        self.assertTrue(env_flag_enabled("   ", default=True))
        self.assertFalse(env_flag_enabled("maybe", default=False))

    def test_prod_rejects_demo_load(self) -> None:
        with self.assertRaises(RuntimeError) as ctx:
            assert_demo_data_safe_for_env(env="prod", load_demo=True)
        self.assertIn("SOKOL_LOAD_DEMO_DATA", str(ctx.exception))
        assert_demo_data_safe_for_env(env="development", load_demo=True)
        assert_demo_data_safe_for_env(env="prod", load_demo=False)

    def test_prod_rejects_seed_replace_without_confirm(self) -> None:
        with self.assertRaises(RuntimeError):
            assert_seed_replace_safe_for_env(env="production", replace=True)
        assert_seed_replace_safe_for_env(
            env="prod",
            replace=True,
            confirm_prod_replace=True,
        )
        assert_seed_replace_safe_for_env(env="development", replace=True)
        assert_seed_replace_safe_for_env(env="prod", replace=False)

    def test_destructive_dictionary_sync_disabled_in_prod(self) -> None:
        self.assertFalse(
            destructive_dictionary_sync_enabled(env="prod", flag="1")
        )
        self.assertTrue(
            destructive_dictionary_sync_enabled(env="development", flag=None)
        )
        self.assertFalse(
            destructive_dictionary_sync_enabled(env="development", flag="0")
        )

    def test_app_startup_requires_database_url(self) -> None:
        with self.assertRaises(RuntimeError) as ctx:
            assert_app_startup_safe(
                database_url="",
                jwt_secret="x" * MIN_PROD_JWT_SECRET_LEN,
                env="development",
                load_demo=False,
                replace=False,
            )
        self.assertIn("DATABASE_URL", str(ctx.exception))

    def test_app_startup_rejects_prod_demo(self) -> None:
        with self.assertRaises(RuntimeError):
            assert_app_startup_safe(
                database_url="postgresql+asyncpg://postgres:postgres@localhost/sokol",
                jwt_secret="x" * MIN_PROD_JWT_SECRET_LEN,
                env="prod",
                load_demo=True,
                replace=False,
            )

    def test_app_startup_allows_dev(self) -> None:
        assert_app_startup_safe(
            database_url="postgresql+asyncpg://postgres:postgres@localhost/sokol",
            jwt_secret=DEFAULT_JWT_SECRET,
            env="development",
            load_demo=True,
            replace=True,
        )


if __name__ == "__main__":
    unittest.main()
