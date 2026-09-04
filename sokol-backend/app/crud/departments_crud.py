from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dictionary_crud import bind_dictionary_crud
from app.crud.dictionary_errors import DuplicateDictionaryError, DictionaryProtectedError
from app.models.departments import Department
from app.schemas.departments import DepartmentUpdate
from app.services.dictionary_integrity import replace_recommendation_audit_object_label
from app.utils.dictionary_text import UNSPECIFIED_AUDIT_OBJECT, normalize_dictionary_label


_ops = bind_dictionary_crud(
    model=Department,
    label_field="name",
    dictionary_name="departments",
    order_by=(Department.name.asc(), Department.id.asc()),
    search_columns=(Department.name,),
)

create_department = _ops.create
get_department = _ops.get
list_departments = _ops.list
count_departments = _ops.count
delete_department = _ops.delete


async def update_department(
    session: AsyncSession,
    department: Department,
    department_in: DepartmentUpdate,
) -> Department:
    payload = department_in.model_dump(exclude_unset=True)
    old_name = department.name
    new_name = payload.get("name")
    if new_name is not None:
        normalized = normalize_dictionary_label(str(new_name))
        if old_name == UNSPECIFIED_AUDIT_OBJECT and normalized != old_name:
            raise DictionaryProtectedError(
                dictionary="departments",
                label=old_name,
                action="переименовать",
            )
        if normalized != old_name:
            await replace_recommendation_audit_object_label(
                session, old_name, normalized
            )
    try:
        return await _ops.update(session, department, department_in)
    except DuplicateDictionaryError:
        await session.rollback()
        raise
