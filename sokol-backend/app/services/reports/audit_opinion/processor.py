"""Вставка текста раздела I «Аудиторское мнение по итогам проверки» в DOCX с жёлтым маркером."""

from __future__ import annotations

import os
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Optional, Tuple

from app.services.reports.section_ii import fonts, xml_utils
from app.services.reports.section_ii.docx_generator import (
    _find_body_block_spans,
    _replace_document_blocks_xml,
    _serialize_fragment,
)
from app.services.reports.section_ii.docx_parser import parse_observations_from_file_with_runs
from app.services.reports.section_ii.models import Observation
from app.services.reports.section_ii.patterns import SECTION2_START_RE
from app.services.reports.audit_opinion.ollama_client import (
    OllamaError,
    build_final_prompt,
    generate_text,
)
from app.services.reports.audit_opinion.prompts import DEFAULT_AUDIT_OPINION_PROMPT


W_NS = xml_utils.W_NS
XML_NS = "http://www.w3.org/XML/1998/namespace"
_SECTION1_TITLE_ONLY = re.compile(r"^\s*Аудиторское\s*мнение\b", re.IGNORECASE)
_SOKOL_OPINION_MARKER = "SOKOL_AUDIT_OPINION"


def _paragraph_text(el: ET.Element) -> str:
    return xml_utils.get_text_from_element(el).strip()


def _find_section1_content_start(body, section1_start: int) -> int:
    """Индекс первого блока тела раздела I (после заголовка)."""
    blocks = xml_utils.get_blocks_from_xml(body)
    content_start = section1_start + 1
    if content_start < len(blocks):
        btype, el = blocks[content_start]
        if btype == "p" and _SECTION1_TITLE_ONLY.search(_paragraph_text(el)):
            content_start += 1
    return content_start


def _find_section1_content_end(body, content_start: int, min_idx: int) -> int:
    """Конец тела раздела I: начало II / III / следующей крупной секции."""
    safe_min = max(content_start, min_idx)
    section2 = xml_utils.find_section2_in_xml(body, min_idx=safe_min)
    if section2:
        return section2[0]
    return xml_utils.find_insert_index_for_new_section2(
        body,
        max(content_start - 1, 0),
        min_idx=safe_min,
    )


