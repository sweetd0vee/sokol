import asyncio
import os
from contextlib import asynccontextmanager

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
from app.services.recommendation_status_refresh import (
    run_recommendation_status_scheduler,
    status_scheduler_enabled,
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

@asynccontextmanager
async def lifespan(_app: FastAPI):
    task: asyncio.Task[None] | None = None
    if status_scheduler_enabled():
        task = asyncio.create_task(
            run_recommendation_status_scheduler(),
            name="recommendation-status-scheduler",
        )
    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(title=settings.app_name, lifespan=lifespan)
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
