"""Генератор раздела II «Основные результаты аудита и аудиторские рекомендации».

ZIP-подход: копируем документ побайтово, заменяем только раздел II —
сохраняются все стили и форматирование.
"""

from __future__ import annotations

import os
import shutil
import zipfile
import xml.etree.ElementTree as ET

from sokol_reports.docx_package import (
    read_document_xml,
    temporary_docx_with_document_xml,
    write_processed_docx,
)
from sokol_reports.ooxml import W_NS, register_word_namespaces
from sokol_reports.section_ii import fonts, table_builder, xml_utils
from sokol_reports.section_ii.bookmark_utils import (
    get_section_heading_template_paragraph,
    next_bookmark_id,
    parse_paragraph_xml,
    resolve_section2_bookmark_names,
    resolve_section2_heading_text,
)
from sokol_reports.section_ii.document_xml import (
    create_page_break_paragraph,
    find_body_block_spans,
    replace_document_blocks_xml,
    serialize_fragment,
    strip_generated_section2_blocks,
    validate_replacement_boundary,
    validate_unchanged_prefix,
)
from sokol_reports.section_ii.docx_parser import parse_observations_from_file_with_runs
from sokol_reports.section_ii.materiality_images import (
    CONTENT_TYPES_PATH,
    DOCUMENT_RELS_PATH,
    build_materiality_image_package_parts,
)
from sokol_reports.section_ii.models import Observation
from sokol_reports.section_ii.observation_links import ensure_observation_bookmarks
from sokol_reports.section_ii.patterns import DEFAULT_SECTION2_HEADING

register_word_namespaces()

ProcessResult = tuple[str | None, list[Observation], str | None]


def _parse_observations_from_stripped_docx(
    source_docx_path: str,
    document_xml: str,
) -> list[Observation]:
    """Парсит наблюдения из копии docx с уже удалённым SOKOL-разделом II."""
    with temporary_docx_with_document_xml(source_docx_path, document_xml) as tmp_path:
        return parse_observations_from_file_with_runs(tmp_path)


def _load_body(document_xml: str) -> tuple[ET.Element, ET.Element] | None:
    tree = ET.ElementTree(ET.fromstring(document_xml.encode("utf-8")))
    root = tree.getroot()
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return None
    return root, body


def _validate_observation_hyperlinks(document_xml: str, anchors: dict[str, str]) -> str | None:
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


def _apply_observation_bookmarks(
    document_xml: str,
    observations: list[Observation],
    blocks: list,
    block_spans: list[tuple[int, int]],
) -> tuple[str, dict[str, str], str | None]:
    observation_names = {
        obs.number: (obs.name or "").strip()
        for obs in observations
        if obs.number
    }
    document_xml, observation_anchors, _ = ensure_observation_bookmarks(
        document_xml,
        list(observation_names),
        block_spans=block_spans,
        blocks=blocks,
        observation_names=observation_names,
    )
    loaded = _load_body(document_xml)
    if loaded is None:
        return document_xml, {}, "Не найден body в document.xml"
    _root, body = loaded
    blocks = xml_utils.get_blocks_from_xml(body)
    block_spans = find_body_block_spans(document_xml)
    if len(block_spans) != len(blocks):
        return (
            document_xml,
            {},
            "Не удалось безопасно сопоставить XML-блоки документа после добавления закладок.",
        )
    if not observation_anchors:
        return (
            document_xml,
            {},
            "Не найдены абзацы наблюдений для гиперссылок. "
            "В разделе III должны быть абзацы вида «Наблюдение X.Y».",
        )
    expected_numbers = [obs.number for obs in observations if obs.number]
    missing_anchor_numbers = [
        number for number in expected_numbers if number not in observation_anchors
    ]
    if missing_anchor_numbers:
        return (
            document_xml,
            {},
            "Не созданы закладки для гиперссылок по наблюдениям: "
            + ", ".join(missing_anchor_numbers[:10]),
        )
    return document_xml, observation_anchors, None


