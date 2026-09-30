"""Shared OOXML namespaces and registration for Word packages."""

from __future__ import annotations

import xml.etree.ElementTree as ET

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
XML_NS = "http://www.w3.org/XML/1998/namespace"

_WORD_NAMESPACES = (
    ("w", W_NS),
    ("r", R_NS),
    ("wp", WP_NS),
    ("a", A_NS),
    ("pic", PIC_NS),
)


def register_word_namespaces() -> None:
    for prefix, uri in _WORD_NAMESPACES:
        try:
            ET.register_namespace(prefix, uri)
        except (ValueError, KeyError):
            pass


def local_name(tag: str) -> str:
    """Local part of a Clark notation tag (`{namespace}local`) or a bare name."""
    return tag.split("}")[-1] if "}" in tag else tag


def local_tag(el: object) -> str:
    """Local name of an ElementTree-like node. Non-element tags yield an empty string."""
    tag = getattr(el, "tag", "") or ""
    if not isinstance(tag, str):
        return ""
    return local_name(tag)
