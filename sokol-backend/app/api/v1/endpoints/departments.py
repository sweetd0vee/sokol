from app.api.v1.dictionary_router import DictionaryRouterConfig, make_dictionary_router
from app.schemas.departments import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentRead,
    DepartmentUpdate,
)
from app.services.settings_dictionaries_service import departments_crud_service

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/departments",
        tags=["departments"],
        crud=departments_crud_service,
        create_schema=DepartmentCreate,
        update_schema=DepartmentUpdate,
        read_schema=DepartmentRead,
        list_schema=DepartmentListResponse,
        not_found="Департамент не найден.",
        handle_duplicates=True,
    )
)
