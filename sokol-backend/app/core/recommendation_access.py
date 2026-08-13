from __future__ import annotations

from app.core.person_match import person_field_matches_user
from app.core.roles import Role, is_admin_role


def user_can_manage_recommendation(*, role: Role, username: str, auditor: str) -> bool:
    if is_admin_role(role):
        return True
    return person_field_matches_user(auditor, username)
