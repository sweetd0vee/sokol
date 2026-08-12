from __future__ import annotations

from collections.abc import Sequence
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Role
from app.core.security import hash_password
from app.core.users import normalize_login
from app.models.users import User


def _parse_aliases(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    return tuple(part.strip() for part in raw.split(",") if part.strip())


async def list_users(session: AsyncSession) -> Sequence[User]:
    result = await session.execute(select(User).order_by(User.username.asc()))
    return result.scalars().all()


async def get_user_by_username(session: AsyncSession, username: str) -> Optional[User]:
    normalized = normalize_login(username)
    if not normalized:
        return None
    users = await list_users(session)
    for user in users:
        if not user.is_active:
            continue
        candidates = (user.username, *_parse_aliases(user.aliases))
        if any(normalize_login(candidate) == normalized for candidate in candidates):
            return user
    return None


async def create_user(
    session: AsyncSession,
    *,
    username: str,
    password: str,
    role: Role,
    display_name: str | None = None,
    aliases: Sequence[str] = (),
    is_active: bool = True,
) -> User:
    user = User(
        username=username.strip(),
        password_hash=hash_password(password),
        role=role.value,
        display_name=(display_name or username).strip() or username.strip(),
        aliases=",".join(alias.strip() for alias in aliases if alias.strip()) or None,
        is_active=is_active,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def ensure_user(
    session: AsyncSession,
    *,
    username: str,
    password: str,
    role: Role,
    display_name: str | None = None,
    aliases: Sequence[str] = (),
) -> bool:
    existing = await get_user_by_username(session, username)
    if existing is not None:
        return False
    await create_user(
        session,
        username=username,
        password=password,
        role=role,
        display_name=display_name,
        aliases=aliases,
    )
    return True
