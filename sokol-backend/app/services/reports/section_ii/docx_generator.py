# -*- coding: utf-8 -*-
"""
Генератор раздела II «Основные результаты аудита и аудиторские рекомендации».
ZIP-подход: копируем документ побайтово, заменяем только раздел II — сохраняются все стили и форматирование.
Таблица по образцу Приложение 1 АЗ_ВОО ЮЛ.docx.
Уровень существенности выводится текстом.
"""

import logging
import os
import re
import shutil
import struct
import tempfile
import zipfile
from typing import List, Optional

import xml.etree.ElementTree as ET

from app.core.logging import format_caught_error, log_caught_exception
from app.utils.paths import get_materiality_images_dir
from app.services.reports.section_ii.docx_parser import (
    parse_observations_from_file_with_runs,
)
from app.services.reports.section_ii.models import Observation
from app.services.reports.section_ii import fonts, table_builder, xml_utils
from app.services.reports.section_ii.bookmark_utils import (
    get_section_heading_template_paragraph,
    next_bookmark_id,
    parse_paragraph_xml,
    resolve_section2_bookmark_names,
    resolve_section2_heading_text,
)
from app.services.reports.section_ii.observation_links import ensure_observation_bookmarks
from app.services.reports.section_ii.patterns import DEFAULT_SECTION2_HEADING

logger = logging.getLogger(__name__)


W_NS = xml_utils.W_NS
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
EMU_PER_CM = 360000
EMU_PER_METER = EMU_PER_CM * 100
DEFAULT_PNG_PIXELS_PER_METER = 3780
# Размер круга существенности в таблице Раздела II (~0.75 см).
MATERIALITY_DISPLAY_SIZE_EMU = int(0.75 * EMU_PER_CM)

# Регистрируем префиксы для корректной сериализации новых XML-фрагментов.
for prefix, uri in [("w", W_NS), ("r", R_NS), ("wp", WP_NS), ("a", A_NS), ("pic", PIC_NS)]:
    try:
        ET.register_namespace(prefix, uri)
    except (ValueError, KeyError):
        pass

IMAGES_DIR = get_materiality_images_dir()
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
_CONTENT_TYPES_PATH = "[Content_Types].xml"
_DOCUMENT_RELS_PATH = "word/_rels/document.xml.rels"


def _create_page_break_paragraph() -> ET.Element:
    p = ET.Element(f"{{{W_NS}}}p")
    r = ET.SubElement(p, f"{{{W_NS}}}r")
    br = ET.SubElement(r, f"{{{W_NS}}}br")
    br.set(f"{{{W_NS}}}type", "page")
    return p


def _tag_local_name(qname: str) -> str:
    return qname.split(":", 1)[-1]


def _find_matching_element_end(xml: str, start: int, qname: str) -> int:
    tag_re = re.compile(rf"<(?P<closing>/)?{re.escape(qname)}(?=[\s>/])[^>]*>")
    depth = 0
    for match in tag_re.finditer(xml, start):
        is_closing = bool(match.group("closing"))
        is_self_closing = match.group(0).rstrip().endswith("/>")
        if is_closing:
            depth -= 1
            if depth == 0:
                return match.end()
            continue
        if not is_self_closing:
            depth += 1
        if match.start() == start and is_self_closing:
            return match.end()
    raise ValueError(f"Не найден конец XML-элемента {qname}")


def _find_body_block_spans(document_xml: str) -> list[tuple[int, int]]:
    body_match = re.search(r"<(?P<qname>[\w:]+:)?body(?=[\s>/])[^>]*>", document_xml)
    if not body_match:
        raise ValueError("Не найден w:body в document.xml")
    body_qname = (body_match.group("qname") or "") + "body"
    body_close = document_xml.find(f"</{body_qname}>", body_match.end())
    if body_close == -1:
        raise ValueError("Не найден закрывающий тег w:body в document.xml")

    spans: list[tuple[int, int]] = []
    tag_re = re.compile(r"<(?P<qname>[\w:]+)(?=[\s>/])[^>]*>")
    pos = body_match.end()
    while pos < body_close:
        match = tag_re.search(document_xml, pos, body_close)
        if not match:
            break
        qname = match.group("qname")
        local = _tag_local_name(qname)
        if local in xml_utils.XML_WRAPPER_TAGS:
            pos = match.end()
            continue
        end = _find_matching_element_end(document_xml, match.start(), qname)
        if local in {"p", "tbl"}:
            spans.append((match.start(), end))
        pos = end
    return spans


