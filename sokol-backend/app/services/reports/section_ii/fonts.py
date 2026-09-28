from collections import Counter
from typing import Optional

import xml.etree.ElementTree as ET

from app.services.reports.ooxml import W_NS

# Шрифты по умолчанию — Calibri (если документ не содержит явных rFonts)
FONT_CALIBRI = {"ascii": "Calibri", "eastAsia": "Calibri", "hAnsi": "Calibri", "cs": "Calibri"}
FONT_BODY = FONT_CALIBRI.copy()
FONT_HEADER = FONT_CALIBRI.copy()


def add_rpr(
    rPr,
    font: dict,
    bold: bool = False,
    italic: bool = False,
    underline: bool = False,
    color: Optional[str] = None,
) -> None:
    if bold:
        ET.SubElement(rPr, f"{{{W_NS}}}b")
    if italic:
        ET.SubElement(rPr, f"{{{W_NS}}}i")
    if underline:
        ET.SubElement(rPr, f"{{{W_NS}}}u", attrib={f"{{{W_NS}}}val": "single"})
    if color:
        ET.SubElement(rPr, f"{{{W_NS}}}color", attrib={f"{{{W_NS}}}val": color})
    ET.SubElement(
        rPr,
        f"{{{W_NS}}}rFonts",
        attrib={
            f"{{{W_NS}}}ascii": font.get("ascii", "Calibri"),
            f"{{{W_NS}}}eastAsia": font.get("eastAsia", "Calibri"),
            f"{{{W_NS}}}hAnsi": font.get("hAnsi", "Calibri"),
            f"{{{W_NS}}}cs": font.get("cs", "Calibri"),
        },
    )
    sz = font.get("sz") or font.get("szCs") or "24"
    ET.SubElement(rPr, f"{{{W_NS}}}sz", attrib={f"{{{W_NS}}}val": str(sz)})
    ET.SubElement(rPr, f"{{{W_NS}}}szCs", attrib={f"{{{W_NS}}}val": str(sz)})


def get_font_from_rpr(rPr) -> Optional[dict]:
    if rPr is None:
        return None
    result = {}
    rFonts = rPr.find(f"{{{W_NS}}}rFonts")
    if rFonts is not None:
        for attr in ["ascii", "eastAsia", "hAnsi", "cs"]:
            val = rFonts.get(f"{{{W_NS}}}{attr}")
            if val:
                result[attr] = val
    for attr in ["sz", "szCs"]:
        el = rPr.find(f"{{{W_NS}}}{attr}")
        if el is not None:
            val = el.get(f"{{{W_NS}}}val")
            if val:
                result[attr] = val
    return result if result else None


def get_doc_default_font(root) -> Optional[dict]:
    for dd in root.iter():
        if "docDefaults" in dd.tag:
            rPr = dd.find(f"{{{W_NS}}}rPr")
            if rPr is None:
                rPr = dd.find(f".//{{{W_NS}}}rPr")
            f = get_font_from_rpr(rPr)
            if f:
                return f
    return None


def get_doc_default_sz(root) -> Optional[str]:
    for dd in root.iter():
        if "docDefaults" in dd.tag:
            rPr = dd.find(f"{{{W_NS}}}rPr")
            if rPr is None:
                rPr = dd.find(f".//{{{W_NS}}}rPr")
            if rPr is not None:
                sz = rPr.find(f"{{{W_NS}}}sz")
                if sz is not None:
                    val = sz.get(f"{{{W_NS}}}val")
                    if val:
                        return val
    return None


def get_text_from_run(r) -> str:
    return "".join(t.text or "" for t in r.iter(f"{{{W_NS}}}t") if t.text)


def get_predominant_font(root) -> dict:
    """
    Определяет преобладающий шрифт и размер в документе.
    Подсчитывает использование (шрифт, размер) во всех run. Возвращает {ascii, cs, sz, szCs}.
    Fallback — docDefaults или Calibri 24.
    """
    pair_counts = Counter()
    pair_samples = {}

    for p in root.iter(f"{{{W_NS}}}p"):
        pPr = p.find(f"{{{W_NS}}}pPr")
        p_rPr = pPr.find(f"{{{W_NS}}}rPr") if pPr is not None else None
        p_font = get_font_from_rpr(p_rPr) if p_rPr is not None else None
        for r in p.iter(f"{{{W_NS}}}r"):
            rPr = r.find(f"{{{W_NS}}}rPr")
            txt = get_text_from_run(r)
            f = get_font_from_rpr(rPr) or p_font
            if not f or not txt.strip():
                continue
            font_key = f.get("cs") or f.get("ascii") or f.get("hAnsi") or f.get("eastAsia") or ""
            if not font_key:
                continue
            sz_val = f.get("sz") or f.get("szCs") or "24"
            key = (font_key, sz_val)
            pair_counts[key] += len(txt)
            pair_samples[key] = f.copy()

    if pair_counts:
        predominant_key = pair_counts.most_common(1)[0][0]
        result = pair_samples[predominant_key].copy()
        sz_val = predominant_key[1]
        result.setdefault("sz", sz_val)
        result.setdefault("szCs", sz_val)
        return result

    default = get_doc_default_font(root)
    if default:
        result = default.copy()
        default_sz = get_doc_default_sz(root) or "24"
        result.setdefault("sz", default_sz)
        result.setdefault("szCs", default_sz)
        return result
    res = FONT_CALIBRI.copy()
    res["sz"] = res["szCs"] = "24"
    return res
