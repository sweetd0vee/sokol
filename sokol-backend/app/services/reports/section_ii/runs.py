import copy
from typing import List, Tuple

import xml.etree.ElementTree as ET

from app.services.reports.section_ii import fonts, xml_utils
from app.services.reports.section_ii.models import RunFragment


W_NS = xml_utils.W_NS
XML_NS = "http://www.w3.org/XML/1998/namespace"


def _preserve_edge_spaces(raw_r: ET.Element) -> None:
    for text_node in raw_r.iter(f"{{{W_NS}}}t"):
        text = text_node.text or ""
        if text and (text[0].isspace() or text[-1].isspace()):
            text_node.set(f"{{{XML_NS}}}space", "preserve")


def add_run_fragment(p, frag: RunFragment, default_font: dict, italic: bool = False) -> None:
    if frag.br_before:
        r_br = ET.SubElement(p, f"{{{W_NS}}}r")
        ET.SubElement(r_br, f"{{{W_NS}}}br")
    if frag.raw_r is not None:
        raw_r = copy.deepcopy(frag.raw_r)
        _preserve_edge_spaces(raw_r)
        p.append(raw_r)
        return
    if not frag.text and not frag.is_tab:
        return
    r = ET.SubElement(p, f"{{{W_NS}}}r")
    if frag.rPr is not None:
        r.append(copy.deepcopy(frag.rPr))
    else:
        rPr = ET.SubElement(r, f"{{{W_NS}}}rPr")
        fonts.add_rpr(rPr, default_font, italic=italic)
    if frag.is_tab:
        ET.SubElement(r, f"{{{W_NS}}}tab")
        return
    t = ET.SubElement(r, f"{{{W_NS}}}t", attrib={f"{{{XML_NS}}}space": "preserve"})
    t.text = frag.text.replace("\x00", "")


def split_run_fragments(runs: List[RunFragment], split_idx: int) -> Tuple[List[RunFragment], List[RunFragment]]:
    before: List[RunFragment] = []
    after: List[RunFragment] = []
    remaining = max(0, split_idx)
    for frag in runs:
        text = frag.text
        if remaining >= len(text):
            before.append(RunFragment(text=text, rPr=copy.deepcopy(frag.rPr), br_before=frag.br_before))
            remaining -= len(text)
            continue
        if remaining > 0:
            before.append(RunFragment(text=text[:remaining], rPr=copy.deepcopy(frag.rPr), br_before=frag.br_before))
            text = text[remaining:]
            remaining = 0
        after.append(RunFragment(text=text, rPr=copy.deepcopy(frag.rPr), br_before=frag.br_before))
    return before, after
