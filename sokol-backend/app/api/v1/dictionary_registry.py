"""Settings dictionary routers assembled from CRUD + schema configs."""

from __future__ import annotations

from fastapi import APIRouter, params

from app.api.v1.dictionary_router import DictionaryRouterConfig, make_dictionary_router
from app.crud.audit_types_crud import crud as audit_types_crud
from app.crud.auditors_crud import crud as auditors_crud
from app.crud.check_kinds_crud import crud as check_kinds_crud
from app.crud.departments_crud import crud as departments_crud
from app.crud.effectiveness_ratings_crud import crud as effectiveness_ratings_crud
from app.schemas.audit_types import (
    AuditTypeCreate,
    AuditTypeListResponse,
    AuditTypeRead,
    AuditTypeUpdate,
)
from app.schemas.auditors import (
    AuditorCreate,
    AuditorListResponse,
    AuditorRead,
    AuditorUpdate,
)
from app.schemas.check_kinds import (
    CheckKindCreate,
    CheckKindListResponse,
    CheckKindRead,
    CheckKindUpdate,
)
from app.schemas.departments import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentRead,
    DepartmentUpdate,
)
from app.schemas.effectiveness_ratings import (
    EffectivenessRatingCreate,
    EffectivenessRatingListResponse,
    EffectivenessRatingRead,
    EffectivenessRatingUpdate,
)

DICTIONARY_ROUTER_CONFIGS: tuple[DictionaryRouterConfig, ...] = (
    DictionaryRouterConfig(
        prefix="/settings/auditors",
        tags=["auditors"],
        crud=auditors_crud,
        create_schema=AuditorCreate,
        update_schema=AuditorUpdate,
        read_schema=AuditorRead,
        list_schema=AuditorListResponse,
        not_found="Аудитор не найден.",
    ),
    DictionaryRouterConfig(
        prefix="/settings/departments",
        tags=["departments"],
        crud=departments_crud,
        create_schema=DepartmentCreate,
        update_schema=DepartmentUpdate,
        read_schema=DepartmentRead,
        list_schema=DepartmentListResponse,
        not_found="Департамент не найден.",
    ),
    DictionaryRouterConfig(
        prefix="/settings/audit_types",
        tags=["audit_types"],
        crud=audit_types_crud,
        create_schema=AuditTypeCreate,
        update_schema=AuditTypeUpdate,
        read_schema=AuditTypeRead,
        list_schema=AuditTypeListResponse,
        not_found="Тип аудита не найден.",
    ),
    DictionaryRouterConfig(
        prefix="/settings/check_kinds",
        tags=["check_kinds"],
        crud=check_kinds_crud,
        create_schema=CheckKindCreate,
        update_schema=CheckKindUpdate,
        read_schema=CheckKindRead,
        list_schema=CheckKindListResponse,
        not_found="Вид проверки не найден.",
    ),
    DictionaryRouterConfig(
        prefix="/settings/effectiveness_ratings",
        tags=["effectiveness_ratings"],
        crud=effectiveness_ratings_crud,
        create_schema=EffectivenessRatingCreate,
        update_schema=EffectivenessRatingUpdate,
        read_schema=EffectivenessRatingRead,
        list_schema=EffectivenessRatingListResponse,
        not_found="Оценка эффективности не найдена.",
    ),
)


def include_dictionary_routers(
    router: APIRouter,
    *,
    dependencies: list[params.Depends],
) -> None:
    for config in DICTIONARY_ROUTER_CONFIGS:
        router.include_router(make_dictionary_router(config), dependencies=dependencies)
