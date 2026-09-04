"""Service bindings for settings dictionary CRUD operations."""

from app.crud import (
    audit_types_crud,
    auditors_crud,
    check_kinds_crud,
    departments_crud,
    effectiveness_ratings_crud,
)
from app.crud.dictionary_crud import DictionaryCrud

auditors_crud_service = DictionaryCrud(
    create=auditors_crud.create_auditor,
    get=auditors_crud.get_auditor,
    list=auditors_crud.list_auditors,
    count=auditors_crud.count_auditors,
    update=auditors_crud.update_auditor,
    delete=auditors_crud.delete_auditor,
)

departments_crud_service = DictionaryCrud(
    create=departments_crud.create_department,
    get=departments_crud.get_department,
    list=departments_crud.list_departments,
    count=departments_crud.count_departments,
    update=departments_crud.update_department,
    delete=departments_crud.delete_department,
)

audit_types_crud_service = DictionaryCrud(
    create=audit_types_crud.create_audit_type,
    get=audit_types_crud.get_audit_type,
    list=audit_types_crud.list_audit_types,
    count=audit_types_crud.count_audit_types,
    update=audit_types_crud.update_audit_type,
    delete=audit_types_crud.delete_audit_type,
)

check_kinds_crud_service = DictionaryCrud(
    create=check_kinds_crud.create_check_kind,
    get=check_kinds_crud.get_check_kind,
    list=check_kinds_crud.list_check_kinds,
    count=check_kinds_crud.count_check_kinds,
    update=check_kinds_crud.update_check_kind,
    delete=check_kinds_crud.delete_check_kind,
)

effectiveness_ratings_crud_service = DictionaryCrud(
    create=effectiveness_ratings_crud.create_effectiveness_rating,
    get=effectiveness_ratings_crud.get_effectiveness_rating,
    list=effectiveness_ratings_crud.list_effectiveness_ratings,
    count=effectiveness_ratings_crud.count_effectiveness_ratings,
    update=effectiveness_ratings_crud.update_effectiveness_rating,
    delete=effectiveness_ratings_crud.delete_effectiveness_rating,
)
