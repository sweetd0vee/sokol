from app.api.v1.dictionary_router import DictionaryCrud, DictionaryRouterConfig, make_dictionary_router
from app.crud import departments_crud as crud
from app.schemas.departments import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentRead,
    DepartmentUpdate,
)

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/departments",
        tags=["departments"],
        crud=DictionaryCrud(
            create=crud.create_department,
            get=crud.get_department,
            list=crud.list_departments,
            count=crud.count_departments,
            update=crud.update_department,
            delete=crud.delete_department,
        ),
        create_schema=DepartmentCreate,
        update_schema=DepartmentUpdate,
        read_schema=DepartmentRead,
        list_schema=DepartmentListResponse,
        not_found="Департамент не найден.",
        handle_duplicates=True,
    )
)
