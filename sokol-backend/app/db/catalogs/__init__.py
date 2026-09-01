"""Canonical dictionary lists and bootstrap-user constants."""

from app.db.catalogs.audit_types import AUDIT_TYPES
from app.db.catalogs.auditors import AUDITOR_CODES, AUDITORS
from app.db.catalogs.check_kinds import CHECK_KINDS
from app.db.catalogs.departments import DEPARTMENTS
from app.db.catalogs.effectiveness import EFFECTIVENESS_RATINGS
from app.db.catalogs.users import (
    ADMIN_ALIASES,
    ADMIN_DISPLAY_NAME,
    ADMIN_USERNAME,
    DEPARTMENT_HEAD_DISPLAY_NAME,
    DEPARTMENT_HEAD_USERNAME,
)

__all__ = [
    "ADMIN_ALIASES",
    "ADMIN_DISPLAY_NAME",
    "ADMIN_USERNAME",
    "AUDIT_TYPES",
    "AUDITOR_CODES",
    "AUDITORS",
    "CHECK_KINDS",
    "DEPARTMENT_HEAD_DISPLAY_NAME",
    "DEPARTMENT_HEAD_USERNAME",
    "DEPARTMENTS",
    "EFFECTIVENESS_RATINGS",
]
