from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials, HTTPBearer
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Role
from app.core.security import decode_access_token, verify_password
from app.crud.users_crud import get_user_by_username
from app.db.session import get_db_session

_bearer = HTTPBearer(auto_error=False)
_basic = HTTPBasic(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    username: str
    display_name: str
    role: Role

    @property
    def short_name(self) -> str:
        return self.username

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN


def _user_from_record(user) -> CurrentUser:
    return CurrentUser(
        username=user.username,
        display_name=user.display_name,
        role=Role(user.role),
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный или просроченный токен.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        username = str(payload.get("sub") or "").strip()
        role_raw = str(payload.get("role") or "").strip().lower()
        display_name = str(payload.get("display_name") or username).strip() or username
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный токен.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            role = Role(role_raw)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительная роль в токене.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        return CurrentUser(username=username, display_name=display_name, role=role)

    if basic_credentials is not None and basic_credentials.username:
        user = await get_user_by_username(session, basic_credentials.username)
        if user is None or not verify_password(basic_credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный логин или пароль.",
                headers={"WWW-Authenticate": "Basic"},
            )
        return _user_from_record(user)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется авторизация.",
        headers={"WWW-Authenticate": "Bearer"},
    )


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


require_admin = require_roles(Role.ADMIN)
