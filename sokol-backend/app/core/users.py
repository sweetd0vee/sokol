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
    aliases: tuple[str, ...] = ()


_DEFAULT_USERS = (
    AuthUserRecord(
        username="Админ А.А.",
        password="admin",
        role=Role.ADMIN,
        display_name="Администратор",
        aliases=("admin",),
    ),
    AuthUserRecord(
        username="Аудитор А.А.",
        password="auditor",
        role=Role.AUDITOR,
        display_name="Аудитор А.А.",
        aliases=("auditor",),
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
        aliases_raw = item.get("aliases") or []
        if isinstance(aliases_raw, str):
            aliases = tuple(part.strip() for part in aliases_raw.split(",") if part.strip())
        elif isinstance(aliases_raw, list):
            aliases = tuple(str(part).strip() for part in aliases_raw if str(part).strip())
        else:
            aliases = ()
        if not username or not password:
            raise ValueError("SOKOL_AUTH_USERS items require username and password")
        users.append(
            AuthUserRecord(
                username=username,
                password=password,
                role=Role(role_raw),
                display_name=display_name,
                aliases=aliases,
            )
        )
    return tuple(users)


@lru_cache(maxsize=1)
def get_auth_users() -> tuple[AuthUserRecord, ...]:
    return _parse_users(settings.sokol_auth_users)


def _normalize_login(value: str) -> str:
    # Latin lookalikes → Cyrillic so "Админ A.A." matches "Админ А.А."
    translated = value.strip().translate(
        str.maketrans("ABCEHKMOPTXYabcehkmoptxy", "АВСЕНКМОРТХУавсенкмортху")
    )
    return " ".join(translated.split()).casefold()


def find_auth_user(username: str) -> AuthUserRecord | None:
    needle = _normalize_login(username)
    if not needle:
        return None
    for user in get_auth_users():
        candidates = (user.username, *user.aliases)
        if any(_normalize_login(candidate) == needle for candidate in candidates):
            return user
    return None


def clear_auth_users_cache() -> None:
    get_auth_users.cache_clear()
