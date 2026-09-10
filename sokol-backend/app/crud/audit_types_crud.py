from app.crud.dictionary_crud import bind_dictionary_crud
from app.models.audit_types import AuditType


crud = bind_dictionary_crud(
    model=AuditType,
    order_by=(
        AuditType.code.asc(),
        AuditType.name.asc(),
        AuditType.id.asc(),
    ),
    search_columns=(AuditType.code, AuditType.name),
)

create_audit_type = crud.create
get_audit_type = crud.get
list_audit_types = crud.list
count_audit_types = crud.count
update_audit_type = crud.update
delete_audit_type = crud.delete
