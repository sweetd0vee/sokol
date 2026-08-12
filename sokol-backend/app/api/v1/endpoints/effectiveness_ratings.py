from app.api.v1.dictionary_router import DictionaryRouterConfig, make_dictionary_router
from app.schemas.effectiveness_ratings import (
    EffectivenessRatingCreate,
    EffectivenessRatingListResponse,
    EffectivenessRatingRead,
    EffectivenessRatingUpdate,
)
from app.services.settings_dictionaries_service import effectiveness_ratings_crud_service

router = make_dictionary_router(
    DictionaryRouterConfig(
        prefix="/settings/effectiveness_ratings",
        tags=["effectiveness_ratings"],
        crud=effectiveness_ratings_crud_service,
        create_schema=EffectivenessRatingCreate,
        update_schema=EffectivenessRatingUpdate,
        read_schema=EffectivenessRatingRead,
        list_schema=EffectivenessRatingListResponse,
        not_found="Оценка эффективности не найдена.",
    )
)
