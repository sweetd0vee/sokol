from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, InvalidReferenceError
from app.core.roles import Role
from app.core.security import hash_password
from app.crud.auditors_crud import create_auditor, get_auditor_by_full_name
from app.crud.dictionary_crud import find_dictionary_duplicate_by_label
from app.crud.users_crud import create_user, get_user_by_username, list_users
from app.models.auditors import Auditor
from app.models.users import User
from app.schemas.users import UserCreate, UserListResponse, UserRead
from app.utils.check_key import get_leader_initials_code


async def list_users_page(
    session: AsyncSession,
    *,
    skip: int,
    limit: int,
) -> UserListResponse:
    users = await list_users(session)
    total = len(users)
    page = users[skip : skip + limit]
    return UserListResponse(items=[UserRead.model_validate(user) for user in page], total=total)


async def create_auditor_user(session: AsyncSession, payload: UserCreate) -> User:
    if payload.role != Role.AUDITOR:
        raise InvalidReferenceError(
            "Через приложение можно создавать только пользователей с ролью аудитора."
        )

    username = payload.username.strip()
    if await get_user_by_username(session, username) is not None:
        raise ConflictError("Пользователь с таким логином уже существует.")

    user = await create_user(
        session,
        username=username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        display_name=(payload.display_name or username).strip() or username,
        aliases=payload.aliases,
    )

    if await get_auditor_by_full_name(session, username) is None:
        code = get_leader_initials_code(username)
        duplicate_code = await find_dictionary_duplicate_by_label(
            session, Auditor, Auditor.code, code
        )
        if duplicate_code is None:
            await create_auditor(
                session,
                {"full_name": username, "code": code},
            )

    await session.commit()
    await session.refresh(user)
    return user
