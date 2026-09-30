"""Retention policy for docker/backup snapshots."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


def _load_retention():
    module_path = Path(__file__).resolve().parents[2] / "docker" / "backup" / "retention.py"
    spec = importlib.util.spec_from_file_location("sokol_backup_retention", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


retention = _load_retention()


def _load_minio_sync():
    module_path = Path(__file__).resolve().parents[2] / "docker" / "backup" / "minio_sync.py"
    spec = importlib.util.spec_from_file_location("sokol_minio_sync", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BackupRetentionTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.now = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _mkdir(self, stamp: datetime) -> Path:
        path = self.root / stamp.strftime(retention.SNAPSHOT_FMT)
        path.mkdir()
        (path / "MANIFEST.txt").write_text("ok", encoding="utf-8")
        return path

    def test_prunes_old_named_snapshots_but_keeps_minimum(self) -> None:
        old = self._mkdir(self.now - timedelta(days=20))
        mid = self._mkdir(self.now - timedelta(days=16))
        recent = self._mkdir(self.now - timedelta(days=1))
        (self.root / "notes").mkdir()
        removed = retention.prune(
            self.root,
            keep_days=14,
            keep_min=3,
            now=self.now,
            apply=True,
        )
        self.assertEqual(removed, [])
        self.assertTrue(old.is_dir())
        self.assertTrue(mid.is_dir())
        self.assertTrue(recent.is_dir())
        self.assertTrue((self.root / "notes").is_dir())

    def test_prunes_beyond_keep_min(self) -> None:
        very_old = self._mkdir(self.now - timedelta(days=40))
        old = self._mkdir(self.now - timedelta(days=20))
        keep_a = self._mkdir(self.now - timedelta(days=2))
        keep_b = self._mkdir(self.now - timedelta(days=1))
        keep_c = self._mkdir(self.now)
        removed = retention.prune(
            self.root,
            keep_days=14,
            keep_min=3,
            now=self.now,
            apply=True,
        )
        self.assertEqual(removed, [very_old.name, old.name])
        self.assertFalse(very_old.exists())
        self.assertFalse(old.exists())
        self.assertTrue(keep_a.is_dir())
        self.assertTrue(keep_b.is_dir())
        self.assertTrue(keep_c.is_dir())

    def test_ignores_partial_and_unknown_directories(self) -> None:
        unknown = self.root / "manual-copy"
        unknown.mkdir()
        partial = self.root / ".partial-2026-01-01T000000Z"
        partial.mkdir()
        removed = retention.prune(
            self.root,
            keep_days=1,
            keep_min=1,
            now=self.now,
            apply=True,
        )
        self.assertEqual(removed, [])
        self.assertTrue(unknown.is_dir())
        self.assertTrue(partial.is_dir())


class MinioSyncPathTests(unittest.TestCase):
    def test_rejects_path_traversal(self) -> None:
        sync = _load_minio_sync()
        root = Path("/backups/snap/minio")
        with self.assertRaises(ValueError):
            sync.local_object_path(root, "check-a", "../escape")

    def test_joins_object_key_under_bucket(self) -> None:
        sync = _load_minio_sync()
        root = Path("/backups/snap/minio")
        path = sync.local_object_path(root, "check-a", "az/file.pdf")
        self.assertEqual(path, root / "check-a" / "az" / "file.pdf")


def _load_schedule():
    module_path = Path(__file__).resolve().parents[2] / "docker" / "backup" / "schedule.py"
    spec = importlib.util.spec_from_file_location("sokol_backup_schedule", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BackupScheduleTests(unittest.TestCase):
    msk = timezone(timedelta(hours=3))

    def test_before_slot_waits_same_night(self) -> None:
        schedule = _load_schedule()
        now = datetime(2026, 10, 1, 0, 0, tzinfo=self.msk)
        nxt = schedule.next_run_at(now, 0, 5)
        self.assertEqual(nxt, datetime(2026, 10, 1, 0, 5, tzinfo=self.msk))
        self.assertEqual(schedule.seconds_until_next_run(now, 0, 5), 5 * 60)

    def test_at_slot_runs_immediately(self) -> None:
        schedule = _load_schedule()
        now = datetime(2026, 10, 1, 0, 5, tzinfo=self.msk)
        self.assertEqual(schedule.seconds_until_next_run(now, 0, 5), 0)

    def test_after_slot_waits_until_next_day(self) -> None:
        schedule = _load_schedule()
        now = datetime(2026, 10, 1, 13, 21, tzinfo=self.msk)
        nxt = schedule.next_run_at(now, 0, 5)
        self.assertEqual(nxt, datetime(2026, 10, 2, 0, 5, tzinfo=self.msk))

    def test_parse_hhmm(self) -> None:
        schedule = _load_schedule()
        self.assertEqual(schedule.parse_hhmm("00:05"), (0, 5))
        with self.assertRaises(ValueError):
            schedule.parse_hhmm("25:00")


if __name__ == "__main__":
    unittest.main()
