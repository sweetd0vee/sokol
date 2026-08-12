from dataclasses import dataclass, field
from typing import List


@dataclass
class MemorandumRecommendation:
    paragraphs: List[str] = field(default_factory=list)
    deadline: str = ""
    observation_name: str = ""


@dataclass
class MemorandumAuditObject:
    name: str
    manager: str
    recommendations: List[MemorandumRecommendation] = field(default_factory=list)


@dataclass
class MemorandumSource:
    groups: List[MemorandumAuditObject] = field(default_factory=list)
