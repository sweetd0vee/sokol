from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.session import get_db_session
from app.schemas.users import UserCreate, UserListResponse, UserRead
from app.services import users_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UserListResponse)
async def list_users_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> UserListResponse:
    return await users_service.list_users_page(session, skip=skip, limit=limit)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db_session),
    _: object = Depends(require_admin),
) -> UserRead:
    user = await users_service.create_auditor_user(session, payload)
    return UserRead.model_validate(user)
