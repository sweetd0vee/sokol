import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is required. Set it in '.env' before запуском."
    )

app = FastAPI(title=settings.app_name)
cors_raw = os.getenv("SOKOL_CORS_ORIGINS", "").strip()
if cors_raw:
    cors_origins = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]
else:
    cors_origins = ["*"]

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
