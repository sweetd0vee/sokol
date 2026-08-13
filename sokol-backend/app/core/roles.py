from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    DEPARTMENT_HEAD = "department_head"
    AUDITOR = "auditor"


ADMIN_ROLES = frozenset({Role.ADMIN, Role.DEPARTMENT_HEAD})


def is_admin_role(role: Role) -> bool:
    return role in ADMIN_ROLES
