"""Factory for settings dictionary CRUD routers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, TypeVar
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.crud.dictionary_errors import DuplicateDictionaryError
from app.db.session import get_db_session
from app.services.crud_errors import ResourceNotFoundError
from app.services.dictionary_service import DictionaryCrud, DictionaryService

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
    handle_duplicates: bool = False


def make_dictionary_router(config: DictionaryRouterConfig) -> APIRouter:
    router = APIRouter(prefix=config.prefix, tags=config.tags)
    service = DictionaryService(crud=config.crud, not_found=config.not_found)
    create_schema = config.create_schema
    update_schema = config.update_schema
    read_schema = config.read_schema
    list_schema = config.list_schema

    @router.post("", response_model=read_schema, status_code=status.HTTP_201_CREATED)
    async def create_endpoint(
        payload: dict[str, Any] = Body(...),
        session: AsyncSession = Depends(get_db_session),
        _: object = Depends(require_admin),
    ) -> Any:
        try:
            validated_payload = create_schema.model_validate(payload)
            return await service.create(session, validated_payload)
        except ValidationError as exc:
            raise RequestValidationError(exc.errors()) from exc
        except DuplicateDictionaryError as exc:
            if config.handle_duplicates:
                raise HTTPException(status_code=409, detail=str(exc)) from exc
            raise

    @router.get("", response_model=list_schema)
    async def list_endpoint(
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
        search: Optional[str] = Query(None, min_length=1),
        session: AsyncSession = Depends(get_db_session),
    ) -> Any:
        items, total = await service.list(session, skip, limit, search)
        return list_schema(items=list(items), total=total)

    @router.get("/{item_id}", response_model=read_schema)
    async def get_endpoint(
        item_id: UUID,
        session: AsyncSession = Depends(get_db_session),
    ) -> Any:
        try:
            return await service.get(session, item_id)
        except ResourceNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.patch("/{item_id}", response_model=read_schema)
    async def update_endpoint(
        item_id: UUID,
        payload: dict[str, Any] = Body(...),
        session: AsyncSession = Depends(get_db_session),
        _: object = Depends(require_admin),
    ) -> Any:
        try:
            validated_payload = update_schema.model_validate(payload)
            return await service.update(session, item_id, validated_payload)
        except ValidationError as exc:
            raise RequestValidationError(exc.errors()) from exc
        except ResourceNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except DuplicateDictionaryError as exc:
            if config.handle_duplicates:
                raise HTTPException(status_code=409, detail=str(exc)) from exc
            raise

    @router.delete(
        "/{item_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        response_class=Response,
    )
    async def delete_endpoint(
        item_id: UUID,
        session: AsyncSession = Depends(get_db_session),
        _: object = Depends(require_admin),
    ) -> Response:
        try:
            await service.delete(session, item_id)
        except ResourceNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router
