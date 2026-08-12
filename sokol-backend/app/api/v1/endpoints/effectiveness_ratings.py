from app.api.v1.dictionary_router import DictionaryCrud, DictionaryRouterConfig, make_dictionary_router
from app.crud import effectiveness_ratings_crud as crud
from app.schemas.effectiveness_ratings import (
    EffectivenessRatingCreate,
    EffectivenessRatingListResponse,
    EffectivenessRatingRead,
    EffectivenessRatingUpdate,
)

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/effectiveness_ratings",
        tags=["effectiveness_ratings"],
        crud=DictionaryCrud(
            create=crud.create_effectiveness_rating,
            get=crud.get_effectiveness_rating,
            list=crud.list_effectiveness_ratings,
            count=crud.count_effectiveness_ratings,
            update=crud.update_effectiveness_rating,
            delete=crud.delete_effectiveness_rating,
        ),
        create_schema=EffectivenessRatingCreate,
        update_schema=EffectivenessRatingUpdate,
        read_schema=EffectivenessRatingRead,
        list_schema=EffectivenessRatingListResponse,
        not_found="Оценка эффективности не найдена.",
    )
)
