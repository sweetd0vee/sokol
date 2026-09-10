from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.v1.dictionary_registry import include_dictionary_routers
from app.api.v1.endpoints import (
    analytics,
    attachments,
    auth,
    checks,
    health,
    instruments_reports,
    recommendations,
    users,
)


api_v1_router = APIRouter()
api_v1_router.include_router(health.router, tags=["health"])
api_v1_router.include_router(auth.router)
_auth = [Depends(get_current_user)]
api_v1_router.include_router(instruments_reports.router, dependencies=_auth)
api_v1_router.include_router(analytics.router, dependencies=_auth)
api_v1_router.include_router(checks.router, dependencies=_auth)
api_v1_router.include_router(recommendations.router, dependencies=_auth)
api_v1_router.include_router(attachments.router, dependencies=_auth)
include_dictionary_routers(api_v1_router, dependencies=_auth)
api_v1_router.include_router(users.router, dependencies=_auth)
