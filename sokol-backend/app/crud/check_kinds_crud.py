from app.crud.dictionary_crud import bind_dictionary_crud
from app.models.check_kinds import CheckKind


_ops = bind_dictionary_crud(
    model=CheckKind,
    label_field="label",
    dictionary_name="check_kinds",
    order_by=(CheckKind.label.asc(), CheckKind.id.asc()),
    search_columns=(CheckKind.label,),
)

create_check_kind = _ops.create
get_check_kind = _ops.get
list_check_kinds = _ops.list
count_check_kinds = _ops.count
update_check_kind = _ops.update
delete_check_kind = _ops.delete
