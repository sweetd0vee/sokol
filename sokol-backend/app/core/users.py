from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from app.core.config import settings
from app.core.roles import Role


@dataclass(frozen=True)
class AuthUserRecord:
    username: str
    password: str
    role: Role
    display_name: str


_DEFAULT_USERS = (
    AuthUserRecord(
        username="Админ А.А.",
        password="admin",
        role=Role.ADMIN,
        display_name="Администратор",
    ),
    AuthUserRecord(
        username="Аудитор А.А.",
        password="auditor",
        role=Role.AUDITOR,
        display_name="Аудитор А.А.",
    ),
)


def _parse_users(raw: str) -> tuple[AuthUserRecord, ...]:
    text = raw.strip()
    if not text:
        return _DEFAULT_USERS

    data = json.loads(text)
    if not isinstance(data, list) or not data:
        raise ValueError("SOKOL_AUTH_USERS must be a non-empty JSON array")

    users: list[AuthUserRecord] = []
    for item in data:
        if not isinstance(item, dict):
            raise ValueError("Each SOKOL_AUTH_USERS item must be an object")
        username = str(item.get("username", "")).strip()
        password = str(item.get("password", ""))
        role_raw = str(item.get("role", Role.AUDITOR.value)).strip().lower()
        display_name = str(item.get("display_name") or username).strip() or username
        if not username or not password:
            raise ValueError("SOKOL_AUTH_USERS items require username and password")
        users.append(
            AuthUserRecord(
                username=username,
                password=password,
                role=Role(role_raw),
                display_name=display_name,
            )
        )
    return tuple(users)


@lru_cache(maxsize=1)
def get_auth_users() -> tuple[AuthUserRecord, ...]:
    return _parse_users(settings.sokol_auth_users)


def find_auth_user(username: str) -> AuthUserRecord | None:
    needle = username.strip().casefold()
    for user in get_auth_users():
        if user.username.casefold() == needle:
            return user
    return None


def clear_auth_users_cache() -> None:
    get_auth_users.cache_clear()
