"""HTTP tests for JWT auth and RBAC."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from fastapi.testclient import TestClient

from app.api.deps import CurrentUser, get_current_user
from app.core.roles import Role
from app.core.security import create_access_token, hash_password
from app.db.session import get_db_session
from app.main import app
from app.models.users import User


def _admin_user() -> User:
    return User(
        id=uuid4(),
        username="Админ А.А.",
        password_hash=hash_password("admin"),
        role=Role.ADMIN.value,
        display_name="Администратор",
        aliases="admin",
        is_active=True,
    )


def _auditor_user(username: str = "Важник Д.С.") -> User:
    return User(
        id=uuid4(),
        username=username,
        password_hash=hash_password("auditor"),
        role=Role.AUDITOR.value,
        display_name=username,
        aliases=None,
        is_active=True,
    )


class AuthRbacTests(unittest.TestCase):
    def setUp(self) -> None:
        async def _fake_session():
            yield AsyncMock()

        app.dependency_overrides[get_db_session] = _fake_session
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.client.close()

    def test_status_is_public(self) -> None:
        response = self.client.get("/api/v1/status")
        self.assertEqual(response.status_code, 200)

    def test_protected_endpoint_requires_auth(self) -> None:
        response = self.client.get("/api/v1/checks")
        self.assertEqual(response.status_code, 401)

    @patch("app.api.deps.get_user_by_username", new_callable=AsyncMock)
    @patch("app.api.v1.endpoints.auth.get_user_by_username", new_callable=AsyncMock)
    def test_login_and_me(
        self,
        mock_login_get_user: AsyncMock,
        mock_deps_get_user: AsyncMock,
    ) -> None:
        user = _admin_user()
        mock_login_get_user.return_value = user
        mock_deps_get_user.return_value = user
        login = self.client.post(
            "/api/v1/auth/login",
            json={"username": "Админ А.А.", "password": "admin"},
        )
        self.assertEqual(login.status_code, 200, login.text)
        body = login.json()
        self.assertEqual(body["role"], "admin")
        self.assertTrue(body["access_token"])

        me = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["role"], "admin")

    @patch("app.api.deps.get_user_by_username", new_callable=AsyncMock)
    def test_bearer_rejects_deactivated_user(self, mock_get_user: AsyncMock) -> None:
        user = _admin_user()
        user.is_active = False
        mock_get_user.return_value = user
        token = create_access_token(
            subject=user.username,
            role=Role.ADMIN,
            display_name=user.display_name,
        )

        response = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 401)

    @patch("app.api.deps.get_user_by_username", new_callable=AsyncMock)
    def test_bearer_uses_database_role_for_rbac(self, mock_get_user: AsyncMock) -> None:
        user = _auditor_user(username="Админ А.А.")
        mock_get_user.return_value = user
        token = create_access_token(
            subject=user.username,
            role=Role.ADMIN,
            display_name="Администратор",
        )

        response = self.client.post(
            "/api/v1/settings/auditors",
            json={"full_name": "Тест Т.Т."},
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 403)

    @patch("app.api.v1.endpoints.auth.update_user_password", new_callable=AsyncMock)
    @patch("app.api.v1.endpoints.auth.get_user_by_username", new_callable=AsyncMock)
    def test_change_password(self, mock_get_user: AsyncMock, mock_update: AsyncMock) -> None:
        user = _admin_user()
        mock_get_user.return_value = user

        async def _admin() -> CurrentUser:
            return CurrentUser(
                username=user.username,
                display_name=user.display_name,
                role=Role.ADMIN,
            )

        app.dependency_overrides[get_current_user] = _admin
        response = self.client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "admin", "new_password": "new-secret"},
        )
        self.assertEqual(response.status_code, 204, response.text)
        mock_update.assert_awaited_once()

    @patch("app.api.v1.endpoints.auth.get_user_by_username", new_callable=AsyncMock)
    def test_change_password_rejects_wrong_current(self, mock_get_user: AsyncMock) -> None:
        mock_get_user.return_value = _admin_user()

        async def _admin() -> CurrentUser:
            return CurrentUser(
                username="Админ А.А.",
                display_name="Администратор",
                role=Role.ADMIN,
            )

        app.dependency_overrides[get_current_user] = _admin
        response = self.client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "wrong", "new_password": "new-secret"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("текущий пароль", response.json()["detail"].lower())

    @patch("app.api.v1.endpoints.auth.get_user_by_username", new_callable=AsyncMock)
    def test_login_accepts_admin_alias(self, mock_get_user: AsyncMock) -> None:
        mock_get_user.return_value = _admin_user()
        login = self.client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()["role"], "admin")
        self.assertEqual(login.json()["username"], "Админ А.А.")

    def test_auditor_cannot_delete_check(self) -> None:
        async def _auditor() -> CurrentUser:
            return CurrentUser(
                username="Важник Д.С.",
                display_name="Важник Д.С.",
                role=Role.AUDITOR,
            )

        app.dependency_overrides[get_current_user] = _auditor
        response = self.client.delete("/api/v1/checks/1")
        self.assertEqual(response.status_code, 403)

    def test_auditor_cannot_mutate_settings(self) -> None:
        async def _auditor() -> CurrentUser:
            return CurrentUser(
                username="Важник Д.С.",
                display_name="Важник Д.С.",
                role=Role.AUDITOR,
            )

        app.dependency_overrides[get_current_user] = _auditor
        response = self.client.post(
            "/api/v1/settings/auditors",
            json={"full_name": "Тест Т.Т."},
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_delete_check_reaches_handler(self) -> None:
        async def _admin() -> CurrentUser:
            return CurrentUser(
                username="Админ А.А.",
                display_name="Администратор",
                role=Role.ADMIN,
            )

        app.dependency_overrides[get_current_user] = _admin
        with patch(
            "app.api.v1.endpoints.checks.get_check",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = self.client.delete("/api/v1/checks/999999")
        # Auth passed; missing entity → 404 from handler.
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
