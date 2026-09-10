# -*- coding: utf-8 -*-
"""Генерация докладной записки (.docx) — «Приложение 2. Перечень рекомендаций»."""

from typing import Optional, Tuple

import logging

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, Twips

from app.services.reports.memorandum.models import MemorandumRecommendation, MemorandumSource
from app.services.reports.memorandum.section_ii_table_parser import format_group_heading
from app.core.logging import format_caught_error, log_caught_exception

logger = logging.getLogger(__name__)

FONT_NAME = "Times New Roman"
# В шаблоне w:sz=28 → 14 pt
FONT_SIZE = Pt(14)
FIRST_LINE_INDENT = Twips(709)
BODY_ALIGNMENT = WD_ALIGN_PARAGRAPH.JUSTIFY
DEADLINE_PREFIX = "Срок – "


def _apply_run_font(run, *, bold: bool = False) -> None:
    run.bold = bold
    run.font.name = FONT_NAME
    run.font.size = FONT_SIZE
    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.rFonts
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        r_pr.insert(0, r_fonts)
    r_fonts.set(qn("w:ascii"), FONT_NAME)
    r_fonts.set(qn("w:hAnsi"), FONT_NAME)
    r_fonts.set(qn("w:cs"), FONT_NAME)
    r_fonts.set(qn("w:eastAsia"), FONT_NAME)
    sz = r_pr.find(qn("w:sz"))
    if sz is None:
        sz = OxmlElement("w:sz")
        r_pr.append(sz)
    sz.set(qn("w:val"), "28")
    sz_cs = r_pr.find(qn("w:szCs"))
    if sz_cs is None:
        sz_cs = OxmlElement("w:szCs")
        r_pr.append(sz_cs)
    sz_cs.set(qn("w:val"), "28")


def _configure_paragraph(
    paragraph,
    *,
    alignment=WD_ALIGN_PARAGRAPH.LEFT,
    first_line_indent: bool = True,
    keep_next: bool = False,
) -> None:
    fmt = paragraph.paragraph_format
    fmt.alignment = alignment
    if first_line_indent:
        fmt.first_line_indent = FIRST_LINE_INDENT
    else:
        fmt.first_line_indent = Pt(0)
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(0)
    fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE
    fmt.line_spacing = 1
    if keep_next:
        paragraph.paragraph_format.keep_with_next = True


def _add_spacer_paragraph(doc: Document, *, keep_next: bool = False) -> None:
    spacer = doc.add_paragraph()
    _configure_paragraph(
        spacer,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent=False,
        keep_next=keep_next,
    )


def _add_text_paragraph(
    doc: Document,
    text: str,
    *,
    bold: bool = False,
    alignment=BODY_ALIGNMENT,
    first_line_indent: bool = True,
    keep_next: bool = False,
) -> None:
    paragraph = doc.add_paragraph()
    _configure_paragraph(
        paragraph,
        alignment=alignment,
        first_line_indent=first_line_indent,
        keep_next=keep_next,
    )
    run = paragraph.add_run(text)
    _apply_run_font(run, bold=bold)


def _add_deadline_paragraph(doc: Document, deadline: str) -> None:
    text = deadline.strip()
    if text.lower().startswith("срок"):
        line = text
    else:
        line = f"{DEADLINE_PREFIX}{text}"
    _add_text_paragraph(doc, line, bold=True, alignment=BODY_ALIGNMENT)


def _add_numbered_recommendation(
    doc: Document,
    number: int,
    recommendation: MemorandumRecommendation,
) -> None:
    paragraphs = recommendation.paragraphs or [""]
    first = paragraphs[0]
    _add_text_paragraph(doc, f"{number}.\u00a0{first}", bold=False, alignment=BODY_ALIGNMENT)

    if recommendation.deadline:
        _add_deadline_paragraph(doc, recommendation.deadline)

    for extra in paragraphs[1:]:
        if extra.strip().lower().startswith("срок"):
            _add_text_paragraph(doc, extra.strip(), bold=True, alignment=BODY_ALIGNMENT)
        else:
            _add_text_paragraph(doc, extra, bold=False, alignment=BODY_ALIGNMENT)


def generate_memorandum(source: MemorandumSource, output_path: str) -> Tuple[Optional[str], Optional[str]]:
    try:
        doc = Document()
        section = doc.sections[0]
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(1.5)

        normal_style = doc.styles["Normal"]
        normal_style.font.name = FONT_NAME
        normal_style.font.size = FONT_SIZE
        normal_style.paragraph_format.space_before = Pt(0)
        normal_style.paragraph_format.space_after = Pt(0)
        normal_style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        normal_style.paragraph_format.line_spacing = 1

        # «Приложение 2» — по правому краю, без жирного (как в шаблоне)
        _add_text_paragraph(
            doc,
            "Приложение 2",
            bold=False,
            alignment=WD_ALIGN_PARAGRAPH.RIGHT,
            keep_next=True,
        )

        # Пустая строка между заголовками
        _add_spacer_paragraph(doc, keep_next=True)

        # «Перечень аудиторских рекомендаций.» — слева, жирный
        _add_text_paragraph(
            doc,
            "Перечень аудиторских рекомендаций.",
            bold=True,
            alignment=WD_ALIGN_PARAGRAPH.LEFT,
        )

        _add_spacer_paragraph(doc)

        recommendation_number = 1
        for group_index, group in enumerate(source.groups, start=1):
            _add_text_paragraph(
                doc,
                format_group_heading(group_index, group),
                bold=True,
                alignment=BODY_ALIGNMENT,
            )
            _add_spacer_paragraph(doc)

            for recommendation in group.recommendations:
                _add_numbered_recommendation(doc, recommendation_number, recommendation)
                recommendation_number += 1
                _add_spacer_paragraph(doc)

        doc.save(output_path)
        return output_path, None
    except Exception as exc:
        log_caught_exception(logger, "Memorandum generation failed for %s", output_path)
        return None, format_caught_error(exc)
