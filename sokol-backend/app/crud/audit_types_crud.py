from app.crud.dictionary_crud import bind_dictionary_crud
from app.models.audit_types import AuditType


_ops = bind_dictionary_crud(
    model=AuditType,
    order_by=(
        AuditType.code.asc(),
        AuditType.name.asc(),
        AuditType.id.asc(),
    ),
    search_columns=(AuditType.code, AuditType.name),
)

create_audit_type = _ops.create
get_audit_type = _ops.get
list_audit_types = _ops.list
count_audit_types = _ops.count
update_audit_type = _ops.update
delete_audit_type = _ops.delete
