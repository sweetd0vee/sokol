from app.api.v1.dictionary_router import DictionaryCrud, DictionaryRouterConfig, make_dictionary_router
from app.crud import auditors_crud as crud
from app.schemas.auditors import (
    AuditorCreate,
    AuditorListResponse,
    AuditorRead,
    AuditorUpdate,
)

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/auditors",
        tags=["auditors"],
        crud=DictionaryCrud(
            create=crud.create_auditor,
            get=crud.get_auditor,
            list=crud.list_auditors,
            count=crud.count_auditors,
            update=crud.update_auditor,
            delete=crud.delete_auditor,
        ),
        create_schema=AuditorCreate,
        update_schema=AuditorUpdate,
        read_schema=AuditorRead,
        list_schema=AuditorListResponse,
        not_found="Аудитор не найден.",
        handle_duplicates=True,
    )
)
