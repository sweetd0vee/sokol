from app.crud.dictionary_crud import bind_dictionary_crud
from app.models.departments import Department


crud = bind_dictionary_crud(
    model=Department,
    label_field="name",
    dictionary_name="departments",
    order_by=(Department.name.asc(), Department.id.asc()),
    search_columns=(Department.name,),
)

create_department = crud.create
get_department = crud.get
list_departments = crud.list
count_departments = crud.count
update_department = crud.update
delete_department = crud.delete
