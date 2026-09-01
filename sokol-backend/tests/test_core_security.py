"""Unit tests for JWT and password helpers."""

from __future__ import annotations

import os
import unittest

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.core.roles import Role
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class PasswordHashTests(unittest.TestCase):
    def test_hash_then_verify_succeeds(self) -> None:
        stored = hash_password("secret")
        self.assertTrue(stored.startswith("pbkdf2_sha256$"))
        self.assertTrue(verify_password("secret", stored))
        self.assertFalse(verify_password("other", stored))

    def test_hashes_are_salted(self) -> None:
        self.assertNotEqual(hash_password("secret"), hash_password("secret"))

    def test_malformed_pbkdf2_hash_is_rejected(self) -> None:
        self.assertFalse(verify_password("secret", "pbkdf2_sha256$not-a-hash"))
        self.assertFalse(verify_password("secret", "pbkdf2_sha256$abc$salt$digest"))

    def test_legacy_plaintext_compare(self) -> None:
        self.assertTrue(verify_password("admin", "admin"))
        self.assertFalse(verify_password("admin", "other"))
        self.assertFalse(verify_password("admin", "ad"))


class AccessTokenTests(unittest.TestCase):
    def test_roundtrip_contains_claims(self) -> None:
        token = create_access_token(
            subject="Админ А.А.",
            role=Role.ADMIN,
            display_name="Администратор",
            expires_minutes=5,
        )
        payload = decode_access_token(token)
        self.assertEqual(payload["sub"], "Админ А.А.")
        self.assertEqual(payload["role"], "admin")
        self.assertEqual(payload["display_name"], "Администратор")
        self.assertIn("iat", payload)
        self.assertIn("exp", payload)
        self.assertGreater(payload["exp"], payload["iat"])

    def test_role_string_is_normalized(self) -> None:
        token = create_access_token(
            subject="user",
            role="auditor",
            display_name="User",
            expires_minutes=1,
        )
        self.assertEqual(decode_access_token(token)["role"], "auditor")


if __name__ == "__main__":
    unittest.main()
