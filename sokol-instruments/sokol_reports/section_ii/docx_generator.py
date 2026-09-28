# -*- coding: utf-8 -*-
"""
Генератор раздела II «Основные результаты аудита и аудиторские рекомендации».
ZIP-подход: копируем документ побайтово, заменяем только раздел II — сохраняются все стили и форматирование.
Таблица по образцу Приложение 1 АЗ_ВОО ЮЛ.docx.
Уровень существенности выводится текстом.
"""

import os
import shutil
import tempfile
import zipfile
from typing import List, Optional

import xml.etree.ElementTree as ET

from sokol_reports.ooxml import W_NS, register_word_namespaces
from sokol_reports.section_ii.document_xml import (
    create_page_break_paragraph as _create_page_break_paragraph,
    find_body_block_spans as _find_body_block_spans,
    replace_document_blocks_xml as _replace_document_blocks_xml,
    serialize_fragment as _serialize_fragment,
    strip_generated_section2_blocks as _strip_generated_section2_blocks,
    validate_replacement_boundary as _validate_replacement_boundary,
    validate_unchanged_prefix as _validate_unchanged_prefix,
)
from sokol_reports.section_ii.docx_parser import (
    parse_observations_from_file_with_runs,
)
from sokol_reports.section_ii.materiality_images import (
    CONTENT_TYPES_PATH as _CONTENT_TYPES_PATH,
    DOCUMENT_RELS_PATH as _DOCUMENT_RELS_PATH,
    build_materiality_image_package_parts as _build_materiality_image_package_parts,
)
from sokol_reports.section_ii.models import Observation
from sokol_reports.section_ii import fonts, table_builder, xml_utils
from sokol_reports.section_ii.bookmark_utils import (
    get_section_heading_template_paragraph,
    next_bookmark_id,
    parse_paragraph_xml,
    resolve_section2_bookmark_names,
    resolve_section2_heading_text,
)
from sokol_reports.section_ii.observation_links import ensure_observation_bookmarks
from sokol_reports.section_ii.patterns import DEFAULT_SECTION2_HEADING


register_word_namespaces()


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
            observation_names = {
                obs.number: (obs.name or "").strip()
                for obs in observations
                if obs.number
            }
            original_document_xml, observation_anchors, _ = ensure_observation_bookmarks(
                original_document_xml,
                list(observation_names),
                block_spans=block_spans,
                blocks=blocks,
                observation_names=observation_names,
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
    except Exception as e:
        return (None, [], str(e))