def _split_opinion_paragraphs(text: str) -> List[str]:
    cleaned = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    # Убираем возможный заголовок, если модель всё же его добавила.
    cleaned = re.sub(
        r"^\s*(?:I|1|Раздел\s+I)\s*[.)–—\-]?\s*Аудиторское\s*мнение(?:\s+по\s+итогам\s+проверки)?\.?\s*\n+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    parts = [part.strip() for part in re.split(r"\n\s*\n+", cleaned) if part.strip()]
    if parts:
        return parts
    lines = [line.strip() for line in cleaned.split("\n") if line.strip()]
    return lines or [cleaned]


def _create_highlighted_paragraph(
    text: str,
    font: dict,
    *,
    with_marker: bool = False,
) -> ET.Element:
    p = ET.Element(f"{{{W_NS}}}p")
    pPr = ET.SubElement(p, f"{{{W_NS}}}pPr")
    ET.SubElement(pPr, f"{{{W_NS}}}jc", attrib={f"{{{W_NS}}}val": "both"})
    ET.SubElement(
        pPr,
        f"{{{W_NS}}}spacing",
        attrib={
            f"{{{W_NS}}}after": "120",
            f"{{{W_NS}}}line": "276",
            f"{{{W_NS}}}lineRule": "auto",
        },
    )
    ET.SubElement(pPr, f"{{{W_NS}}}ind", attrib={f"{{{W_NS}}}firstLine": "708"})

    if with_marker:
        bookmark_start = ET.SubElement(
            p,
            f"{{{W_NS}}}bookmarkStart",
            attrib={f"{{{W_NS}}}id": "9001", f"{{{W_NS}}}name": _SOKOL_OPINION_MARKER},
        )
        _ = bookmark_start

    r = ET.SubElement(p, f"{{{W_NS}}}r")
    rPr = ET.SubElement(r, f"{{{W_NS}}}rPr")
    fonts.add_rpr(rPr, font)
    ET.SubElement(rPr, f"{{{W_NS}}}highlight", attrib={f"{{{W_NS}}}val": "yellow"})
    t = ET.SubElement(r, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
    t.text = text.replace("\x00", "")

    if with_marker:
        ET.SubElement(p, f"{{{W_NS}}}bookmarkEnd", attrib={f"{{{W_NS}}}id": "9001"})
    return p


def _build_opinion_xml(paragraphs: List[str], font: dict) -> str:
    chunks: list[str] = []
    for index, paragraph in enumerate(paragraphs):
        el = _create_highlighted_paragraph(paragraph, font, with_marker=index == 0)
        chunks.append(_serialize_fragment(el))
    return "".join(chunks)


def process_document(
    input_path: str,
    output_path: str,
    prompt: str | None = None,
    model: str | None = None,
) -> Tuple[Optional[str], List[Observation], Optional[str]]:
    """
    Генерирует текст раздела I через Ollama и вставляет его в DOCX
    с жёлтой подсветкой после заголовка «I. Аудиторское мнение по итогам проверки».
    """
    try:
        shutil.copy2(input_path, output_path)

        observations = parse_observations_from_file_with_runs(input_path)
        if not observations:
            return (
                None,
                [],
                "Наблюдения не найдены. Загрузите АЗ с разделом III (наблюдения и рекомендации), "
                "без заполненного раздела I.",
            )

        user_prompt = (prompt or "").strip() or DEFAULT_AUDIT_OPINION_PROMPT
        final_prompt = build_final_prompt(user_prompt, observations)
        try:
            opinion_text = generate_text(final_prompt, model=model)
        except OllamaError as exc:
            return None, observations, str(exc)

        paragraphs = _split_opinion_paragraphs(opinion_text)
        if not paragraphs:
            return None, observations, "Модель вернула пустой текст аудиторского мнения."

        with zipfile.ZipFile(output_path, "r") as zf:
            original_document_xml = zf.read("word/document.xml").decode("utf-8")

        tree = ET.ElementTree(ET.fromstring(original_document_xml.encode("utf-8")))
        root = tree.getroot()
        body = root.find(f".//{{{W_NS}}}body")
        if body is None:
            return None, observations, "Не найден body в document.xml"

        first_block_after_page2 = xml_utils.find_first_block_after_page2(body)
        section1_start = xml_utils.find_section1_start(body, min_idx=first_block_after_page2)
        if section1_start is None:
            return (
                None,
                observations,
                "Не найден заголовок раздела I (Аудиторское мнение по итогам проверки). "
                "В документе должен быть заголовок раздела I — тело раздела может быть пустым.",
            )

        content_start = _find_section1_content_start(body, section1_start)
        content_end = _find_section1_content_end(body, content_start, first_block_after_page2)
        if content_end < content_start:
            return None, observations, "Не удалось определить границы раздела I для вставки текста."

        # Не затираем уже существующий раздел II, если он сразу после I.
        blocks = xml_utils.get_blocks_from_xml(body)
        if content_start < len(blocks):
            btype, el = blocks[content_start]
            text = _paragraph_text(el) if btype == "p" else ""
            if text and SECTION2_START_RE.match(text):
                content_end = content_start

        block_spans = _find_body_block_spans(original_document_xml)
        if len(block_spans) != len(blocks):
            return None, observations, "Не удалось безопасно сопоставить XML-блоки документа."

        predominant_font = fonts.get_predominant_font(root) or fonts.FONT_BODY.copy()
        if "sz" not in predominant_font:
            predominant_font["sz"] = "24"

        replacement_xml = _build_opinion_xml(paragraphs, predominant_font)
        new_xml = _replace_document_blocks_xml(
            original_document_xml,
            block_spans,
            content_start,
            content_end,
            replacement_xml,
        )

        tmp_path = output_path + ".tmp.docx"
        try:
            with zipfile.ZipFile(output_path, "r") as zf_in:
                with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf_out:
                    for item in zf_in.infolist():
                        if item.filename == "word/document.xml":
                            zf_out.writestr(item, new_xml.encode("utf-8"))
                        else:
                            zf_out.writestr(item, zf_in.read(item.filename))
            shutil.move(tmp_path, output_path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

        return output_path, observations, None
    except Exception as exc:  # noqa: BLE001 — верхний контракт tools API
        return None, [], f"Ошибка генерации аудиторского мнения: {exc}"