def _serialize_fragment(el: ET.Element) -> str:
    return ET.tostring(el, encoding="unicode", method="xml")


def _default_rels_xml() -> bytes:
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{REL_NS}"/>'
    ).encode("utf-8")


def _next_relationship_id(rels_root: ET.Element) -> int:
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


def _ensure_png_content_type(content_types_xml: bytes) -> bytes:
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


def _png_natural_extent_emu(payload: bytes) -> tuple[int, int]:
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


def _materiality_display_extent_emu(payload: bytes) -> tuple[int, int]:
    """Масштабирует PNG до целевого размера в таблице (сохраняя пропорции)."""
    cx, cy = _png_natural_extent_emu(payload)
    max_side = max(cx, cy)
    if max_side <= MATERIALITY_DISPLAY_SIZE_EMU:
        return cx, cy
    scale = MATERIALITY_DISPLAY_SIZE_EMU / max_side
    return max(1, int(round(cx * scale))), max(1, int(round(cy * scale)))


def _build_materiality_image_package_parts(
    zf: zipfile.ZipFile,
    observations,
) -> tuple[dict, bytes, bytes, dict, Optional[str]]:
    used_levels = []
    for obs in observations:
        level = (obs.materiality_level or "").strip().lower()
        if level in _MATERIALITY_IMAGE and level not in used_levels:
            used_levels.append(level)

    rels_xml = zf.read(_DOCUMENT_RELS_PATH) if _DOCUMENT_RELS_PATH in zf.namelist() else _default_rels_xml()
    content_types_xml = zf.read(_CONTENT_TYPES_PATH)
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
    next_rel_num = _next_relationship_id(rels_root)
    image_info = {}
    media_payloads = {}
    content_types_xml = _ensure_png_content_type(content_types_xml)

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
        cx, cy = _materiality_display_extent_emu(payload)
        media_payloads[media_path] = payload
        image_info[level] = {"rel_id": rel_id, "cx": cx, "cy": cy}

    return (
        image_info,
        ET.tostring(rels_root, encoding="utf-8", xml_declaration=True),
        content_types_xml,
        media_payloads,
        None,
    )


