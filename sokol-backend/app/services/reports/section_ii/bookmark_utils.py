import re
import xml.etree.ElementTree as ET
from typing import Iterable, List, Optional, Sequence, Tuple

from app.services.reports.section_ii.patterns import (
    DEFAULT_SECTION2_HEADING,
    DEFAULT_SECTION2_HEADING_TITLE,
    SECTION1_START_RE,
    SECTION1_TOC_TEXT_RE,
    SECTION2_ROMAN_ONLY_RE,
    SECTION2_START_RE,
    SECTION2_TOC_TEXT_RE,
    SECTION3_TOC_TEXT_RE,
    W_NS,
)

_HYPERLINK_ANCHOR_RE = re.compile(
    r"<(?P<tag>[\w:]+hyperlink)\b[^>]*\bw:anchor=\"(?P<anchor>[^\"]+)\"[^>]*>(?P<body>.*?)</(?P=tag)>",
    re.IGNORECASE | re.DOTALL,
)
_BOOKMARK_NAME_RE = re.compile(
    r"<(?P<tag>[\w:]+bookmarkStart)\b[^>]*\bw:name=\"(?P<name>[^\"]+)\"",
    re.IGNORECASE,
)
_BOOKMARK_ID_RE = re.compile(
    r"<(?P<tag>[\w:]+bookmarkStart)\b[^>]*\bw:id=\"(?P<id>\d+)\"",
    re.IGNORECASE,
)
_FIELD_REF_RE = re.compile(
    r"(?:HYPERLINK|PAGEREF)\s+\\l?\s*\"(?P<name>[^\"]+)\"",
    re.IGNORECASE,
)
_TEXT_NODE_RE = re.compile(r"<(?P<tag>[\w:]+t)\b[^>]*>(?P<text>[^<]*)</(?P=tag)>", re.IGNORECASE)


def _collect_text(xml_fragment: str) -> str:
    return "".join(match.group("text") for match in _TEXT_NODE_RE.finditer(xml_fragment))


def _normalize_spaces(text: str) -> str:
    return " ".join((text or "").split()).strip()


def is_section2_heading_text(text: str) -> bool:
    normalized = _normalize_spaces(text)
    if not normalized:
        return False
    return bool(SECTION2_START_RE.match(normalized))


def is_empty_section2_heading_text(text: str) -> bool:
    normalized = _normalize_spaces(text)
    if not normalized:
        return True
    return bool(SECTION2_ROMAN_ONLY_RE.match(normalized))


def normalize_section2_heading_text(text: str, default: str = DEFAULT_SECTION2_HEADING) -> str:
    normalized = _normalize_spaces(text)
    if not normalized or is_empty_section2_heading_text(normalized):
        return default
    if SECTION2_START_RE.match(normalized):
        return normalized
    return f"II. {normalized.lstrip('. ')}"


def _section2_toc_text_matches(body_text: str) -> bool:
    normalized = _normalize_spaces(body_text)
    if not normalized:
        return False
    if SECTION2_TOC_TEXT_RE.search(normalized):
        return True
    return bool(SECTION2_ROMAN_ONLY_RE.match(normalized))


def _iter_toc_hyperlinks(prefix_xml: str) -> List[Tuple[str, str]]:
    links: List[Tuple[str, str]] = []
    for match in _HYPERLINK_ANCHOR_RE.finditer(prefix_xml):
        anchor = match.group("anchor")
        if not anchor:
            continue
        links.append((anchor, _collect_text(match.group("body"))))
    return links


def _max_bookmark_id(document_xml: str) -> int:
    max_id = -1
    for match in _BOOKMARK_ID_RE.finditer(document_xml):
        try:
            max_id = max(max_id, int(match.group("id")))
        except ValueError:
            continue
    return max_id


def extract_bookmark_names(paragraph_xml: str) -> List[str]:
    names: List[str] = []
    seen = set()
    for match in _BOOKMARK_NAME_RE.finditer(paragraph_xml):
        name = match.group("name")
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    return names


def find_toc_anchor_names(prefix_xml: str) -> List[str]:
    anchors: List[str] = []
    seen = set()
    links = _iter_toc_hyperlinks(prefix_xml)

    for anchor, body_text in links:
        if not _section2_toc_text_matches(body_text):
            continue
        if anchor not in seen:
            seen.add(anchor)
            anchors.append(anchor)

    section1_idx = None
    section3_idx = None
    for idx, (_anchor, body_text) in enumerate(links):
        normalized = _normalize_spaces(body_text)
        if section1_idx is None and SECTION1_TOC_TEXT_RE.search(normalized):
            section1_idx = idx
        if SECTION3_TOC_TEXT_RE.search(normalized):
            section3_idx = idx

    if section1_idx is not None and section3_idx is not None and section3_idx - section1_idx > 1:
        for idx in range(section1_idx + 1, section3_idx):
            anchor, body_text = links[idx]
            normalized = _normalize_spaces(body_text)
            if anchor in seen:
                continue
            if (
                not normalized
                or SECTION2_ROMAN_ONLY_RE.match(normalized)
                or SECTION2_TOC_TEXT_RE.search(normalized)
            ):
                seen.add(anchor)
                anchors.append(anchor)

    for match in _FIELD_REF_RE.finditer(prefix_xml):
        name = match.group("name")
        if not name or name in seen:
            continue
        context_start = max(0, match.start() - 400)
        context_end = min(len(prefix_xml), match.end() + 400)
        context = _collect_text(prefix_xml[context_start:context_end])
        if SECTION2_TOC_TEXT_RE.search(context) or (
            section1_idx is not None
            and section3_idx is not None
            and SECTION1_TOC_TEXT_RE.search(context)
            and SECTION3_TOC_TEXT_RE.search(context)
        ):
            seen.add(name)
            anchors.append(name)

    return anchors


