import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.router import api_router
from app.core.config import settings
from app.core.startup_validation import (
    assert_demo_data_safe_for_env,
    assert_jwt_secret_safe_for_env,
    assert_seed_replace_safe_for_env,
    env_flag_enabled,
)


if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is required. Set it in '.env' before запуском."
    )

assert_jwt_secret_safe_for_env(
    jwt_secret=settings.sokol_jwt_secret,
    env=settings.sokol_env,
)
assert_demo_data_safe_for_env(
    env=settings.sokol_env,
    load_demo=env_flag_enabled(os.getenv("SOKOL_LOAD_DEMO_DATA"), default=False),
)
assert_seed_replace_safe_for_env(
    env=settings.sokol_env,
    replace=env_flag_enabled(os.getenv("SOKOL_SEED_REPLACE"), default=False),
)

app = FastAPI(title=settings.app_name)
register_exception_handlers(app)
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
