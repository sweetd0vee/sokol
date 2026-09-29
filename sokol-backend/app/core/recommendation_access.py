from __future__ import annotations

from app.core.exceptions import AccessDeniedError
from app.core.person_match import person_field_matches_user
from app.core.roles import Role, is_admin_role


def _matches(person_field: str | None, username: str) -> bool:
    if not person_field or not person_field.strip():
        return False
    return person_field_matches_user(person_field, username)


def user_can_manage_check(
    *,
    role: Role,
    username: str,
    check_leader: str,
    created_by: str | None = None,
) -> bool:
    if is_admin_role(role):
        return True
    return _matches(check_leader, username) or _matches(created_by, username)


def user_can_manage_recommendation(
    *,
    role: Role,
    username: str,
    auditor: str,
    created_by: str | None = None,
    check_leader: str | None = None,
    check_created_by: str | None = None,
) -> bool:
    """Auditor may edit a recommendation they lead, audit, or created, including via the parent check."""
    if is_admin_role(role):
        return True
    return (
        _matches(auditor, username)
        or _matches(created_by, username)
        or _matches(check_leader, username)
        or _matches(check_created_by, username)
    )


def user_can_create_recommendation(
    *,
    role: Role,
    username: str,
    auditor: str,
    check_leader: str,
    check_created_by: str | None = None,
) -> bool:
    if user_can_manage_check(
        role=role,
        username=username,
        check_leader=check_leader,
        created_by=check_created_by,
    ):
        return True
    return _matches(auditor, username)


def ensure_user_can_manage_check(
    *,
    role: Role,
    username: str,
    check_leader: str,
    created_by: str | None = None,
    message: str,
) -> None:
    if not user_can_manage_check(
        role=role,
        username=username,
        check_leader=check_leader,
        created_by=created_by,
    ):
        raise AccessDeniedError(message)


def ensure_user_can_manage_recommendation(
    *,
    role: Role,
    username: str,
    auditor: str,
    message: str,
    created_by: str | None = None,
    check_leader: str | None = None,
    check_created_by: str | None = None,
) -> None:
    if not user_can_manage_recommendation(
        role=role,
        username=username,
        auditor=auditor,
        created_by=created_by,
        check_leader=check_leader,
        check_created_by=check_created_by,
    ):
        raise AccessDeniedError(message)


def ensure_user_can_create_recommendation(
    *,
    role: Role,
    username: str,
    auditor: str,
    check_leader: str,
    message: str,
    check_created_by: str | None = None,
) -> None:
    if not user_can_create_recommendation(
        role=role,
        username=username,
        auditor=auditor,
        check_leader=check_leader,
        check_created_by=check_created_by,
    ):
        raise AccessDeniedError(message)
