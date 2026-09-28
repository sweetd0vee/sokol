"""Read and rewrite OOXML (.docx) ZIP packages without changing other parts."""

from __future__ import annotations

import os
import tempfile
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DOCUMENT_XML_PATH = "word/document.xml"


def read_document_xml(docx_path: str | Path) -> str:
    with zipfile.ZipFile(docx_path, "r") as package:
        return package.read(DOCUMENT_XML_PATH).decode("utf-8")


def copy_docx_replacing_document_xml(
    source_path: str | Path,
    dest_path: str | Path,
    document_xml: str,
) -> None:
    payload = document_xml.encode("utf-8")
    with zipfile.ZipFile(source_path, "r") as source:
        with zipfile.ZipFile(dest_path, "w", zipfile.ZIP_DEFLATED) as dest:
            for item in source.infolist():
                if item.filename == DOCUMENT_XML_PATH:
                    dest.writestr(item, payload)
                else:
                    dest.writestr(item, source.read(item.filename))


def write_processed_docx(
    source_path: str | Path,
    dest_path: str | Path,
    *,
    document_xml: str,
    document_rels_xml: bytes,
    content_types_xml: bytes,
    media_payloads: dict[str, bytes],
    document_rels_path: str,
    content_types_path: str,
) -> None:
    document_payload = document_xml.encode("utf-8")
    with zipfile.ZipFile(source_path, "r") as source:
        with zipfile.ZipFile(dest_path, "w", zipfile.ZIP_DEFLATED) as dest:
            for item in source.infolist():
                if item.filename == DOCUMENT_XML_PATH:
                    dest.writestr(item.filename, document_payload)
                elif item.filename == document_rels_path:
                    dest.writestr(item, document_rels_xml)
                elif item.filename == content_types_path:
                    dest.writestr(item, content_types_xml)
                else:
                    dest.writestr(item, source.read(item.filename))
            if document_rels_path not in source.namelist():
                dest.writestr(document_rels_path, document_rels_xml)
            for media_path, payload in media_payloads.items():
                dest.writestr(media_path, payload)


@contextmanager
def temporary_docx_with_document_xml(
    source_path: str | Path,
    document_xml: str,
) -> Iterator[str]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
        tmp_path = tmp.name
    try:
        copy_docx_replacing_document_xml(source_path, tmp_path, document_xml)
        yield tmp_path
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
