from app.crud.dictionary_crud import bind_dictionary_crud
from app.models.effectiveness_ratings import EffectivenessRating


crud = bind_dictionary_crud(
    model=EffectivenessRating,
    label_field="label",
    dictionary_name="effectiveness_ratings",
    order_by=(EffectivenessRating.label.asc(), EffectivenessRating.id.asc()),
    search_columns=(EffectivenessRating.label,),
)

create_effectiveness_rating = crud.create
get_effectiveness_rating = crud.get
list_effectiveness_ratings = crud.list
count_effectiveness_ratings = crud.count
update_effectiveness_rating = crud.update
delete_effectiveness_rating = crud.delete
