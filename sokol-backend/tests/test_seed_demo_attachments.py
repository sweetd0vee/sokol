"""Каталог демо-вложений покрывает все слоты формы."""

from __future__ import annotations

import os
import unittest

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)
os.environ.setdefault("SOKOL_JWT_SECRET", "test-jwt-secret")

from app.db.seed_demo_attachments import demo_check_slots, demo_recommendation_slots
from app.schemas.attachments import CHECK_ATTACHMENT_SLOTS, RECOMMENDATION_ATTACHMENT_SLOTS


class SeedDemoAttachmentsCatalogTests(unittest.TestCase):
    def test_demo_files_cover_every_storage_slot(self) -> None:
        self.assertEqual(demo_check_slots(), CHECK_ATTACHMENT_SLOTS)
        self.assertEqual(demo_recommendation_slots(), RECOMMENDATION_ATTACHMENT_SLOTS)


if __name__ == "__main__":
    unittest.main()
