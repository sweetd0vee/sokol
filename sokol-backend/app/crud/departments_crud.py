from app.crud.dictionary_crud import DictionaryCrud, bind_dictionary_crud
from app.models.departments import Department


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
update_department = _ops.update
delete_department = _ops.delete

crud = DictionaryCrud(
    create=create_department,
    get=get_department,
    list=list_departments,
    count=count_departments,
    update=update_department,
    delete=delete_department,
)
