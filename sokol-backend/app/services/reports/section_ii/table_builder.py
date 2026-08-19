from typing import Iterable, List, Optional

import xml.etree.ElementTree as ET

from app.services.reports.section_ii import fonts, runs, xml_utils
from app.services.reports.section_ii.field_parser import format_chapter_heading
from app.services.reports.section_ii.models import Observation, RunFragment
from app.services.reports.section_ii.patterns import SROK_TAIL_RE


W_NS = xml_utils.W_NS
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XML_NS = "http://www.w3.org/XML/1998/namespace"
TABLE_WIDTH = 10037
OBS_NUMBER_WIDTH = 2500
SPACER_WIDTH = 21
OBS_NAME_WIDTH = 5200
SPACER_2_WIDTH = 16
MATERIALITY_CELL_WIDTH = 2300
MAIN_COLUMNS_WIDTH = OBS_NUMBER_WIDTH + SPACER_WIDTH + OBS_NAME_WIDTH + SPACER_2_WIDTH
RECOMMENDATION_LABEL_WIDTH = 2263
RECOMMENDATION_TEXT_WIDTH = TABLE_WIDTH - RECOMMENDATION_LABEL_WIDTH


def _add_tc_borders(tcPr) -> None:
    tcBorders = ET.SubElement(tcPr, f"{{{W_NS}}}tcBorders")
    for side in ["top", "left", "bottom", "right"]:
        ET.SubElement(
            tcBorders,
            f"{{{W_NS}}}{side}",
            attrib={
                f"{{{W_NS}}}val": "single",
                f"{{{W_NS}}}sz": "4",
                f"{{{W_NS}}}space": "0",
                f"{{{W_NS}}}color": "auto",
            },
        )


def _apply_cell_props(tc, width: int, grid_span: int) -> None:
    tcPr = ET.SubElement(tc, f"{{{W_NS}}}tcPr")
    ET.SubElement(tcPr, f"{{{W_NS}}}tcW", attrib={f"{{{W_NS}}}w": str(width), f"{{{W_NS}}}type": "dxa"})
    if grid_span > 1:
        ET.SubElement(tcPr, f"{{{W_NS}}}gridSpan", attrib={f"{{{W_NS}}}val": str(grid_span)})
    _add_tc_borders(tcPr)


def _add_paragraph_with_props(parent, alignment: str = "both"):
    p = ET.SubElement(parent, f"{{{W_NS}}}p")
    pPr = ET.SubElement(p, f"{{{W_NS}}}pPr")
    ET.SubElement(pPr, f"{{{W_NS}}}spacing", attrib={f"{{{W_NS}}}after": "0"})
    ET.SubElement(pPr, f"{{{W_NS}}}ind", attrib={f"{{{W_NS}}}firstLine": "0"})
    ET.SubElement(pPr, f"{{{W_NS}}}jc", attrib={f"{{{W_NS}}}val": alignment})
    ET.SubElement(pPr, f"{{{W_NS}}}spacing", attrib={f"{{{W_NS}}}line": "240", f"{{{W_NS}}}lineRule": "auto"})
    ET.SubElement(pPr, f"{{{W_NS}}}contextualSpacing")
    return p


