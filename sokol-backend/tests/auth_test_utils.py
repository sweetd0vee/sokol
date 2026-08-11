"""Shared auth helpers for API smoke tests."""

from __future__ import annotations

from app.api.deps import CurrentUser, get_current_user
from app.core.roles import Role
from app.main import app


def override_current_user(role: Role = Role.ADMIN, username: str = "test") -> None:
    async def _user() -> CurrentUser:
        return CurrentUser(
            username=username,
            display_name=username,
            role=role,
        )

    app.dependency_overrides[get_current_user] = _user
