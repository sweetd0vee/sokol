import copy
import zipfile
from dataclasses import dataclass
from typing import List, Optional, Tuple

import xml.etree.ElementTree as ET

from app.services.reports.section_ii.models import RunFragment
from app.services.reports.section_ii.patterns import OBS_BLOCK_START_RE, W_NS
from app.services.reports.section_ii.xml_utils import iter_unwrapped


@dataclass(frozen=True)
class DocumentBlock:
    kind: str
    text: str
    runs: List[RunFragment]
    index: int
    cell_index: Optional[int] = None
    table_index: Optional[int] = None
    row_index: Optional[int] = None
    has_frame_border: bool = False


@dataclass(frozen=True)
class TextboxBlock:
    anchor_index: int
    runs: List[RunFragment]


def load_document_xml(file_path: str) -> ET.Element:
    with zipfile.ZipFile(file_path, "r") as zf:
        with zf.open("word/document.xml") as f:
            return ET.parse(f).getroot()


def get_text_from_xml(root: ET.Element) -> str:
    """Извлекает весь текст из document.xml с сохранением структуры параграфов."""
    parts = []
    for p in root.iter(f"{{{W_NS}}}p"):
        p_text = "".join(t.text or "" for t in p.iter(f"{{{W_NS}}}t") if t.text)
        if p_text.strip():
            parts.append(p_text)
    return "\n".join(parts)


def get_run_text(r: ET.Element) -> str:
    parts: List[str] = []
    for child in r.iter():
        if child is r:
            continue
        tag = child.tag
        if tag == f"{{{W_NS}}}t":
            if child.text is not None:
                parts.append(child.text)
        elif tag == f"{{{W_NS}}}instrText":
            continue
        elif tag in (f"{{{W_NS}}}tab", f"{{{W_NS}}}ptab"):
            parts.append("\t")
        elif tag in (f"{{{W_NS}}}br", f"{{{W_NS}}}cr"):
            parts.append("\n")
        elif tag == f"{{{W_NS}}}noBreakHyphen":
            parts.append("\u2011")
        elif tag == f"{{{W_NS}}}softHyphen":
            parts.append("\u00ad")
        elif tag == f"{{{W_NS}}}sym":
            char_hex = child.get(f"{{{W_NS}}}char") or child.get("char")
            if char_hex:
                try:
                    parts.append(chr(int(char_hex, 16)))
                except ValueError:
                    pass
        elif tag == f"{{{W_NS}}}fldChar":
            fld_type = child.get(f"{{{W_NS}}}fldCharType") or child.get("fldCharType")
            if fld_type:
                parts.append("")
    return "".join(parts)


def run_has_payload(r: ET.Element) -> bool:
    for child in list(r):
        if child.tag != f"{{{W_NS}}}rPr":
            return True
    return False


def _fld_char_type(r: ET.Element) -> Optional[str]:
    for child in r.iter(f"{{{W_NS}}}fldChar"):
        return child.get(f"{{{W_NS}}}fldCharType") or child.get("fldCharType")
    return None


def get_paragraph_runs(p: ET.Element) -> Tuple[str, List[RunFragment]]:
    runs: List[RunFragment] = []
    p_text_parts: List[str] = []
    skipping_field_instr = False

    def handle_run(r: ET.Element) -> None:
        nonlocal skipping_field_instr
        fld_type = _fld_char_type(r)
        if fld_type == "begin":
            skipping_field_instr = True
            return
        if fld_type in ("separate", "end"):
            skipping_field_instr = False
            return
        if skipping_field_instr:
            return
        rPr = r.find(f"./{{{W_NS}}}rPr")
        rPr_copy = copy.deepcopy(rPr) if rPr is not None else None
        run_text = get_run_text(r)
        if run_text == "" and not run_has_payload(r):
            return
        tab_only = bool(run_text) and not run_text.replace("\t", "").strip()
        runs.append(
            RunFragment(
                text=run_text,
                rPr=copy.deepcopy(rPr_copy),
                is_tab=tab_only,
                raw_r=copy.deepcopy(r),
            )
        )
        p_text_parts.append(run_text)

    def walk(node: ET.Element) -> None:
        for child in list(node):
            tag = child.tag
            if tag == f"{{{W_NS}}}r":
                handle_run(child)
                continue
            # Таб между номером и названием иногда лежит рядом с w:r, а не внутри него.
            if tag in (f"{{{W_NS}}}tab", f"{{{W_NS}}}ptab"):
                if not skipping_field_instr:
                    p_text_parts.append("\t")
                continue
            walk(child)

    walk(p)
    return ("".join(p_text_parts), runs)


def clone_runs(runs: List[RunFragment]) -> List[RunFragment]:
    cloned: List[RunFragment] = []
    for frag in runs:
        cloned.append(
            RunFragment(
                text=frag.text,
                rPr=copy.deepcopy(frag.rPr) if frag.rPr is not None else None,
                br_before=frag.br_before,
                is_tab=frag.is_tab,
                raw_r=copy.deepcopy(frag.raw_r) if frag.raw_r is not None else None,
            )
        )
    return cloned


def runs_to_text(runs: List[RunFragment]) -> str:
    parts: List[str] = []
    for frag in runs:
        if frag.br_before:
            parts.append("\n")
        parts.append(frag.text or "")
    return "".join(parts)


