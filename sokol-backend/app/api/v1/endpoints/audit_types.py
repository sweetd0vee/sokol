from app.api.v1.dictionary_router import DictionaryRouterConfig, make_dictionary_router
from app.schemas.audit_types import (
    AuditTypeCreate,
    AuditTypeListResponse,
    AuditTypeRead,
    AuditTypeUpdate,
)
from app.services.settings_dictionaries_service import audit_types_crud_service

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/audit_types",
        tags=["audit_types"],
        crud=audit_types_crud_service,
        create_schema=AuditTypeCreate,
        update_schema=AuditTypeUpdate,
        read_schema=AuditTypeRead,
        list_schema=AuditTypeListResponse,
        not_found="Тип аудита не найден.",
    )
)