def _locate_section2_insert(
    body,
    block_spans: list[tuple[int, int]],
) -> tuple[int, int | None, int | None, str | None]:
    """Return (insert_idx, start_idx, end_idx, error). start/end set when replacing an existing section II."""
    first_block_after_page2 = xml_utils.find_first_block_after_page2(body)
    section1_start = xml_utils.find_section1_start(body, min_idx=first_block_after_page2)
    if section1_start is None:
        return (
            0,
            None,
            None,
            "Не найден раздел I (Аудиторское мнение). Документ должен содержать разделы в порядке: содержание, I, II, III.",
        )

    safe_min_idx = max(first_block_after_page2, section1_start + 1)
    section2 = xml_utils.find_section2_in_xml(body, min_idx=safe_min_idx)
    start_idx: int | None = None
    end_idx: int | None = None

    if section2:
        start_idx, end_idx = section2
        if start_idx < first_block_after_page2:
            return (
                0,
                None,
                None,
                "Раздел II на странице содержания. Сохраняем стр. 1–2 (титул + содержание) без изменений.",
            )
        if start_idx <= section1_start:
            return (
                0,
                None,
                None,
                "Раздел II не может идти до раздела I. Сохраняем содержание и порядок разделов.",
            )
        insert_idx = start_idx
    else:
        insert_idx = xml_utils.find_insert_index_for_new_section2(
            body,
            section1_start,
            min_idx=safe_min_idx,
        )
        if insert_idx < first_block_after_page2:
            return (0, None, None, "Точка вставки на странице содержания. Сохраняем стр. 1–2 без изменений.")
        if insert_idx <= section1_start:
            return (0, None, None, "Точка вставки до раздела I. Сохраняем содержание и порядок разделов.")

    first_allowed_idx = max(first_block_after_page2, section1_start + 1)
    boundary_error = validate_replacement_boundary(block_spans, insert_idx, first_allowed_idx)
    if boundary_error:
        return (0, None, None, boundary_error)
    return insert_idx, start_idx, end_idx, None


def _build_section2_replacement(
    *,
    observations: list[Observation],
    document_xml: str,
    root: ET.Element,
    body,
    block_spans: list[tuple[int, int]],
    start_idx: int | None,
    materiality_image_info: dict,
    observation_anchors: dict[str, str] | None,
) -> str:
    predominant_font = fonts.get_predominant_font(root)
    bookmark_names = resolve_section2_bookmark_names(document_xml, block_spans, start_idx)
    bookmark_start_id = next_bookmark_id(document_xml)
    section2_heading_text = resolve_section2_heading_text(
        document_xml,
        block_spans,
        start_idx,
        default=DEFAULT_SECTION2_HEADING,
    )
    source_heading = None
    if start_idx is not None and 0 <= start_idx < len(block_spans):
        original_heading_xml = document_xml[block_spans[start_idx][0] : block_spans[start_idx][1]]
        source_heading = parse_paragraph_xml(original_heading_xml)
    section1_start = xml_utils.find_section1_start(
        body,
        min_idx=xml_utils.find_first_block_after_page2(body),
    )
    style_reference = get_section_heading_template_paragraph(body, section1_start, source_heading)

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
        observation_anchors=observation_anchors,
    )
    return (
        serialize_fragment(heading)
        + serialize_fragment(table)
        + serialize_fragment(create_page_break_paragraph())
    )


def _replace_section2_xml(
    document_xml: str,
    block_spans: list[tuple[int, int]],
    insert_idx: int,
    start_idx: int | None,
    end_idx: int | None,
    replacement_xml: str,
) -> str:
    if start_idx is not None and end_idx is not None:
        return replace_document_blocks_xml(
            document_xml,
            block_spans,
            start_idx,
            end_idx,
            replacement_xml,
        )
    return replace_document_blocks_xml(
        document_xml,
        block_spans,
        insert_idx,
        insert_idx,
        replacement_xml,
    )


