from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.core.roles import Role
from app.core.security import create_access_token, verify_password
from app.crud.users_crud import get_user_by_username, update_user_password
from app.db.session import get_db_session
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    user = await get_user_by_username(session, payload.username)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль.",
        )
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


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser = Depends(get_current_user)) -> UserRead:
    return UserRead(
        username=user.username,
        display_name=user.display_name,
        role=user.role,
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user = await get_user_by_username(session, current_user.username)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или деактивирован.",
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль.",
        )
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего.",
        )
    await update_user_password(session, user, payload.new_password)
    return None
