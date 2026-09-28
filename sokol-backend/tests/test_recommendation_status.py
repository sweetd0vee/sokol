"""Unit tests for date-driven recommendation status calculation."""

from __future__ import annotations

import os
import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/sokol_db",
)

from app.models.recommendations import RecommendationAdditionalStatus, RecommendationStatus
from app.services.recommendation_status import (
    MOSCOW_TZ,
    compute_auto_status_fields,
    control_zone_execution_date,
    overlay_computed_status_fields,
    seconds_until_next_moscow_run,
    status_phase,
    today_moscow,
)


TODAY = date(2026, 9, 10)


class RecommendationStatusCalcTests(unittest.TestCase):
    def test_phase_is_on_control_before_anchor_and_overdue_on_or_after(self) -> None:
        self.assertEqual(status_phase(date(2026, 9, 11), TODAY), "on_control")
        self.assertEqual(status_phase(date(2026, 9, 10), TODAY), "overdue")
        self.assertEqual(status_phase(date(2026, 9, 9), TODAY), "overdue")
        self.assertIsNone(status_phase(None, TODAY))

    def test_control_deadline_drives_status_and_indicator(self) -> None:
        future = compute_auto_status_fields(control_deadline=date(2026, 10, 1), today=TODAY)
        self.assertEqual(future["status"], RecommendationStatus.ON_CONTROL)
        self.assertEqual(future["indicator"], "на контроле")
        self.assertEqual(future["additional_status"], RecommendationAdditionalStatus.ON_CONTROL)
        self.assertEqual(future["additional_indicator"], "на контроле")

        due = compute_auto_status_fields(control_deadline=date(2026, 9, 1), today=TODAY)
        self.assertEqual(due["status"], RecommendationStatus.UNRESOLVED)
        self.assertEqual(due["indicator"], "не решено")
        self.assertEqual(due["additional_status"], RecommendationAdditionalStatus.DEADLINE_VIOLATED)
        self.assertEqual(due["additional_indicator"], "срок нарушен")

    def test_completed_during_audit_sets_star_and_on_time(self) -> None:
        updates = compute_auto_status_fields(
            control_deadline=date(2026, 8, 1),
            current_status=RecommendationStatus.ON_CONTROL,
            current_additional_status=RecommendationAdditionalStatus.ON_CONTROL,
            current_indicator="исполнено в ходе аудита",
            today=TODAY,
        )
        self.assertEqual(updates["status"], RecommendationStatus.COMPLETED)
        self.assertEqual(updates["indicator"], "исполнено в ходе аудита")
        self.assertEqual(updates["additional_status"], RecommendationAdditionalStatus.ON_TIME)
        self.assertEqual(updates["additional_indicator"], "в срок")

    def test_additional_status_follows_control_deadline_not_execution_date(self) -> None:
        updates = compute_auto_status_fields(
            control_deadline=date(2026, 8, 1),
            today=TODAY,
        )
        self.assertEqual(updates["status"], RecommendationStatus.UNRESOLVED)
        self.assertEqual(updates["additional_status"], RecommendationAdditionalStatus.DEADLINE_VIOLATED)
        self.assertEqual(updates["additional_indicator"], "срок нарушен")

    def test_control_zone_prefers_actual_completion_over_postponement(self) -> None:
        self.assertEqual(
            control_zone_execution_date(
                actual_completion_date=date(2026, 8, 10),
                deadline_extensions=[{"date": date(2026, 12, 1)}],
            ),
            date(2026, 8, 10),
        )

    def test_control_zone_uses_latest_postponement_when_actual_is_empty(self) -> None:
        self.assertEqual(
            control_zone_execution_date(
                deadline_extensions=[
                    {"date": "2026-10-01"},
                    {"date": "2026-12-15"},
                ],
                extension_1_date=date(2026, 9, 1),
            ),
            date(2026, 12, 15),
        )

    def test_overlay_uses_control_deadline_even_when_control_zone_has_another_date(self) -> None:
        existing = SimpleNamespace(
            deadline=date(2026, 8, 1),
            actual_completion_date=None,
            deadline_extensions=[{"date": "2026-12-01"}],
            extension_1_date=None,
            extension_2_reason=None,
            status=RecommendationStatus.IN_PROGRESS,
            additional_status=RecommendationAdditionalStatus.ON_CONTROL,
        )
        payload = overlay_computed_status_fields(
            {"name": "Рекомендация"},
            existing=existing,
            today=TODAY,
        )
        self.assertEqual(payload["status"], RecommendationStatus.UNRESOLVED)
        self.assertEqual(payload["additional_status"], RecommendationAdditionalStatus.DEADLINE_VIOLATED)
        self.assertEqual(payload["additional_indicator"], "срок нарушен")

    def test_terminal_and_manual_statuses_are_preserved(self) -> None:
        completed = compute_auto_status_fields(
            control_deadline=date(2026, 8, 1),
            current_status=RecommendationStatus.COMPLETED,
            current_additional_status=RecommendationAdditionalStatus.ON_TIME,
            today=TODAY,
        )
        self.assertNotIn("status", completed)
        self.assertNotIn("additional_status", completed)

    def test_overdue_pair_is_recomputed_when_deadline_moves(self) -> None:
        restored = compute_auto_status_fields(
            control_deadline=date(2026, 12, 1),
            current_status=RecommendationStatus.UNRESOLVED,
            current_additional_status=RecommendationAdditionalStatus.DEADLINE_VIOLATED,
            today=TODAY,
        )
        self.assertEqual(restored["status"], RecommendationStatus.ON_CONTROL)
        self.assertEqual(restored["additional_status"], RecommendationAdditionalStatus.ON_CONTROL)

    def test_overlay_uses_existing_row_when_payload_omits_dates(self) -> None:
        existing = SimpleNamespace(
            deadline=date(2026, 12, 1),
            actual_completion_date=None,
            deadline_extensions=None,
            extension_1_date=None,
            extension_2_reason=None,
            status=RecommendationStatus.IN_PROGRESS,
            additional_status=RecommendationAdditionalStatus.IN_PROGRESS,
        )
        payload = overlay_computed_status_fields(
            {"name": "Рекомендация"},
            existing=existing,
            today=TODAY,
        )
        self.assertEqual(payload["status"], RecommendationStatus.ON_CONTROL)
        self.assertEqual(payload["additional_status"], RecommendationAdditionalStatus.ON_CONTROL)

    def test_today_moscow_uses_utc_plus_three(self) -> None:
        just_after_midnight = datetime(2026, 9, 11, 0, 10, tzinfo=MOSCOW_TZ)
        self.assertEqual(today_moscow(just_after_midnight), date(2026, 9, 11))
        still_tenth = datetime(2026, 9, 10, 20, 50, tzinfo=timezone.utc)
        self.assertEqual(today_moscow(still_tenth), date(2026, 9, 10))

    def test_next_run_is_after_moscow_midnight(self) -> None:
        now = datetime(2026, 9, 10, 18, 0, tzinfo=MOSCOW_TZ)
        delay = seconds_until_next_moscow_run(now)
        target = datetime(2026, 9, 11, 0, 5, tzinfo=MOSCOW_TZ)
        self.assertAlmostEqual(delay, (target - now).total_seconds(), places=0)