def find_toc_section2_heading_text(prefix_xml: str) -> str:
    for _anchor, body_text in _iter_toc_hyperlinks(prefix_xml):
        normalized = _normalize_spaces(body_text)
        if _section2_toc_text_matches(normalized) and not is_empty_section2_heading_text(normalized):
            return normalize_section2_heading_text(normalized)
    return ""


def resolve_section2_bookmark_names(
    document_xml: str,
    block_spans: Sequence[Tuple[int, int]],
    section2_start_idx: Optional[int],
) -> List[str]:
    names: List[str] = []
    seen = set()

    prefix_end = 0
    if section2_start_idx is not None and 0 <= section2_start_idx < len(block_spans):
        prefix_end = block_spans[section2_start_idx][0]
        paragraph_xml = document_xml[block_spans[section2_start_idx][0]:block_spans[section2_start_idx][1]]
        for name in extract_bookmark_names(paragraph_xml):
            if name not in seen:
                seen.add(name)
                names.append(name)

    prefix_xml = document_xml[:prefix_end] if prefix_end else document_xml
    for name in find_toc_anchor_names(prefix_xml):
        if name not in seen:
            seen.add(name)
            names.append(name)

    return names


def resolve_section2_heading_text(
    document_xml: str,
    block_spans: Sequence[Tuple[int, int]],
    section2_start_idx: Optional[int],
    default: str = DEFAULT_SECTION2_HEADING,
) -> str:
    prefix_end = 0
    if section2_start_idx is not None and 0 <= section2_start_idx < len(block_spans):
        paragraph_xml = document_xml[block_spans[section2_start_idx][0]:block_spans[section2_start_idx][1]]
        body_text = _collect_text(paragraph_xml)
        if is_section2_heading_text(body_text) and not is_empty_section2_heading_text(body_text):
            return normalize_section2_heading_text(body_text, default=default)
        prefix_end = block_spans[section2_start_idx][0]

    prefix_xml = document_xml[:prefix_end] if prefix_end else document_xml
    toc_heading = find_toc_section2_heading_text(prefix_xml)
    if toc_heading:
        return toc_heading
    return default


def paragraph_has_section2_marker(paragraph_xml: str) -> bool:
    return is_section2_heading_text(_collect_text(paragraph_xml))


def add_bookmarks_to_paragraph(
    paragraph: ET.Element,
    bookmark_names: Iterable[str],
    start_id: int,
) -> int:
    names = [name for name in bookmark_names if name]
    if not names:
        return start_id

    insert_at = 1 if paragraph.find(f"./{{{W_NS}}}pPr") is not None else 0
    next_id = start_id
    for offset, name in enumerate(names):
        bookmark_id = str(next_id)
        next_id += 1
        start = ET.Element(f"{{{W_NS}}}bookmarkStart")
        start.set(f"{{{W_NS}}}id", bookmark_id)
        start.set(f"{{{W_NS}}}name", name)
        paragraph.insert(insert_at + offset, start)

    for index, _name in enumerate(names):
        bookmark_id = str(start_id + index)
        end = ET.Element(f"{{{W_NS}}}bookmarkEnd")
        end.set(f"{{{W_NS}}}id", bookmark_id)
        paragraph.append(end)
    return next_id


def ensure_page_break_before(paragraph: ET.Element) -> None:
    p_pr = paragraph.find(f"./{{{W_NS}}}pPr")
    if p_pr is None:
        p_pr = ET.Element(f"{{{W_NS}}}pPr")
        paragraph.insert(0, p_pr)
    if p_pr.find(f"./{{{W_NS}}}pageBreakBefore") is None:
        ET.SubElement(p_pr, f"{{{W_NS}}}pageBreakBefore")


