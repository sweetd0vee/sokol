"""MinIO/S3-compatible storage: один bucket на проверку по serial_number."""

from __future__ import annotations

import asyncio
import io
import re
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import BinaryIO

from minio import Minio
from minio.commonconfig import CopySource
from minio.error import S3Error

from app.core.config import settings

_BUCKET_PREFIX = "check-"
_BUCKET_RE = re.compile(r"[^a-z0-9.-]")


def check_bucket_name(serial_number: str) -> str:
    """Имя bucket MinIO для проверки (3–63 символа, lowercase)."""
    safe = _BUCKET_RE.sub("-", serial_number.strip().lower())
    safe = re.sub(r"-+", "-", safe).strip(".-")
    name = f"{_BUCKET_PREFIX}{safe}"
    return name[:63].rstrip(".-")


def sanitize_filename(name: str) -> str:
    base = name.strip().replace("\\", "/").split("/")[-1]
    base = re.sub(r"[^\w.\- ()]", "_", base, flags=re.UNICODE)
    return base[:200] or "file"


def build_object_key(slot: str, original_name: str, *, recommendation_id: int | None = None) -> str:
    safe_name = sanitize_filename(original_name)
    unique = uuid.uuid4().hex[:12]
    filename = f"{unique}_{safe_name}"
    if recommendation_id is not None:
        return f"recommendations/{recommendation_id}/{slot}/{filename}"
    return f"{slot}/{filename}"


@dataclass(frozen=True)
class StoredObject:
    bucket: str
    object_key: str
    size_bytes: int


class MinioStorage:
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        *,
        secure: bool = False,
        region: str | None = None,
    ) -> None:
        self._client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
            region=region,
        )

    def _ensure_bucket_sync(self, bucket: str) -> None:
        if not self._client.bucket_exists(bucket):
            self._client.make_bucket(bucket)

    async def ensure_check_bucket(self, serial_number: str) -> str:
        bucket = check_bucket_name(serial_number)
        await asyncio.to_thread(self._ensure_bucket_sync, bucket)
        return bucket

    async def upload(
        self,
        serial_number: str,
        slot: str,
        data: BinaryIO,
        *,
        original_name: str,
        content_type: str,
        size_bytes: int,
        recommendation_id: int | None = None,
    ) -> StoredObject:
        bucket = await self.ensure_check_bucket(serial_number)
        object_key = build_object_key(slot, original_name, recommendation_id=recommendation_id)
        await asyncio.to_thread(
            self._client.put_object,
            bucket,
            object_key,
            data,
            size_bytes,
            content_type=content_type or "application/octet-stream",
        )
        return StoredObject(bucket=bucket, object_key=object_key, size_bytes=size_bytes)

    async def download(self, bucket: str, object_key: str) -> tuple[bytes, str | None]:
        def _read() -> tuple[bytes, str | None]:
            response = self._client.get_object(bucket, object_key)
            try:
                payload = response.read()
                content_type = response.headers.get("Content-Type")
                return payload, content_type
            finally:
                response.close()
                response.release_conn()

        return await asyncio.to_thread(_read)

    async def delete_object(self, bucket: str, object_key: str) -> None:
        await asyncio.to_thread(self._client.remove_object, bucket, object_key)

    async def copy_check_bucket_objects(self, old_serial_number: str, new_serial_number: str) -> int:
        old_bucket = check_bucket_name(old_serial_number)
        new_bucket = check_bucket_name(new_serial_number)
        if old_bucket == new_bucket:
            return 0

        def _copy() -> int:
            if not self._client.bucket_exists(old_bucket):
                return 0
            if not self._client.bucket_exists(new_bucket):
                self._client.make_bucket(new_bucket)

            copied = 0
            for obj in self._client.list_objects(old_bucket, recursive=True):
                self._client.copy_object(
                    new_bucket,
                    obj.object_name,
                    CopySource(old_bucket, obj.object_name),
                )
                copied += 1
            return copied

        return await asyncio.to_thread(_copy)

    async def delete_check_bucket(self, serial_number: str) -> None:
        bucket = check_bucket_name(serial_number)

        def _purge() -> None:
            if not self._client.bucket_exists(bucket):
                return
            objects = self._client.list_objects(bucket, recursive=True)
            for obj in objects:
                self._client.remove_object(bucket, obj.object_name)
            self._client.remove_bucket(bucket)

        await asyncio.to_thread(_purge)

    async def ping(self) -> bool:
        def _ping() -> bool:
            list(self._client.list_buckets())
            return True

        try:
            return await asyncio.to_thread(_ping)
        except S3Error:
            return False


@lru_cache
def get_storage() -> MinioStorage | None:
    if not settings.minio_enabled:
        return None
    return MinioStorage(
        settings.minio_endpoint,
        settings.minio_access_key,
        settings.minio_secret_key,
        secure=settings.minio_secure,
        region=settings.minio_region or None,
    )


def require_storage() -> MinioStorage:
    storage = get_storage()
    if storage is None:
        raise RuntimeError("MinIO storage is not configured.")
    return storage
