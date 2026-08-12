from app.api.v1.dictionary_router import DictionaryCrud, DictionaryRouterConfig, make_dictionary_router
from app.crud import check_kinds_crud as crud
from app.schemas.check_kinds import (
    CheckKindCreate,
    CheckKindListResponse,
    CheckKindRead,
    CheckKindUpdate,
)

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/check_kinds",
        tags=["check_kinds"],
        crud=DictionaryCrud(
            create=crud.create_check_kind,
            get=crud.get_check_kind,
            list=crud.list_check_kinds,
            count=crud.count_check_kinds,
            update=crud.update_check_kind,
            delete=crud.delete_check_kind,
        ),
        create_schema=CheckKindCreate,
        update_schema=CheckKindUpdate,
        read_schema=CheckKindRead,
        list_schema=CheckKindListResponse,
        not_found="Вид проверки не найден.",
    )
)
