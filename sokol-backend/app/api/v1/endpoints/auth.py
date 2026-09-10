from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserRead
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    return await auth_service.login(session, payload.username, payload.password)


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser = Depends(get_current_user)) -> UserRead:
    return UserRead(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        aliases=user.aliases,
        is_active=user.is_active,
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await auth_service.change_password(
        session,
        current_user,
        payload.current_password,
        payload.new_password,
    )
