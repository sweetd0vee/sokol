from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.startup_validation import assert_jwt_secret_safe_for_env


if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is required. Set it in '.env' before запуском."
    )

assert_jwt_secret_safe_for_env(
    jwt_secret=settings.sokol_jwt_secret,
    env=settings.sokol_env,
)

app = FastAPI(title=settings.app_name)
cors_origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "version": "v1"}
