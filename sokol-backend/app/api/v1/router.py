from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit_types,
    auditors,
    check_kinds,
    checks,
    effectiveness_ratings,
    health,
    instruments_reports,
    recommendations,
)


api_v1_router = APIRouter()
api_v1_router.include_router(health.router, tags=["health"])
api_v1_router.include_router(instruments_reports.router)
api_v1_router.include_router(checks.router)
api_v1_router.include_router(recommendations.router)
api_v1_router.include_router(auditors.router)
api_v1_router.include_router(audit_types.router)
api_v1_router.include_router(check_kinds.router)
api_v1_router.include_router(effectiveness_ratings.router)