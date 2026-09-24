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
