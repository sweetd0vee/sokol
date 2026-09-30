#!/usr/bin/env python3
"""Dump or restore all MinIO buckets without the `mc` binary."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from minio import Minio
from minio.deleteobjects import DeleteObject
from minio.error import S3Error


def local_object_path(root: Path, bucket: str, object_name: str) -> Path:
    rel = Path(object_name)
    if rel.is_absolute() or any(part == ".." for part in rel.parts):
        raise ValueError(f"unsafe object key: {object_name!r}")
    return root / bucket / rel


def _client() -> Minio:
    endpoint = os.environ.get("SOKOL_MINIO_ENDPOINT", "minio:9000")
    endpoint = endpoint.removeprefix("http://").removeprefix("https://")
    access = os.environ.get("MINIO_ROOT_USER") or os.environ.get("SOKOL_MINIO_ACCESS_KEY") or "sokol"
    secret = os.environ.get("MINIO_ROOT_PASSWORD") or os.environ.get("SOKOL_MINIO_SECRET_KEY") or ""
    if not secret:
        raise SystemExit("MINIO_ROOT_PASSWORD is required")
    secure = os.environ.get("SOKOL_MINIO_SECURE", "0").strip().lower() in {"1", "true", "yes"}
    return Minio(endpoint, access_key=access, secret_key=secret, secure=secure)


def dump_buckets(dest: Path) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    client = _client()
    count = 0
    for bucket in client.list_buckets():
        bucket_dir = dest / bucket.name
        bucket_dir.mkdir(parents=True, exist_ok=True)
        for obj in client.list_objects(bucket.name, recursive=True):
            if obj.is_dir:
                continue
            target = local_object_path(dest, bucket.name, obj.object_name)
            target.parent.mkdir(parents=True, exist_ok=True)
            client.fget_object(bucket.name, obj.object_name, str(target))
            count += 1
    return count


def _remote_keys(client: Minio, bucket: str) -> set[str]:
    keys: set[str] = set()
    for obj in client.list_objects(bucket, recursive=True):
        if not obj.is_dir:
            keys.add(obj.object_name)
    return keys


def restore_buckets(src: Path) -> int:
    if not src.is_dir():
        raise SystemExit(f"minio snapshot dir not found: {src}")
    client = _client()
    local_buckets = {path.name for path in src.iterdir() if path.is_dir()}
    count = 0
    for bucket in local_buckets:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        bucket_dir = src / bucket
        wanted: set[str] = set()
        for file_path in bucket_dir.rglob("*"):
            if not file_path.is_file():
                continue
            object_name = file_path.relative_to(bucket_dir).as_posix()
            client.fput_object(bucket, object_name, str(file_path))
            wanted.add(object_name)
            count += 1
        extra = _remote_keys(client, bucket) - wanted
        if extra:
            errors = list(client.remove_objects(bucket, [DeleteObject(key) for key in extra]))
            if errors:
                raise RuntimeError(f"failed to remove extra objects in {bucket}: {errors[0]}")
    for bucket in client.list_buckets():
        if bucket.name in local_buckets:
            continue
        leftover = _remote_keys(client, bucket.name)
        if leftover:
            errors = list(client.remove_objects(bucket.name, [DeleteObject(key) for key in leftover]))
            if errors:
                raise RuntimeError(f"failed to empty {bucket.name}: {errors[0]}")
        try:
            client.remove_bucket(bucket.name)
        except S3Error as exc:
            print(f"could not remove bucket {bucket.name}: {exc}", file=sys.stderr)
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("dump", "restore"))
    parser.add_argument("path")
    args = parser.parse_args(argv)
    root = Path(args.path)
    if args.action == "dump":
        print(dump_buckets(root))
        return 0
    print(restore_buckets(root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