def _write_output_docx(
    output_path: str,
    document_xml: str,
    document_rels_xml: bytes,
    content_types_xml: bytes,
    media_payloads: dict[str, bytes],
) -> None:
    tmp_path = output_path + ".tmp.docx"
    try:
        write_processed_docx(
            output_path,
            tmp_path,
            document_xml=document_xml,
            document_rels_xml=document_rels_xml,
            content_types_xml=content_types_xml,
            media_payloads=media_payloads,
            document_rels_path=DOCUMENT_RELS_PATH,
            content_types_path=CONTENT_TYPES_PATH,
        )
        shutil.move(tmp_path, output_path)
    except Exception:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        raise


def process_document(
    input_path: str,
    output_path: str,
    with_hyperlinks: bool = False,
) -> ProcessResult:
    """
    ZIP-подход: копируем документ, заменяем только раздел II.
    Сохраняются все стили, шрифты и форматирование.
    """
    try:
        shutil.copy2(input_path, output_path)
        original_document_xml = read_document_xml(output_path)

        loaded = _load_body(original_document_xml)
        if loaded is None:
            return (None, [], "Не найден body в document.xml")
        _root, body = loaded

        first_block_after_page2 = xml_utils.find_first_block_after_page2(body)
        original_document_xml = strip_generated_section2_blocks(
            original_document_xml,
            min_idx=first_block_after_page2,
        )

        observations = _parse_observations_from_stripped_docx(output_path, original_document_xml)
        if not observations:
            return (None, [], "Наблюдения не найдены. Убедитесь, что документ содержит записи 'Наблюдение X.Y.'")

        with zipfile.ZipFile(output_path, "r") as zf:
            (
                materiality_image_info,
                document_rels_xml,
                content_types_xml,
                media_payloads,
                materiality_error,
            ) = build_materiality_image_package_parts(zf, observations)
        if materiality_error:
            return (None, [], materiality_error)

        loaded = _load_body(original_document_xml)
        if loaded is None:
            return (None, [], "Не найден body в document.xml")
        root, body = loaded
        blocks = xml_utils.get_blocks_from_xml(body)
        block_spans = find_body_block_spans(original_document_xml)
        if len(block_spans) != len(blocks):
            return (None, [], "Не удалось безопасно сопоставить XML-блоки документа. Титульная страница не изменена.")

        observation_anchors: dict[str, str] = {}
        if with_hyperlinks:
            original_document_xml, observation_anchors, bookmark_error = _apply_observation_bookmarks(
                original_document_xml,
                observations,
                blocks,
                block_spans,
            )
            if bookmark_error:
                return (None, [], bookmark_error)
            loaded = _load_body(original_document_xml)
            if loaded is None:
                return (None, [], "Не найден body в document.xml")
            root, body = loaded
            blocks = xml_utils.get_blocks_from_xml(body)
            block_spans = find_body_block_spans(original_document_xml)

        insert_idx, start_idx, end_idx, locate_error = _locate_section2_insert(body, block_spans)
        if locate_error:
            return (None, [], locate_error)

        replacement_xml = _build_section2_replacement(
            observations=observations,
            document_xml=original_document_xml,
            root=root,
            body=body,
            block_spans=block_spans,
            start_idx=start_idx,
            materiality_image_info=materiality_image_info,
            observation_anchors=observation_anchors if with_hyperlinks else None,
        )
        new_xml = _replace_section2_xml(
            original_document_xml,
            block_spans,
            insert_idx,
            start_idx,
            end_idx,
            replacement_xml,
        )

        prefix_error = validate_unchanged_prefix(
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

        _write_output_docx(
            output_path,
            new_xml,
            document_rels_xml,
            content_types_xml,
            media_payloads,
        )
        return (output_path, observations, None)
    except Exception as exc:
        return (None, [], str(exc))
