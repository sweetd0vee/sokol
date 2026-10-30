from dataclasses import dataclass
from typing import List, Optional

import xml.etree.ElementTree as ET


@dataclass
class RunFragment:
    text: str
    rPr: Optional[ET.Element] = None
    br_before: bool = False
    is_tab: bool = False
    raw_r: Optional[ET.Element] = None


@dataclass
class RecommendationEntry:
    text: str
    runs: Optional[List[RunFragment]] = None
    auditor: str = ""


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
    name_runs: Optional[List[RunFragment]] = None
    rec_runs: Optional[List[RunFragment]] = None
    rec_entries: Optional[List[RecommendationEntry]] = None
    audit_object: str = ""
    manager: str = ""
    auditor: str = ""