def set_paragraph_text(paragraph: ET.Element, text: str) -> None:
    xml_ns = "http://www.w3.org/XML/1998/namespace"
    text_nodes = paragraph.findall(f".//{{{W_NS}}}t")
    if not text_nodes:
        run = paragraph.find(f"./{{{W_NS}}}r")
        if run is None:
            run = ET.SubElement(paragraph, f"{{{W_NS}}}r")
        text_node = ET.SubElement(run, f"{{{W_NS}}}t", attrib={f"{{{xml_ns}}}space": "preserve"})
        text_nodes = [text_node]
    text_nodes[0].text = text
    text_nodes[0].set(f"{{{xml_ns}}}space", "preserve")
    for extra in text_nodes[1:]:
        extra.text = ""


def _remove_bookmark_nodes(paragraph: ET.Element) -> None:
    to_remove: List[Tuple[ET.Element, ET.Element]] = []
    for parent in paragraph.iter():
        for child in list(parent):
            if child.tag in (f"{{{W_NS}}}bookmarkStart", f"{{{W_NS}}}bookmarkEnd"):
                to_remove.append((parent, child))
    for parent, child in to_remove:
        parent.remove(child)


def strip_section2_heading_prefix(text: str, default_title: str = DEFAULT_SECTION2_HEADING_TITLE) -> str:
    normalized = _normalize_spaces(text)
    if not normalized or is_empty_section2_heading_text(normalized):
        return default_title
    title_match = re.match(
        r"^\s*(?:Раздел\s+)?II\s*(?![IVXLCDM])[.)–—\-:]?\s+(?P<title>.+)$",
        normalized,
        re.IGNORECASE,
    )
    if title_match:
        return title_match.group("title").strip()
    return normalized


def paragraph_visible_text(paragraph: ET.Element) -> str:
    return _normalize_spaces("".join(node.text or "" for node in paragraph.findall(f".//{{{W_NS}}}t")))


def paragraph_template_uses_auto_numbering(template: ET.Element) -> bool:
    p_pr = template.find(f"./{{{W_NS}}}pPr")
    if p_pr is not None and p_pr.find(f"./{{{W_NS}}}numPr") is not None:
        return True
    visible = paragraph_visible_text(template)
    if not visible:
        return True
    return not bool(SECTION1_START_RE.match(visible))


def build_section_heading_paragraph(
    template: ET.Element,
    text: str,
    bookmark_names: Optional[Iterable[str]] = None,
    bookmark_start_id: Optional[int] = None,
    page_break_before: bool = True,
) -> ET.Element:
    paragraph = ET.fromstring(ET.tostring(template, encoding="unicode"))
    _remove_bookmark_nodes(paragraph)

    if page_break_before:
        ensure_page_break_before(paragraph)
    display_text = strip_section2_heading_prefix(text) if paragraph_template_uses_auto_numbering(template) else text
    set_paragraph_text(paragraph, display_text)
    if bookmark_names:
        add_bookmarks_to_paragraph(paragraph, bookmark_names, bookmark_start_id or 0)
    return paragraph


def get_section_heading_template_paragraph(
    body,
    section1_start_idx: Optional[int],
    source_paragraph: Optional[ET.Element] = None,
) -> Optional[ET.Element]:
    if section1_start_idx is not None:
        blocks = []
        for child in body:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if tag == "p":
                blocks.append(child)
        if 0 <= section1_start_idx < len(blocks):
            return blocks[section1_start_idx]
    return source_paragraph


def copy_paragraph_properties(source: ET.Element, target: ET.Element) -> None:
    source_p_pr = source.find(f"./{{{W_NS}}}pPr")
    if source_p_pr is None:
        return
    target_p_pr = target.find(f"./{{{W_NS}}}pPr")
    if target_p_pr is None:
        target.insert(0, ET.fromstring(ET.tostring(source_p_pr, encoding="unicode")))
        return
    for child in list(target_p_pr):
        target_p_pr.remove(child)
    for child in source_p_pr:
        target_p_pr.append(ET.fromstring(ET.tostring(child, encoding="unicode")))


def copy_first_run_properties(source: ET.Element, target_run: ET.Element) -> None:
    source_run = source.find(f"./{{{W_NS}}}r")
    if source_run is None:
        return
    source_r_pr = source_run.find(f"./{{{W_NS}}}rPr")
    if source_r_pr is None:
        return
    target_r_pr = target_run.find(f"./{{{W_NS}}}rPr")
    if target_r_pr is None:
        target_run.insert(0, ET.fromstring(ET.tostring(source_r_pr, encoding="unicode")))
        return
    for child in list(target_r_pr):
        target_r_pr.remove(child)
    for child in source_r_pr:
        target_r_pr.append(ET.fromstring(ET.tostring(child, encoding="unicode")))


def parse_paragraph_xml(paragraph_xml: str) -> Optional[ET.Element]:
    wrapped = f'<root xmlns:w="{W_NS}">{paragraph_xml}</root>'
    try:
        root = ET.fromstring(wrapped)
    except ET.ParseError:
        return None
    paragraph = root.find(f"./{{{W_NS}}}p")
    return paragraph


def next_bookmark_id(document_xml: str) -> int:
    return _max_bookmark_id(document_xml) + 1
