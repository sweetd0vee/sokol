from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.roles import Role
from app.crud.auditors_crud import create_auditor
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.crud.users_crud import create_user, get_user_by_username, list_users
from app.db.session import get_db_session
from app.schemas.auditors import AuditorCreate
from app.schemas.users import UserCreate, UserListResponse, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UserListResponse)
async def list_users_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> UserListResponse:
    users = await list_users(session)
    total = len(users)
    page = users[skip : skip + limit]
    return UserListResponse(items=[UserRead.model_validate(user) for user in page], total=total)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> UserRead:
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

    if payload.role == Role.AUDITOR:
        try:
            await create_auditor(session, AuditorCreate(full_name=username))
        except DuplicateDictionaryError:
            pass

    return UserRead.model_validate(user)
