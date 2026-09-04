from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Role
from app.crud.auditors_crud import create_auditor
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.crud.users_crud import create_user, get_user_by_username, list_users
from app.models.users import User
from app.schemas.auditors import AuditorCreate
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Через приложение можно создавать только пользователей с ролью аудитора.",
        )

    username = payload.username.strip()
    if await get_user_by_username(session, username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким логином уже существует.",
        )

    user = await create_user(
        session,
        username=username,
        password=payload.password,
        role=payload.role,
        display_name=(payload.display_name or username).strip() or username,
        aliases=payload.aliases,
    )

    try:
        await create_auditor(
            session,
            AuditorCreate(
                full_name=username,
                code=get_leader_initials_code(username),
            ),
        )
    except DuplicateDictionaryError:
        pass

    return user
