from app.api.v1.dictionary_router import DictionaryRouterConfig, make_dictionary_router
from app.schemas.auditors import (
    AuditorCreate,
    AuditorListResponse,
    AuditorRead,
    AuditorUpdate,
)
from app.services.settings_dictionaries_service import auditors_crud_service

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/auditors",
        tags=["auditors"],
        crud=auditors_crud_service,
        create_schema=AuditorCreate,
        update_schema=AuditorUpdate,
        read_schema=AuditorRead,
        list_schema=AuditorListResponse,
        not_found="Аудитор не найден.",
    )
)
