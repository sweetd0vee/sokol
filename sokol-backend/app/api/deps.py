from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials, HTTPBearer
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.current_user import CurrentUser
from app.core.roles import ADMIN_ROLES, Role
from app.core.security import decode_access_token, verify_password
from app.crud.users_crud import get_user_by_username
from app.db.session import get_db_session

_bearer = HTTPBearer(auto_error=False)
_basic = HTTPBasic(auto_error=False)

__all__ = [
    "CurrentUser",
    "get_current_user",
    "require_admin",
    "require_roles",
]


def _user_from_record(user) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=Role(user.role),
        aliases=user.aliases,
        is_active=user.is_active,
    )


def _unauthorized(detail: str, *, scheme: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": scheme},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    basic_credentials: HTTPBasicCredentials | None = Depends(_basic),
    session: AsyncSession = Depends(get_db_session),
) -> CurrentUser:
    if credentials is not None and credentials.scheme.lower() == "bearer" and credentials.credentials:
        try:
            payload = decode_access_token(credentials.credentials)
        except jwt.PyJWTError as exc:
            raise _unauthorized(
                "Недействительный или просроченный токен.",
                scheme="Bearer",
            ) from exc

        username = str(payload.get("sub") or "").strip()
        if not username:
            raise _unauthorized("Недействительный токен.", scheme="Bearer")

        user = await get_user_by_username(session, username)
        if user is None or not user.is_active:
            raise _unauthorized(
                "Пользователь не найден или деактивирован.",
                scheme="Bearer",
            )

        return _user_from_record(user)

    if (
        settings.basic_auth_enabled
        and basic_credentials is not None
        and basic_credentials.username
    ):
        user = await get_user_by_username(session, basic_credentials.username)
        if (
            user is None
            or not user.is_active
            or not verify_password(basic_credentials.password, user.password_hash)
        ):
            raise _unauthorized("Неверный логин или пароль.", scheme="Basic")
        return _user_from_record(user)

    raise _unauthorized("Требуется авторизация.", scheme="Bearer")


def require_roles(*roles: Role):
    allowed = frozenset(roles)

    async def _dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав.",
            )
        return user

    return _dependency


require_admin = require_roles(*ADMIN_ROLES)
