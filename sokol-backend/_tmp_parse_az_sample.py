from datetime import date
from pathlib import Path

from app.services.recommendation_status import compute_auto_status_fields
from app.services.reports.az_import import parse_recommendations_from_docx
from app.services.reports.section_ii.docx_parser import parse_observations_from_file_with_runs

path = Path(__file__).resolve().parents[1] / "data" / "az" / "аз_тест_индикаторов.docx"
observations = parse_observations_from_file_with_runs(str(path))
print("observations:", len(observations))
for obs in observations:
    print(
        obs.number,
        "|",
        obs.audit_object,
        "|",
        obs.manager,
        "|",
        obs.deadline,
        "|",
        (obs.recommendations or "")[:80],
    )

items, error = parse_recommendations_from_docx(str(path))
print("parse error:", error)
print("items:", 0 if not items else len(items))
today = date(2026, 9, 28)
for index, item in enumerate(items or [], start=1):
    control = date.fromisoformat(item.deadline) if item.deadline else None
    auto = compute_auto_status_fields(control_deadline=control, today=today)
    print(
        index,
        item.deadline,
        item.audit_object,
        item.manager,
        auto.get("indicator"),
        auto.get("additional_indicator"),
        item.name[:70],
    )
