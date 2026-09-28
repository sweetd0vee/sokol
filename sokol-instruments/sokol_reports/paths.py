"""Filesystem locations for the Streamlit app package."""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "images"
FAVICON_PATH = IMAGES_DIR / "sberbank.png"
CONTROL_FILE_TEMPLATE = DATA_DIR / "файл контроля шаблон (шапка).xlsx"
DEPARTMENTS_STORE_PATH = DATA_DIR / "departments.json"