def _parse_observations_from_stripped_docx(
    source_docx_path: str,
    document_xml: str,
) -> List[Observation]:
    """Парсит наблюдения из копии docx с уже удалённым SOKOL-разделом II."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
        tmp_path = tmp.name
    try:
        with zipfile.ZipFile(source_docx_path, "r") as zf_in:
            with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf_out:
                for item in zf_in.infolist():
                    if item.filename == "word/document.xml":
                        zf_out.writestr(item, document_xml.encode("utf-8"))
                    else:
                        zf_out.writestr(item, zf_in.read(item.filename))
        return parse_observations_from_file_with_runs(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _strip_generated_section2_blocks(document_xml: str, min_idx: int) -> str:
    """Удаляет ранее вставленный SOKOL-раздел II перед повторной генерацией."""
    updated = document_xml
    for _ in range(32):
        root = ET.fromstring(updated.encode("utf-8"))
        body = root.find(f".//{{{W_NS}}}body")
        if body is None:
            return updated
        blocks = xml_utils.get_blocks_from_xml(body)
        block_spans = _find_body_block_spans(updated)
        if len(block_spans) != len(blocks):
            return updated
        ranges = xml_utils.find_generated_section2_block_ranges(body, min_idx=min_idx)
        if not ranges:
            return updated
        start_idx, end_idx = max(ranges, key=lambda item: item[0])
        updated = _replace_document_blocks_xml(updated, block_spans, start_idx, end_idx, "")
    return updated


def _replace_document_blocks_xml(
    original_xml: str,
    block_spans: list[tuple[int, int]],
    start_idx: int,
    end_idx: int,
    replacement_xml: str,
) -> str:
    if start_idx < 0 or start_idx > len(block_spans):
        raise ValueError("Некорректная точка вставки Раздела II")
    if end_idx < start_idx or end_idx > len(block_spans):
        raise ValueError("Некорректные границы Раздела II")

    if start_idx == len(block_spans):
        insert_at = block_spans[-1][1] if block_spans else original_xml.rfind("</w:body>")
        return original_xml[:insert_at] + replacement_xml + original_xml[insert_at:]

    replace_start = block_spans[start_idx][0]
    replace_end = block_spans[end_idx - 1][1] if end_idx > start_idx else replace_start
    return original_xml[:replace_start] + replacement_xml + original_xml[replace_end:]


def _validate_replacement_boundary(
    block_spans: list[tuple[int, int]],
    insert_idx: int,
    first_allowed_idx: int,
) -> Optional[str]:
    if insert_idx < first_allowed_idx:
        return (
            "Небезопасная точка вставки Раздела II: она находится в титульной "
            "странице/содержании. Документ не изменен."
        )
    if insert_idx <= 0:
        return "Небезопасная точка вставки Раздела II: начало документа. Документ не изменен."
    if insert_idx >= len(block_spans):
        return "Небезопасная точка вставки Раздела II: конец документа. Документ не изменен."
    return None


def _validate_unchanged_prefix(
    original_xml: str,
    new_xml: str,
    block_spans: list[tuple[int, int]],
    insert_idx: int,
) -> Optional[str]:
    prefix_end = block_spans[insert_idx][0]
    if original_xml[:prefix_end] != new_xml[:prefix_end]:
        return (
            "Проверка защиты титульной страницы не пройдена: XML до Раздела II "
            "изменился. Документ не изменен."
        )
    return None


def _validate_observation_hyperlinks(
    document_xml: str,
    anchors: dict,
) -> Optional[str]:
    if not anchors:
        return "Не удалось создать якоря наблюдений для гиперссылок."

    missing_bookmarks = []
    missing_links = []
    for number, anchor in anchors.items():
        if f'w:name="{anchor}"' not in document_xml:
            missing_bookmarks.append(number)
        has_hyperlink = f'w:anchor="{anchor}"' in document_xml
        has_field = f'HYPERLINK \\l "{anchor}"' in document_xml
        if not has_hyperlink and not has_field:
            missing_links.append(number)

    if missing_bookmarks:
        return "Не созданы закладки для наблюдений: " + ", ".join(missing_bookmarks[:10])
    if missing_links:
        return "Не созданы гиперссылки в таблице для наблюдений: " + ", ".join(missing_links[:10])
    return None


def process_document(
    input_path: str,
    output_path: str,
    with_hyperlinks: bool = False,
) -> tuple:
    """
    ZIP-подход: копируем документ, заменяем только раздел II.
    Сохраняются все стили, шрифты и форматирование.
    """
    try:
        # 1. Копируем документ побайтово
        shutil.copy2(input_path, output_path)

        # 2. Читаем document.xml и убираем ранее сгенерированный раздел II
        with zipfile.ZipFile(output_path, "r") as zf:
            original_document_xml = zf.read("word/document.xml").decode("utf-8")

        tree = ET.ElementTree(ET.fromstring(original_document_xml.encode("utf-8")))
        root = tree.getroot()
        body = root.find(f".//{{{W_NS}}}body")
        if body is None:
            return (None, [], "Не найден body в document.xml")

        first_block_after_page2 = xml_utils.find_first_block_after_page2(body)
        original_document_xml = _strip_generated_section2_blocks(
            original_document_xml,
            min_idx=first_block_after_page2,
        )

        # 3. Парсим наблюдения из очищенного документа (без старой таблицы раздела II)
        observations = _parse_observations_from_stripped_docx(output_path, original_document_xml)
        if not observations:
            return (None, [], "Наблюдения не найдены. Убедитесь, что документ содержит записи 'Наблюдение X.Y.'")

        # 4. Готовим картинки существенности как части DOCX-пакета.
        with zipfile.ZipFile(output_path, "r") as zf:
            (
                materiality_image_info,
                document_rels_xml,
                content_types_xml,
                media_payloads,
                materiality_error,
            ) = _build_materiality_image_package_parts(zf, observations)
        if materiality_error:
            return (None, [], materiality_error)
        tree = ET.ElementTree(ET.fromstring(original_document_xml.encode("utf-8")))
        root = tree.getroot()
        body = root.find(f".//{{{W_NS}}}body")
        if body is None:
            return (None, [], "Не найден body в document.xml")

        blocks = xml_utils.get_blocks_from_xml(body)
        block_spans = _find_body_block_spans(original_document_xml)
        if len(block_spans) != len(blocks):
            return (None, [], "Не удалось безопасно сопоставить XML-блоки документа. Титульная страница не изменена.")

        observation_anchors = {}
        if with_hyperlinks:
            # Закладки ставим до вставки раздела II, чтобы не забукмаркить ячейки новой таблицы.
            original_document_xml, observation_anchors, _ = ensure_observation_bookmarks(
                original_document_xml,
                [obs.number for obs in observations if obs.number],
                block_spans=block_spans,
                blocks=blocks,
            )
            tree = ET.ElementTree(ET.fromstring(original_document_xml.encode("utf-8")))
            root = tree.getroot()
            body = root.find(f".//{{{W_NS}}}body")
            if body is None:
                return (None, [], "Не найден body в document.xml")
            blocks = xml_utils.get_blocks_from_xml(body)
            block_spans = _find_body_block_spans(original_document_xml)
            if len(block_spans) != len(blocks):
                return (
                    None,
                    [],
                    "Не удалось безопасно сопоставить XML-блоки документа после добавления закладок.",
                )
            if not observation_anchors:
                return (
                    None,
                    [],
                    "Не найдены абзацы наблюдений для гиперссылок. "
                    "В разделе III должны быть абзацы вида «Наблюдение X.Y».",
                )
            expected_numbers = [obs.number for obs in observations if obs.number]
            missing_anchor_numbers = [
                number
                for number in expected_numbers
                if number not in observation_anchors
            ]
            if missing_anchor_numbers:
                return (
                    None,
                    [],
                    "Не созданы закладки для гиперссылок по наблюдениям: "
                    + ", ".join(missing_anchor_numbers[:10]),
                )

        # Страницы 1–2 (титул + содержание) не трогаем — min_idx = первый блок на стр. 3
        first_block_after_page2 = xml_utils.find_first_block_after_page2(body)

        section1_start = xml_utils.find_section1_start(body, min_idx=first_block_after_page2)

        # Раздел I и содержание должны остаться
        if section1_start is None:
            return (None, [], "Не найден раздел I (Аудиторское мнение). Документ должен содержать разделы в порядке: содержание, I, II, III.")

        safe_min_idx = max(first_block_after_page2, section1_start + 1)
        section2 = xml_utils.find_section2_in_xml(body, min_idx=safe_min_idx)

        if section2:
            start_idx, end_idx = section2
            if start_idx < first_block_after_page2:
                return (None, [], "Раздел II на странице содержания. Сохраняем стр. 1–2 (титул + содержание) без изменений.")
            if start_idx <= section1_start:
                return (None, [], "Раздел II не может идти до раздела I. Сохраняем содержание и порядок разделов.")
            insert_idx = start_idx
        else:
            insert_idx = xml_utils.find_insert_index_for_new_section2(
                body,
                section1_start,
                min_idx=safe_min_idx,
            )
            if insert_idx < first_block_after_page2:
                return (None, [], "Точка вставки на странице содержания. Сохраняем стр. 1–2 без изменений.")
            if insert_idx <= section1_start:
                return (None, [], "Точка вставки до раздела I. Сохраняем содержание и порядок разделов.")

        first_allowed_idx = max(first_block_after_page2, section1_start + 1)
        boundary_error = _validate_replacement_boundary(
            block_spans,
            insert_idx,
            first_allowed_idx,
        )
        if boundary_error:
            return (None, [], boundary_error)

        # 1. Определяем преобладающий шрифт в документе
        predominant_font = fonts.get_predominant_font(root)

        section2_start_idx = start_idx if section2 else None
        bookmark_names = resolve_section2_bookmark_names(
            original_document_xml,
            block_spans,
            section2_start_idx,
        )
        bookmark_start_id = next_bookmark_id(original_document_xml)
        section2_heading_text = resolve_section2_heading_text(
            original_document_xml,
            block_spans,
            section2_start_idx,
            default=DEFAULT_SECTION2_HEADING,
        )
        source_heading = None
        if section2_start_idx is not None and 0 <= section2_start_idx < len(block_spans):
            original_heading_xml = original_document_xml[
                block_spans[section2_start_idx][0]:block_spans[section2_start_idx][1]
            ]
            source_heading = parse_paragraph_xml(original_heading_xml)
        style_reference = get_section_heading_template_paragraph(body, section1_start, source_heading)

        # 2. Вставляем только раздел II: заголовок + таблица. Остальной текст не трогаем.
        heading = table_builder.create_heading_paragraph_xml(
            section2_heading_text,
            font=predominant_font,
            bookmark_names=bookmark_names,
            bookmark_start_id=bookmark_start_id,
            source_paragraph=source_heading,
            style_reference=style_reference,
        )
        table = table_builder.create_table_xml(
            observations,
            doc_root=root,
            predominant_font=predominant_font,
            materiality_image_info=materiality_image_info,
            observation_anchors=observation_anchors if with_hyperlinks else None,
        )

        replacement_xml = (
            _serialize_fragment(heading)
            + _serialize_fragment(table)
            + _serialize_fragment(_create_page_break_paragraph())
        )
        if section2:
            new_xml = _replace_document_blocks_xml(
                original_document_xml,
                block_spans,
                start_idx,
                end_idx,
                replacement_xml,
            )
        else:
            new_xml = _replace_document_blocks_xml(
                original_document_xml,
                block_spans,
                insert_idx,
                insert_idx,
                replacement_xml,
            )

        prefix_error = _validate_unchanged_prefix(
            original_document_xml,
            new_xml,
            block_spans,
            insert_idx,
        )
        if prefix_error:
            return (None, [], prefix_error)

        if with_hyperlinks:
            hyperlink_error = _validate_observation_hyperlinks(new_xml, observation_anchors)
            if hyperlink_error:
                return (None, [], hyperlink_error)

        # 5. Перезаписываем docx с новым document.xml
        tmp_path = output_path + ".tmp.docx"
        try:
            with zipfile.ZipFile(output_path, "r") as zf_in:
                with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf_out:
                    for item in zf_in.infolist():
                        if item.filename == "word/document.xml":
                            zf_out.writestr(item.filename, new_xml.encode("utf-8"))
                        elif item.filename == _DOCUMENT_RELS_PATH:
                            zf_out.writestr(item, document_rels_xml)
                        elif item.filename == _CONTENT_TYPES_PATH:
                            zf_out.writestr(item, content_types_xml)
                        else:
                            zf_out.writestr(item, zf_in.read(item.filename))
                    if _DOCUMENT_RELS_PATH not in zf_in.namelist():
                        zf_out.writestr(_DOCUMENT_RELS_PATH, document_rels_xml)
                    for media_path, payload in media_payloads.items():
                        zf_out.writestr(media_path, payload)
            shutil.move(tmp_path, output_path)
        except Exception:
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
            raise

        return (output_path, observations, None)
    except Exception as exc:
        log_caught_exception(logger, "Section II generation failed for %s", input_path)
        return (None, [], format_caught_error(exc))
