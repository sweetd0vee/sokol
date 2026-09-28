from __future__ import annotations

from dataclasses import dataclass
import xml.etree.ElementTree as ET


@dataclass
class RunFragment:
    text: str
    rPr: ET.Element | None = None
    br_before: bool = False
    is_tab: bool = False
    raw_r: ET.Element | None = None


@dataclass
class RecommendationEntry:
    text: str
    runs: list[RunFragment] | None = None


@dataclass
class Observation:
    """Наблюдение из аудиторского заключения."""

    number: str
    chapter: str
    chapter_title: str
    name: str
    materiality_level: str
    recommendations: str
    deadline: str
    rec_label: str
    name_runs: list[RunFragment] | None = None
    rec_runs: list[RunFragment] | None = None
    rec_entries: list[RecommendationEntry] | None = None
