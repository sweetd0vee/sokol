"""Factory for settings dictionary CRUD routers."""

from dataclasses import dataclass
from typing import Optional, TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, require_admin
from app.crud.dictionary_crud import DictionaryCrud
from app.db.session import get_db_session
from app.services.dictionary_service import DictionaryService

CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)
ReadT = TypeVar("ReadT", bound=BaseModel)
ListT = TypeVar("ListT", bound=BaseModel)


@dataclass(frozen=True)
class DictionaryRouterConfig:
    prefix: str
    tags: list[str]
    crud: DictionaryCrud
    create_schema: type[CreateT]
    update_schema: type[UpdateT]
    read_schema: type[ReadT]
    list_schema: type[ListT]
    not_found: str


def make_dictionary_router(config: DictionaryRouterConfig) -> APIRouter:
    router = APIRouter(prefix=config.prefix, tags=config.tags)
    service = DictionaryService(crud=config.crud, not_found=config.not_found)
    create_schema = config.create_schema
    update_schema = config.update_schema
    read_schema = config.read_schema
    list_schema = config.list_schema

    async def create_endpoint(
        payload: create_schema,
        session: AsyncSession = Depends(get_db_session),
        _: CurrentUser = Depends(require_admin),
    ) -> ReadT:
        return await service.create(session, payload)

    async def list_endpoint(
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
        search: Optional[str] = Query(None, min_length=1),
        session: AsyncSession = Depends(get_db_session),
    ) -> ListT:
        items, total = await service.list(session, skip, limit, search)
        return list_schema(items=list(items), total=total)

    async def get_endpoint(
        item_id: UUID,
        session: AsyncSession = Depends(get_db_session),
    ) -> ReadT:
        return await service.get(session, item_id)

    async def update_endpoint(
        item_id: UUID,
        payload: update_schema,
        session: AsyncSession = Depends(get_db_session),
        _: CurrentUser = Depends(require_admin),
    ) -> ReadT:
        return await service.update(session, item_id, payload)

    async def delete_endpoint(
        item_id: UUID,
        session: AsyncSession = Depends(get_db_session),
        _: CurrentUser = Depends(require_admin),
    ) -> Response:
        await service.delete(session, item_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    router.add_api_route(
        "",
        create_endpoint,
        methods=["POST"],
        response_model=read_schema,
        status_code=status.HTTP_201_CREATED,
    )
    router.add_api_route("", list_endpoint, methods=["GET"], response_model=list_schema)
    router.add_api_route("/{item_id}", get_endpoint, methods=["GET"], response_model=read_schema)
    router.add_api_route("/{item_id}", update_endpoint, methods=["PATCH"], response_model=read_schema)
    router.add_api_route(
        "/{item_id}",
        delete_endpoint,
        methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT,
        response_class=Response,
    )
    return router
