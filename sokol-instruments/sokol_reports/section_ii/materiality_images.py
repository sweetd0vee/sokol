"""Embed materiality PNG markers into a DOCX package."""

from __future__ import annotations

import os
import struct
import zipfile
from typing import Optional

import xml.etree.ElementTree as ET

from sokol_reports.ooxml import CT_NS, REL_NS
from sokol_reports.paths import IMAGES_DIR

EMU_PER_CM = 360000
EMU_PER_METER = EMU_PER_CM * 100
DEFAULT_PNG_PIXELS_PER_METER = 3780
# Размер круга существенности в таблице Раздела II (~0.75 см).
MATERIALITY_DISPLAY_SIZE_EMU = int(0.75 * EMU_PER_CM)

_MATERIALITY_IMAGE = {
    "низкий": str(IMAGES_DIR / "green.png"),
    "средний": str(IMAGES_DIR / "yellow.png"),
    "высокий": str(IMAGES_DIR / "red.png"),
}
_MATERIALITY_MEDIA_NAME = {
    "низкий": "low",
    "средний": "medium",
    "высокий": "high",
}
_IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
CONTENT_TYPES_PATH = "[Content_Types].xml"
DOCUMENT_RELS_PATH = "word/_rels/document.xml.rels"


def default_rels_xml() -> bytes:
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{REL_NS}"/>'
    ).encode("utf-8")


def next_relationship_id(rels_root: ET.Element) -> int:
    max_id = 0
    for rel in rels_root.findall(f"./{{{REL_NS}}}Relationship"):
        rel_id = rel.get("Id") or ""
        if not rel_id.startswith("rId"):
            continue
        try:
            max_id = max(max_id, int(rel_id[3:]))
        except ValueError:
            continue
    return max_id + 1


def ensure_png_content_type(content_types_xml: bytes) -> bytes:
    root = ET.fromstring(content_types_xml)
    for default in root.findall(f"./{{{CT_NS}}}Default"):
        if (default.get("Extension") or "").lower() == "png":
            return content_types_xml
    ET.SubElement(
        root,
        f"{{{CT_NS}}}Default",
        attrib={"Extension": "png", "ContentType": "image/png"},
    )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def png_natural_extent_emu(payload: bytes) -> tuple[int, int]:
    if payload[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Файл уровня существенности должен быть PNG.")
    width_px, height_px = struct.unpack(">II", payload[16:24])
    x_ppm = y_ppm = DEFAULT_PNG_PIXELS_PER_METER
    offset = 8
    while offset + 8 <= len(payload):
        length = struct.unpack(">I", payload[offset:offset + 4])[0]
        kind = payload[offset + 4:offset + 8]
        data_start = offset + 8
        data_end = data_start + length
        if kind == b"pHYs" and length >= 9:
            x_ppm, y_ppm, unit = struct.unpack(">IIB", payload[data_start:data_start + 9])
            if unit != 1:
                x_ppm = y_ppm = DEFAULT_PNG_PIXELS_PER_METER
            break
        offset = data_end + 4
    cx = max(1, int(round(width_px * EMU_PER_METER / x_ppm)))
    cy = max(1, int(round(height_px * EMU_PER_METER / y_ppm)))
    return cx, cy


def materiality_display_extent_emu(payload: bytes) -> tuple[int, int]:
    """Масштабирует PNG до целевого размера в таблице (сохраняя пропорции)."""
    cx, cy = png_natural_extent_emu(payload)
    max_side = max(cx, cy)
    if max_side <= MATERIALITY_DISPLAY_SIZE_EMU:
        return cx, cy
    scale = MATERIALITY_DISPLAY_SIZE_EMU / max_side
    return max(1, int(round(cx * scale))), max(1, int(round(cy * scale)))


def build_materiality_image_package_parts(
    zf: zipfile.ZipFile,
    observations,
) -> tuple[dict, bytes, bytes, dict, Optional[str]]:
    used_levels = []
    for obs in observations:
        level = (obs.materiality_level or "").strip().lower()
        if level in _MATERIALITY_IMAGE and level not in used_levels:
            used_levels.append(level)

    rels_xml = zf.read(DOCUMENT_RELS_PATH) if DOCUMENT_RELS_PATH in zf.namelist() else default_rels_xml()
    content_types_xml = zf.read(CONTENT_TYPES_PATH)
    if not used_levels:
        return {}, rels_xml, content_types_xml, {}, None

    missing_images = [
        image_path
        for level in used_levels
        for image_path in [_MATERIALITY_IMAGE[level]]
        if not os.path.isfile(image_path)
    ]
    if missing_images:
        return (
            {},
            b"",
            b"",
            {},
            "Не найдены картинки уровня существенности: " + ", ".join(sorted(set(missing_images))),
        )

    rels_root = ET.fromstring(rels_xml)
    existing_names = set(zf.namelist())
    next_rel_num = next_relationship_id(rels_root)
    image_info = {}
    media_payloads = {}
    content_types_xml = ensure_png_content_type(content_types_xml)

    for level in used_levels:
        image_path = _MATERIALITY_IMAGE[level]
        media_name = f"sokol_materiality_{_MATERIALITY_MEDIA_NAME[level]}.png"
        media_path = f"word/media/{media_name}"
        suffix = 1
        while media_path in existing_names or media_path in media_payloads:
            media_name = f"sokol_materiality_{_MATERIALITY_MEDIA_NAME[level]}_{suffix}.png"
            media_path = f"word/media/{media_name}"
            suffix += 1

        rel_id = f"rId{next_rel_num}"
        next_rel_num += 1
        ET.SubElement(
            rels_root,
            f"{{{REL_NS}}}Relationship",
            attrib={
                "Id": rel_id,
                "Type": _IMAGE_REL_TYPE,
                "Target": f"media/{media_name}",
            },
        )
        with open(image_path, "rb") as image_file:
            payload = image_file.read()
        cx, cy = materiality_display_extent_emu(payload)
        media_payloads[media_path] = payload
        image_info[level] = {"rel_id": rel_id, "cx": cx, "cy": cy}

    return (
        image_info,
        ET.tostring(rels_root, encoding="utf-8", xml_declaration=True),
        content_types_xml,
        media_payloads,
        None,
    )
