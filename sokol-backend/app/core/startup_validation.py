"""Production security checks for application settings and bootstrap flags."""

from __future__ import annotations

DEFAULT_JWT_SECRET = "sokol-dev-jwt-secret-change-me"
MIN_PROD_JWT_SECRET_LEN = 32
_PROD_ENV_VALUES = frozenset({"prod", "production"})
_TRUE_FLAG_VALUES = frozenset({"1", "true", "yes", "on"})
_FALSE_FLAG_VALUES = frozenset({"0", "false", "no", "off"})
_FLAG_VALUES: dict[str, bool] = {
    **dict.fromkeys(_TRUE_FLAG_VALUES, True),
    **dict.fromkeys(_FALSE_FLAG_VALUES, False),
}


def is_production_env(env: str) -> bool:
    return env.strip().lower() in _PROD_ENV_VALUES


def env_flag_enabled(raw: str | None, *, default: bool = False) -> bool:
    """Parse a typical SOKOL_* env flag (`1`/`true`/`yes`/`on`)."""
    if raw is None:
        return default
    value = raw.strip().lower()
    if not value:
        return default
    return _FLAG_VALUES.get(value, default)


def destructive_dictionary_sync_enabled(*, env: str, flag: str | None) -> bool:
    """Prod never deletes extra dictionary/user rows; dev keeps current opt-out sync."""
    if is_production_env(env):
        return False
    return env_flag_enabled(flag, default=True)


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


def assert_demo_data_safe_for_env(*, env: str, load_demo: bool) -> None:
    if load_demo and is_production_env(env):
        raise RuntimeError(
            "SOKOL_LOAD_DEMO_DATA is incompatible with SOKOL_ENV=prod. "
            "Set SOKOL_LOAD_DEMO_DATA=0 for production."
        )


def assert_seed_replace_safe_for_env(
    *,
    env: str,
    replace: bool,
    confirm_prod_replace: bool = False,
) -> None:
    if not replace:
        return
    if is_production_env(env) and not confirm_prod_replace:
        raise RuntimeError(
            "Destructive replace of checks/recommendations is forbidden when "
            "SOKOL_ENV=prod unless --confirm-prod-replace is passed."
        )
