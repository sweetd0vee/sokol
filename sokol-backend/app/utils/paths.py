import os
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]


def get_repo_data_dir() -> Path:
    """Каталог data/ с Excel seed (монорепо, backend или Docker SOKOL_DATA_DIR)."""
    env_dir = (os.getenv("SOKOL_DATA_DIR") or "").strip()
    if env_dir:
        return Path(env_dir)
    candidates = (
        _REPO_ROOT / "data",
        _BACKEND_ROOT / "data",
        Path("/app/data"),
    )
    for path in candidates:
        if (path / "checks.xlsx").is_file():
            return path
    return candidates[0]


def get_backend_data_dir() -> Path:
    """Каталог data/ внутри sokol-backend."""
    return _BACKEND_ROOT / "data"


def get_materiality_images_dir() -> Path:
    """Каталог PNG для уровней существенности в генераторе Раздела II."""
    candidates = (
        get_backend_data_dir() / "images",
        get_repo_data_dir() / "images",
    )
    for path in candidates:
        if path.is_dir():
            return path
    return candidates[0]
