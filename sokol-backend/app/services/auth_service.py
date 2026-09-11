"""Authentication use-cases: login and password change."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.current_user import CurrentUser
from app.core.exceptions import AuthenticationError, InvalidReferenceError
from app.core.roles import Role
from app.core.security import create_access_token, hash_password, verify_password
from app.crud.users_crud import get_user_by_username, set_password_hash
from app.models.users import User
from app.schemas.auth import TokenResponse


async def get_user_record(session: AsyncSession, username: str) -> User | None:
    return await get_user_by_username(session, username)


async def authenticate_credentials(session: AsyncSession, username: str, password: str) -> User:
    user = await get_user_by_username(session, username)
    if user is None or not verify_password(password, user.password_hash):
        raise AuthenticationError("Неверный логин или пароль.")
    return user


async def login(session: AsyncSession, username: str, password: str) -> TokenResponse:
    user = await authenticate_credentials(session, username, password)
    token = create_access_token(
        subject=user.username,
        role=Role(user.role),
        display_name=user.display_name,
    )
    return TokenResponse(
        access_token=token,
        username=user.username,
        display_name=user.display_name,
        role=Role(user.role),
    )


async def change_password(
    session: AsyncSession,
    current_user: CurrentUser,
    current_password: str,
    new_password: str,
) -> None:
    user = await get_user_by_username(session, current_user.username)
    if user is None or not user.is_active:
        raise AuthenticationError("Пользователь не найден или деактивирован.")
    if not verify_password(current_password, user.password_hash):
        raise InvalidReferenceError("Неверный текущий пароль.")
    if verify_password(new_password, user.password_hash):
        raise InvalidReferenceError("Новый пароль должен отличаться от текущего.")
    await set_password_hash(session, user, hash_password(new_password))
    await session.commit()
    await session.commit()
