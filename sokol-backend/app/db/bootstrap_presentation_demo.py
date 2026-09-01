"""Синхронизация справочников и загрузка презентационного демо-датасета."""

from app.db.bootstrap import bootstrap_presentation_demo, main
from app.db.runtime import run_async_main

__all__ = ["bootstrap_presentation_demo", "main"]


if __name__ == "__main__":
    run_async_main(main)