def local_name(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def iter_txbx_contents(el: ET.Element) -> List[ET.Element]:
    return [node for node in el.iter() if local_name(node.tag) == "txbxContent"]


def collect_runs_from_paragraphs(paragraphs: List[ET.Element]) -> List[RunFragment]:
    combined: List[RunFragment] = []
    for p in paragraphs:
        _p_text, runs = get_paragraph_runs(p)
        if not runs:
            continue
        cloned = clone_runs(runs)
        if combined and cloned:
            cloned[0].br_before = True
        combined.extend(cloned)
    return combined


def has_txbx_contents(el: ET.Element) -> bool:
    return any(local_name(node.tag) == "txbxContent" for node in el.iter())


def has_paragraph_border(p: ET.Element) -> bool:
    pPr = p.find(f"./{{{W_NS}}}pPr")
    if pPr is None:
        return False
    return pPr.find(f"./{{{W_NS}}}pBdr") is not None


def collect_textboxes_from_element(
    el: ET.Element,
    anchor_idx: int,
    textboxes: List[TextboxBlock],
) -> None:
    for txbx in iter_txbx_contents(el):
        paragraphs = list(txbx.iter(f"{{{W_NS}}}p"))
        if not paragraphs:
            continue
        runs = collect_runs_from_paragraphs(paragraphs)
        if runs:
            textboxes.append(TextboxBlock(anchor_index=anchor_idx, runs=runs))


def collect_runs_from_cell(tc: ET.Element) -> List[RunFragment]:
    combined: List[RunFragment] = []
    for p in tc.findall(f".//{{{W_NS}}}p"):
        _p_text, runs = get_paragraph_runs(p)
        if not runs:
            continue
        cloned = clone_runs(runs)
        if combined and cloned:
            cloned[0].br_before = True
        combined.extend(cloned)
    return combined


def get_cell_text(tc: ET.Element) -> str:
    parts = []
    for node in tc.iter():
        tag = node.tag
        if tag == f"{{{W_NS}}}t":
            if node.text:
                parts.append(node.text)
        elif tag in (f"{{{W_NS}}}tab", f"{{{W_NS}}}ptab"):
            parts.append("\t")
        elif tag in (f"{{{W_NS}}}br", f"{{{W_NS}}}cr"):
            parts.append("\n")
        elif tag == f"{{{W_NS}}}noBreakHyphen":
            parts.append("\u2011")
        elif tag == f"{{{W_NS}}}softHyphen":
            parts.append("\u00ad")
        elif tag == f"{{{W_NS}}}sym":
            char_hex = node.get(f"{{{W_NS}}}char") or node.get("char")
            if char_hex:
                try:
                    parts.append(chr(int(char_hex, 16)))
                except ValueError:
                    pass
    return "".join(parts)


def extract_name_runs_from_tables(root: ET.Element, min_block_idx: int = 0) -> Tuple[dict, List[str]]:
    name_runs_map: dict = {}
    order: List[str] = []
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return name_runs_map, order
    block_idx = 0
    for child in list(body):
        tag = local_name(child.tag)
        if tag not in {"p", "tbl"}:
            continue
        if tag != "tbl":
            block_idx += 1
            continue
        if block_idx < min_block_idx:
            block_idx += 1
            continue
        tbl = child
        for tr in tbl.findall(f"./{{{W_NS}}}tr"):
            tcs = tr.findall(f"./{{{W_NS}}}tc")
            if len(tcs) < 2:
                continue
            first_text = get_cell_text(tcs[0])
            if not first_text:
                continue
            m = OBS_BLOCK_START_RE.match(first_text)
            if not m:
                continue
            obs_num = m.group(1)
            if obs_num in name_runs_map:
                continue
            runs = collect_runs_from_cell(tcs[1])
            if not runs:
                continue
            name_runs_map[obs_num] = runs
            order.append(obs_num)
        block_idx += 1
    return name_runs_map, order


def extract_document_blocks(root: ET.Element) -> Tuple[List[DocumentBlock], List[TextboxBlock]]:
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return ([], [])
    blocks: List[DocumentBlock] = []
    textboxes: List[TextboxBlock] = []
    for tag, child in iter_unwrapped(body, "p", "tbl"):
        if tag == "p":
            p_text, runs = get_paragraph_runs(child)
            has_txbx = has_txbx_contents(child)
            if p_text != "" or runs or has_txbx:
                anchor_idx = len(blocks)
                blocks.append(
                    DocumentBlock(
                        kind="paragraph",
                        text=p_text,
                        runs=runs,
                        index=anchor_idx,
                        cell_index=None,
                        table_index=None,
                        row_index=None,
                        has_frame_border=has_paragraph_border(child),
                    )
                )
                if has_txbx:
                    collect_textboxes_from_element(child, anchor_idx, textboxes)
            continue
        table_index = max((block.table_index or 0 for block in blocks if block.table_index is not None), default=-1) + 1
        for row_idx, (_row_tag, tr) in enumerate(iter_unwrapped(child, "tr")):
            tcs = [tc for _tc_tag, tc in iter_unwrapped(tr, "tc")]
            for tc_idx, tc in enumerate(tcs):
                for _p_tag, p in iter_unwrapped(tc, "p"):
                    p_text, runs = get_paragraph_runs(p)
                    has_txbx = has_txbx_contents(p)
                    if p_text != "" or runs or has_txbx:
                        anchor_idx = len(blocks)
                        blocks.append(
                            DocumentBlock(
                                kind="table_cell",
                                text=p_text,
                                runs=runs,
                                index=anchor_idx,
                                cell_index=tc_idx,
                                table_index=table_index,
                                row_index=row_idx,
                                has_frame_border=has_paragraph_border(p),
                            )
                        )
                        if has_txbx:
                            collect_textboxes_from_element(p, anchor_idx, textboxes)
    return blocks, textboxes
