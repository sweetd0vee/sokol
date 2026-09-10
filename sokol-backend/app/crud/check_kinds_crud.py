from app.crud.dictionary_crud import bind_dictionary_crud
from app.models.check_kinds import CheckKind


crud = bind_dictionary_crud(
    model=CheckKind,
    label_field="label",
    dictionary_name="check_kinds",
    order_by=(CheckKind.label.asc(), CheckKind.id.asc()),
    search_columns=(CheckKind.label,),
)

create_check_kind = crud.create
get_check_kind = crud.get
list_check_kinds = crud.list
count_check_kinds = crud.count
update_check_kind = crud.update
delete_check_kind = crud.delete