def _cell(
    text: str,
    width: int,
    grid_span: int = 1,
    bold: bool = False,
    italic: bool = False,
    underline: bool = False,
    color: Optional[str] = None,
    font: Optional[dict] = None,
    hyperlink_anchor: Optional[str] = None,
):
    tc = ET.Element(f"{{{W_NS}}}tc")
    _apply_cell_props(tc, width, grid_span)
    p = _add_paragraph_with_props(tc)
    clean_text = (text or "").replace("\x00", "")
    run_font = font or fonts.FONT_HEADER
    if hyperlink_anchor:
        begin = ET.SubElement(p, f"{{{W_NS}}}r")
        begin_props = ET.SubElement(begin, f"{{{W_NS}}}rPr")
        fonts.add_rpr(begin_props, run_font)
        ET.SubElement(begin, f"{{{W_NS}}}fldChar", attrib={f"{{{W_NS}}}fldCharType": "begin"})

        instr_run = ET.SubElement(p, f"{{{W_NS}}}r")
        instr_props = ET.SubElement(instr_run, f"{{{W_NS}}}rPr")
        fonts.add_rpr(instr_props, run_font)
        instr = ET.SubElement(instr_run, f"{{{W_NS}}}instrText", attrib={f"{{{XML_NS}}}space": "preserve"})
        instr.text = f' HYPERLINK \\l "{hyperlink_anchor}" '

        separate = ET.SubElement(p, f"{{{W_NS}}}r")
        separate_props = ET.SubElement(separate, f"{{{W_NS}}}rPr")
        fonts.add_rpr(separate_props, run_font)
        ET.SubElement(separate, f"{{{W_NS}}}fldChar", attrib={f"{{{W_NS}}}fldCharType": "separate"})

        visible = ET.SubElement(p, f"{{{W_NS}}}r")
        rPr = ET.SubElement(visible, f"{{{W_NS}}}rPr")
        ET.SubElement(rPr, f"{{{W_NS}}}rStyle", attrib={f"{{{W_NS}}}val": "Hyperlink"})
        fonts.add_rpr(
            rPr,
            run_font,
            bold=bold,
            italic=italic,
            underline=True,
            color=color or "0563C1",
        )
        t = ET.SubElement(visible, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
        t.text = clean_text

        end = ET.SubElement(p, f"{{{W_NS}}}r")
        end_props = ET.SubElement(end, f"{{{W_NS}}}rPr")
        fonts.add_rpr(end_props, run_font)
        ET.SubElement(end, f"{{{W_NS}}}fldChar", attrib={f"{{{W_NS}}}fldCharType": "end"})
        return tc

    r = ET.SubElement(p, f"{{{W_NS}}}r")
    rPr = ET.SubElement(r, f"{{{W_NS}}}rPr")
    fonts.add_rpr(rPr, run_font, bold=bold, italic=italic, underline=underline, color=color)
    t = ET.SubElement(r, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
    t.text = clean_text
    return tc


def _chapter_heading_cell(text: str, font: Optional[dict] = None):
    tc = _cell(text, TABLE_WIDTH, 5, bold=True, font=font)
    p_pr = tc.find(f"./{{{W_NS}}}p/{{{W_NS}}}pPr")
    if p_pr is not None:
        jc = p_pr.find(f"{{{W_NS}}}jc")
        if jc is not None:
            jc.set(f"{{{W_NS}}}val", "left")
    return tc


def _chapter_heading_text(obs: Observation) -> str:
    return format_chapter_heading(obs.chapter, obs.chapter_title)


def _add_materiality_drawing(p: ET.Element, rel_id: str, drawing_id: int, cx: int, cy: int) -> None:
    r = ET.SubElement(p, f"{{{W_NS}}}r")
    drawing = ET.SubElement(r, f"{{{W_NS}}}drawing")
    inline = ET.SubElement(
        drawing,
        f"{{{WP_NS}}}inline",
        attrib={"distT": "0", "distB": "0", "distL": "0", "distR": "0"},
    )
    ET.SubElement(inline, f"{{{WP_NS}}}extent", attrib={"cx": str(cx), "cy": str(cy)})
    ET.SubElement(inline, f"{{{WP_NS}}}effectExtent", attrib={"l": "0", "t": "0", "r": "0", "b": "0"})
    ET.SubElement(inline, f"{{{WP_NS}}}docPr", attrib={"id": str(drawing_id), "name": f"Materiality {drawing_id}"})
    c_nv = ET.SubElement(inline, f"{{{WP_NS}}}cNvGraphicFramePr")
    ET.SubElement(c_nv, f"{{{A_NS}}}graphicFrameLocks", attrib={"noChangeAspect": "1"})
    graphic = ET.SubElement(inline, f"{{{A_NS}}}graphic")
    graphic_data = ET.SubElement(
        graphic,
        f"{{{A_NS}}}graphicData",
        attrib={"uri": "http://schemas.openxmlformats.org/drawingml/2006/picture"},
    )
    pic = ET.SubElement(graphic_data, f"{{{PIC_NS}}}pic")
    nv_pic_pr = ET.SubElement(pic, f"{{{PIC_NS}}}nvPicPr")
    ET.SubElement(nv_pic_pr, f"{{{PIC_NS}}}cNvPr", attrib={"id": "0", "name": f"materiality-{drawing_id}.png"})
    ET.SubElement(nv_pic_pr, f"{{{PIC_NS}}}cNvPicPr")
    blip_fill = ET.SubElement(pic, f"{{{PIC_NS}}}blipFill")
    ET.SubElement(blip_fill, f"{{{A_NS}}}blip", attrib={f"{{{R_NS}}}embed": rel_id})
    stretch = ET.SubElement(blip_fill, f"{{{A_NS}}}stretch")
    ET.SubElement(stretch, f"{{{A_NS}}}fillRect")
    sp_pr = ET.SubElement(pic, f"{{{PIC_NS}}}spPr")
    xfrm = ET.SubElement(sp_pr, f"{{{A_NS}}}xfrm")
    ET.SubElement(xfrm, f"{{{A_NS}}}off", attrib={"x": "0", "y": "0"})
    ET.SubElement(xfrm, f"{{{A_NS}}}ext", attrib={"cx": str(cx), "cy": str(cy)})
    prst_geom = ET.SubElement(sp_pr, f"{{{A_NS}}}prstGeom", attrib={"prst": "rect"})
    ET.SubElement(prst_geom, f"{{{A_NS}}}avLst")


def _materiality_cell(
    materiality_level: str,
    width: int,
    font: Optional[dict] = None,
    image_info: Optional[dict] = None,
    drawing_id: int = 1,
):
    if not image_info:
        tc = _cell(materiality_level or "", width, 1, font=font)
        p_pr = tc.find(f"./{{{W_NS}}}p/{{{W_NS}}}pPr")
        if p_pr is not None:
            jc = p_pr.find(f"{{{W_NS}}}jc")
            if jc is not None:
                jc.set(f"{{{W_NS}}}val", "center")
        return tc

    tc = _cell(materiality_level or "", width, 1, font=font)
    p = tc.find(f"./{{{W_NS}}}p")
    if p is None:
        return tc
    for child in list(p):
        if child.tag == f"{{{W_NS}}}r":
            p.remove(child)
    p_pr = tc.find(f"./{{{W_NS}}}p/{{{W_NS}}}pPr")
    if p_pr is not None:
        jc = p_pr.find(f"{{{W_NS}}}jc")
        if jc is not None:
            jc.set(f"{{{W_NS}}}val", "center")
    tc_pr = tc.find(f"{{{W_NS}}}tcPr")
    if tc_pr is not None:
        ET.SubElement(tc_pr, f"{{{W_NS}}}vAlign", attrib={f"{{{W_NS}}}val": "center"})
    _add_materiality_drawing(
        p,
        image_info["rel_id"],
        drawing_id,
        image_info["cx"],
        image_info["cy"],
    )
    return tc


def _cell_recommendation_with_deadline(rec_text: str, deadline: str, width: int, grid_span: int,
                                       font: Optional[dict] = None):
    tc = ET.Element(f"{{{W_NS}}}tc")
    _apply_cell_props(tc, width, grid_span)

    body_font = font or fonts.FONT_BODY

    def _add_paragraph(text: str, bold: bool = False, italic: bool = False, underline: bool = False,
                       color: Optional[str] = None):
        p = _add_paragraph_with_props(tc, alignment="both")
        r = ET.SubElement(p, f"{{{W_NS}}}r")
        rPr = ET.SubElement(r, f"{{{W_NS}}}rPr")
        fonts.add_rpr(rPr, body_font, bold=bold, italic=italic, underline=underline, color=color)
        t = ET.SubElement(r, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
        t.text = (text or "").replace("\x00", "")

    if deadline:
        rec_clean = SROK_TAIL_RE.sub(" ", rec_text).strip()
        if rec_clean:
            _add_paragraph(rec_clean)
        srok_text = f"Срок – {deadline}."
        if srok_text and srok_text[0].islower():
            srok_text = srok_text[0].upper() + srok_text[1:]
        _add_paragraph(srok_text)
    else:
        for paragraph_text in (rec_text or "").splitlines() or [rec_text]:
            if paragraph_text.strip():
                _add_paragraph(paragraph_text.strip())
    return tc


def _add_run_fragments_as_paragraphs(
    tc: ET.Element,
    run_frags: List[RunFragment],
    body_font: dict,
    italic: bool = False,
    alignment: str = "both",
) -> None:
    p = _add_paragraph_with_props(tc, alignment=alignment)
    for frag in run_frags:
        if frag.br_before:
            p = _add_paragraph_with_props(tc, alignment=alignment)
        clean_frag = RunFragment(
            text=frag.text,
            rPr=frag.rPr,
            br_before=False,
            is_tab=frag.is_tab,
            raw_r=frag.raw_r,
        )
        runs.add_run_fragment(p, clean_frag, body_font, italic=italic)


def _cell_with_run_fragments(
    run_frags: Optional[List[RunFragment]],
    width: int,
    grid_span: int,
    font: Optional[dict] = None,
    italic_if_missing: bool = False,
    fallback_text: str = "",
    alignment: str = "both",
    split_breaks_to_paragraphs: bool = False,
    hyperlink_anchor: Optional[str] = None,
):
    body_font = font or fonts.FONT_BODY
    if hyperlink_anchor:
        display_text = ""
        if run_frags:
            display_text = "".join((frag.text or "") for frag in run_frags if not frag.is_tab)
        if not display_text.strip():
            display_text = fallback_text or ""
        return _cell(
            display_text,
            width,
            grid_span,
            italic=italic_if_missing,
            font=body_font,
            hyperlink_anchor=hyperlink_anchor,
        )

    tc = ET.Element(f"{{{W_NS}}}tc")
    _apply_cell_props(tc, width, grid_span)
    if run_frags:
        if split_breaks_to_paragraphs:
            _add_run_fragments_as_paragraphs(tc, run_frags, body_font, italic=italic_if_missing, alignment=alignment)
            return tc
        p = _add_paragraph_with_props(tc, alignment=alignment)
        for frag in run_frags:
            runs.add_run_fragment(p, frag, body_font, italic=italic_if_missing)
        return tc
    paragraphs = (fallback_text or "").splitlines() if split_breaks_to_paragraphs else [fallback_text or ""]
    for paragraph_text in paragraphs or [""]:
        p = _add_paragraph_with_props(tc, alignment=alignment)
        r = ET.SubElement(p, f"{{{W_NS}}}r")
        rPr = ET.SubElement(r, f"{{{W_NS}}}rPr")
        fonts.add_rpr(rPr, body_font, italic=italic_if_missing)
        t = ET.SubElement(r, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
        t.text = paragraph_text.replace("\x00", "")
    return tc


def _cell_recommendation_with_runs(
    run_frags: List[RunFragment],
    deadline: str,
    width: int,
    grid_span: int,
    font: Optional[dict] = None,
):
    tc = ET.Element(f"{{{W_NS}}}tc")
    _apply_cell_props(tc, width, grid_span)
    body_font = font or fonts.FONT_BODY

    _add_run_fragments_as_paragraphs(tc, run_frags, body_font, alignment="both")
    return tc


def create_table_xml(
    observations: List[Observation],
    doc_root=None,
    predominant_font: Optional[dict] = None,
    materiality_image_info: Optional[dict] = None,
    observation_anchors: Optional[dict] = None,
):
    main_font = predominant_font or (fonts.get_predominant_font(doc_root) if doc_root is not None else fonts.FONT_BODY)
    anchors = observation_anchors or {}
    tbl = ET.Element(f"{{{W_NS}}}tbl")
    tblPr = ET.SubElement(tbl, f"{{{W_NS}}}tblPr")
    ET.SubElement(tblPr, f"{{{W_NS}}}tblW", attrib={f"{{{W_NS}}}w": str(TABLE_WIDTH), f"{{{W_NS}}}type": "dxa"})
    tblBorders = ET.SubElement(tblPr, f"{{{W_NS}}}tblBorders")
    for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        ET.SubElement(tblBorders, f"{{{W_NS}}}{side}",
            attrib={f"{{{W_NS}}}val": "single", f"{{{W_NS}}}sz": "4", f"{{{W_NS}}}space": "0",
                    f"{{{W_NS}}}color": "000000"})
    ET.SubElement(tblPr, f"{{{W_NS}}}tblLayout", attrib={f"{{{W_NS}}}type": "fixed"})
    ET.SubElement(tblPr, f"{{{W_NS}}}tblLook",
        attrib={f"{{{W_NS}}}val": "00A0", f"{{{W_NS}}}firstRow": "1", f"{{{W_NS}}}lastRow": "0",
                f"{{{W_NS}}}firstColumn": "1", f"{{{W_NS}}}lastColumn": "0",
                f"{{{W_NS}}}noHBand": "0", f"{{{W_NS}}}noVBand": "0"})
    tblGrid = ET.SubElement(tbl, f"{{{W_NS}}}tblGrid")
    for w in [OBS_NUMBER_WIDTH, SPACER_WIDTH, OBS_NAME_WIDTH, SPACER_2_WIDTH, MATERIALITY_CELL_WIDTH]:
        ET.SubElement(tblGrid, f"{{{W_NS}}}gridCol", attrib={f"{{{W_NS}}}w": str(w)})

    tr0 = ET.Element(f"{{{W_NS}}}tr")
    tr0.append(_cell("Основные нарушения и недостатки", MAIN_COLUMNS_WIDTH, 4, bold=True, italic=True, font=main_font))
    tr0.append(_cell("Существенность", MATERIALITY_CELL_WIDTH, 1, bold=True, italic=True, font=main_font))
    tbl.append(tr0)

    last_chapter_key = None
    for obs in observations:
        chapter_text = _chapter_heading_text(obs)
        chapter_key = ((obs.chapter or "").strip(), chapter_text)
        if chapter_text and chapter_key != last_chapter_key:
            tr_chapter = ET.Element(f"{{{W_NS}}}tr")
            tr_chapter.append(_chapter_heading_cell(chapter_text, font=main_font))
            tbl.append(tr_chapter)
            last_chapter_key = chapter_key

        tr_obs = ET.Element(f"{{{W_NS}}}tr")
        obs_num = f"Наблюдение {obs.number}." if obs.number else "Наблюдение"
        obs_anchor = anchors.get(obs.number) if obs.number else None
        tr_obs.append(
            _cell(
                obs_num,
                OBS_NUMBER_WIDTH + SPACER_WIDTH,
                2,
                font=main_font,
            )
        )
        name_text = (obs.name or "").strip()
        if not name_text and obs.name_runs:
            from app.services.reports.section_ii.docx_blocks import runs_to_text

            name_text = runs_to_text(obs.name_runs).strip()
        if obs_anchor and name_text:
            tr_obs.append(
                _cell(
                    name_text,
                    OBS_NAME_WIDTH + SPACER_2_WIDTH,
                    2,
                    italic=True,
                    font=main_font,
                    hyperlink_anchor=obs_anchor,
                )
            )
        else:
            tr_obs.append(
                _cell_with_run_fragments(
                    obs.name_runs,
                    OBS_NAME_WIDTH + SPACER_2_WIDTH,
                    2,
                    font=main_font,
                    italic_if_missing=True,
                    fallback_text=obs.name,
                    hyperlink_anchor=obs_anchor,
                )
            )
        tr_obs.append(_materiality_cell(
            obs.materiality_level or "",
            MATERIALITY_CELL_WIDTH,
            font=main_font,
            image_info=(materiality_image_info or {}).get((obs.materiality_level or "").strip().lower()),
            drawing_id=1000 + len(tbl),
        ))
        tbl.append(tr_obs)

        if obs.rec_entries:
            for rec in obs.rec_entries:
                tr_rec = ET.Element(f"{{{W_NS}}}tr")
                tr_rec.append(_cell("Рекомендация", RECOMMENDATION_LABEL_WIDTH, 2, font=main_font))
                tr_rec.append(_cell_with_run_fragments(
                    rec.runs,
                    RECOMMENDATION_TEXT_WIDTH,
                    3,
                    font=main_font,
                    fallback_text=rec.text,
                    alignment="both",
                    split_breaks_to_paragraphs=True,
                ))
                tbl.append(tr_rec)
        else:
            tr_rec = ET.Element(f"{{{W_NS}}}tr")
            tr_rec.append(_cell(obs.rec_label, RECOMMENDATION_LABEL_WIDTH, 2, font=main_font))
            if obs.rec_runs:
                tr_rec.append(_cell_recommendation_with_runs(
                    obs.rec_runs, obs.deadline or "", RECOMMENDATION_TEXT_WIDTH, 3, font=main_font
                ))
            else:
                tr_rec.append(_cell_recommendation_with_deadline(
                    obs.recommendations or "", obs.deadline or "", RECOMMENDATION_TEXT_WIDTH, 3, font=main_font
                ))
            tbl.append(tr_rec)

    return tbl


def create_heading_paragraph_xml(
    text: str,
    font: Optional[dict] = None,
    bookmark_names: Optional[Iterable[str]] = None,
    bookmark_start_id: Optional[int] = None,
    source_paragraph: Optional[ET.Element] = None,
    style_reference: Optional[ET.Element] = None,
):
    from app.services.reports.section_ii.bookmark_utils import (
        add_bookmarks_to_paragraph,
        build_section_heading_paragraph,
        copy_first_run_properties,
        copy_paragraph_properties,
    )

    template = style_reference if style_reference is not None else source_paragraph
    if template is not None:
        return build_section_heading_paragraph(
            template,
            text,
            bookmark_names=bookmark_names,
            bookmark_start_id=bookmark_start_id,
            page_break_before=True,
        )

    f = font or fonts.FONT_BODY
    p = ET.Element(f"{{{W_NS}}}p")
    if source_paragraph is not None:
        copy_paragraph_properties(source_paragraph, p)
    else:
        pPr = ET.SubElement(p, f"{{{W_NS}}}pPr")
        ET.SubElement(pPr, f"{{{W_NS}}}pageBreakBefore")
        ET.SubElement(pPr, f"{{{W_NS}}}spacing", attrib={f"{{{W_NS}}}before": "240", f"{{{W_NS}}}after": "120"})

    if bookmark_names:
        add_bookmarks_to_paragraph(p, bookmark_names, bookmark_start_id or 0)

    r = ET.SubElement(p, f"{{{W_NS}}}r")
    if source_paragraph is not None:
        copy_first_run_properties(source_paragraph, r)
    rPr = r.find(f"./{{{W_NS}}}rPr")
    if rPr is None:
        rPr = ET.SubElement(r, f"{{{W_NS}}}rPr")
        fonts.add_rpr(rPr, f, bold=True)
    elif source_paragraph is None:
        fonts.add_rpr(rPr, f, bold=True)
    t = ET.SubElement(r, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
    t.text = text
    return p
