from app.api.v1.dictionary_router import DictionaryCrud, DictionaryRouterConfig, make_dictionary_router
from app.crud import audit_types_crud as crud
from app.schemas.audit_types import (
    AuditTypeCreate,
    AuditTypeListResponse,
    AuditTypeRead,
    AuditTypeUpdate,
)

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/audit_types",
        tags=["audit_types"],
        crud=DictionaryCrud(
            create=crud.create_audit_type,
            get=crud.get_audit_type,
            list=crud.list_audit_types,
            count=crud.count_audit_types,
            update=crud.update_audit_type,
            delete=crud.delete_audit_type,
        ),
        create_schema=AuditTypeCreate,
        update_schema=AuditTypeUpdate,
        read_schema=AuditTypeRead,
        list_schema=AuditTypeListResponse,
        not_found="Тип аудита не найден.",
    )
)
