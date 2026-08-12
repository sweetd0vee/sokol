"""Startup security validation."""

from __future__ import annotations

import unittest

from app.core.startup_validation import (
    DEFAULT_JWT_SECRET,
    MIN_PROD_JWT_SECRET_LEN,
    assert_jwt_secret_safe_for_env,
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


if __name__ == "__main__":
    unittest.main()
