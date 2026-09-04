from app.api.v1.dictionary_router import DictionaryRouterConfig, make_dictionary_router
from app.schemas.check_kinds import (
    CheckKindCreate,
    CheckKindListResponse,
    CheckKindRead,
    CheckKindUpdate,
)
from app.services.settings_dictionaries_service import check_kinds_crud_service

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/check_kinds",
        tags=["check_kinds"],
        crud=check_kinds_crud_service,
        create_schema=CheckKindCreate,
        update_schema=CheckKindUpdate,
        read_schema=CheckKindRead,
        list_schema=CheckKindListResponse,
        not_found="Вид проверки не найден.",
    )
)
