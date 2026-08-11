from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings
from app.core.roles import Role

ALGORITHM = "HS256"
_PBKDF2_PREFIX = "pbkdf2_sha256$"
_PBKDF2_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _PBKDF2_ITERATIONS,
    ).hex()
    return f"{_PBKDF2_PREFIX}{_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(plain_password: str, stored: str) -> bool:
    if stored.startswith(_PBKDF2_PREFIX):
        try:
            _, iterations_s, salt, expected = stored.split("$", 3)
            iterations = int(iterations_s)
        except ValueError:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return hmac.compare_digest(digest, expected)
    if len(plain_password) != len(stored):
        return False
    return hmac.compare_digest(plain_password, stored)


def create_access_token(
    *,
    subject: str,
    role: Role | str,
    display_name: str,
    expires_minutes: int | None = None,
) -> str:
    expire_delta = timedelta(
        minutes=expires_minutes
        if expires_minutes is not None
        else settings.sokol_jwt_expire_minutes
    )
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": Role(role).value,
        "display_name": display_name,
        "iat": int(now.timestamp()),
        "exp": int((now + expire_delta).timestamp()),
    }
    return jwt.encode(payload, settings.sokol_jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.sokol_jwt_secret, algorithms=[ALGORITHM])
