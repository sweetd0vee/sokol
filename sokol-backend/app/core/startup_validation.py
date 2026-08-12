"""Production security checks for application settings."""

from __future__ import annotations

DEFAULT_JWT_SECRET = "sokol-dev-jwt-secret-change-me"
MIN_PROD_JWT_SECRET_LEN = 32
_PROD_ENV_VALUES = frozenset({"prod", "production"})


def is_production_env(env: str) -> bool:
    return env.strip().lower() in _PROD_ENV_VALUES


def assert_jwt_secret_safe_for_env(*, jwt_secret: str, env: str) -> None:
    """Refuse to start in production with the dev default or a weak JWT secret."""
    if not is_production_env(env):
        return

    secret = jwt_secret.strip()
    if secret == DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "SOKOL_JWT_SECRET is the default dev value. "
            "Set a unique secret of at least "
            f"{MIN_PROD_JWT_SECRET_LEN} characters before running with SOKOL_ENV=prod."
        )
    if len(secret) < MIN_PROD_JWT_SECRET_LEN:
        raise RuntimeError(
            f"SOKOL_JWT_SECRET must be at least {MIN_PROD_JWT_SECRET_LEN} characters "
            "when SOKOL_ENV=prod."
        )
