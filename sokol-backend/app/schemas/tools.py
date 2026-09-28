from pydantic import BaseModel


class ParsedRecommendationItem(BaseModel):
    name: str
    observation_name: str = ""
    audit_object: list[str]
    manager: str
    deadline: str
    completed_during_audit: bool = False
