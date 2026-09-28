"""Парсер аудиторских заключений для извлечения наблюдений из раздела 3."""

from __future__ import annotations

from app.services.reports.section_ii import xml_utils
from app.services.reports.section_ii.docx_blocks import (
    clone_runs,
    extract_document_blocks,
    extract_name_runs_from_tables,
    load_document_xml,
    runs_to_text,
)
from app.services.reports.section_ii.field_parser import (
    extract_audit_object_and_manager,
    extract_deadline_from_text,
    extract_materiality_from_text,
    extract_rec_label,
    parse_text_observations,
)
from app.services.reports.section_ii.heading_detection import (
    build_block_heading_state,
    find_section3_flat_block_idx,
    find_sokol_summary_block_indices,
)
from app.services.reports.section_ii.models import Observation, RecommendationEntry
from app.services.reports.section_ii.patterns import OBS_BLOCK_START_RE, W_NS
from app.services.reports.section_ii.run_slices import (
    _remove_text_spans_from_runs,
    extract_rec_entries_from_framed_paragraphs,
    extract_rec_entries_from_runs,
    extract_rec_entries_from_table_blocks,
    extract_rec_runs_from_block,
)

_extract_rec_entries_from_runs = extract_rec_entries_from_runs


def parse_observations(text: str) -> list[Observation]:
    """
    Парсит наблюдения из текста раздела 3.

    Извлекает:
    - Номер главы (Глава 3, Раздел 3)
    - Номер наблюдения (3.1, 4.1.1)
    - Название наблюдения
    - Уровень существенности (низкий/средний/высокий)
    - Аудиторская рекомендация (полный текст)
    - Срок (Срок – DD.MM.YYYY)
    """
    return parse_text_observations(text)


def _iter_observation_starts(blocks, section3_start: int) -> list[tuple[int, str]]:
    """Первые вхождения наблюдений строго в порядке блоков документа."""
    starts: list[tuple[int, str]] = []
    seen: set[str] = set()
    summary_indices = find_sokol_summary_block_indices(blocks)
    for idx, block in enumerate(blocks):
        if idx < section3_start:
            continue
        if idx in summary_indices:
            continue
        if getattr(block, "has_frame_border", False):
            continue
        if block.cell_index not in (None, 0):
            continue
        match = OBS_BLOCK_START_RE.match(block.text or "")
        if not match:
            continue
        obs_num = match.group(1)
        if obs_num in seen:
            continue
        seen.add(obs_num)
        starts.append((idx, obs_num))
    return starts


def parse_observations_from_file_with_runs(file_path: str) -> list[Observation]:
    """Парсит наблюдения и сохраняет форматирование runs для имени и рекомендаций."""
    root = load_document_xml(file_path)
    body = root.find(f".//{{{W_NS}}}body")
    if body is None:
        return []

    section3_top_level_idx = xml_utils.find_insert_before_section3(body, min_idx=0)
    table_min_idx = section3_top_level_idx if section3_top_level_idx is not None else 0

    table_name_runs, _table_order = extract_name_runs_from_tables(root, min_block_idx=table_min_idx)
    blocks, textboxes = extract_document_blocks(root)
    section3_start = find_section3_flat_block_idx(blocks)

    # Порядок = только порядок появления в документе. Никакой дописки «в конец».
    ordered_starts = _iter_observation_starts(blocks, section3_start)
    if not ordered_starts:
        return []

    text = "\n".join(block.text for block in blocks[section3_start:] if block.text.strip())
    parsed_by_number = {obs.number: obs for obs in parse_observations(text)}

    observations: list[Observation] = []
    for _idx, obs_num in ordered_starts:
        if obs_num in parsed_by_number:
            observations.append(parsed_by_number[obs_num])
            continue
        name_runs = clone_runs(table_name_runs[obs_num]) if obs_num in table_name_runs else None
        observations.append(
            Observation(
                number=obs_num,
                chapter=obs_num.split(".")[0] if obs_num else "",
                chapter_title="",
                name=runs_to_text(name_runs) if name_runs else "",
                materiality_level="",
                recommendations="",
                deadline="",
                rec_label="Рекомендация",
                name_runs=name_runs,
                rec_runs=None,
            )
        )
    for obs in observations:
        if obs.number in table_name_runs:
            name_runs = clone_runs(table_name_runs[obs.number])
            obs.name_runs = name_runs
            obs.name = runs_to_text(name_runs)

    block_heading_state, heading_map = build_block_heading_state(blocks)
    obs_start_idx: dict[str, int] = {obs_num: idx for idx, obs_num in ordered_starts}

    for obs_idx, obs in enumerate(observations):
        start_idx = obs_start_idx.get(obs.number)
        if start_idx is None:
            continue
        state_chapter, state_title = block_heading_state.get(start_idx, ("", ""))
        obs_major = obs.number.split(".")[0] if obs.number else ""
        # Номер наблюдения — источник главы. Иначе пропущенный заголовок
        # оставляет наблюдения 4.x/5.x под названием предыдущей главы.
        if obs_major:
            obs.chapter = obs_major
            if obs_major in heading_map:
                obs.chapter_title = heading_map[obs_major]
            elif state_chapter == obs_major and state_title:
                obs.chapter_title = state_title
        else:
            if state_chapter:
                obs.chapter = state_chapter
            if state_title:
                obs.chapter_title = state_title
            elif obs.chapter:
                if obs.chapter in heading_map:
                    obs.chapter_title = heading_map[obs.chapter]
                else:
                    base = obs.chapter.split(".")[0]
                    if base in heading_map:
                        obs.chapter_title = heading_map[base]

        end_idx = len(blocks)
        for next_idx in range(obs_idx + 1, len(observations)):
            next_start = obs_start_idx.get(observations[next_idx].number)
            if next_start is not None:
                end_idx = next_start
                break

        observation_blocks = blocks[start_idx:end_idx]
        fallback_block = [
            (item.text, item.runs)
            for item in observation_blocks
            if item.kind == "paragraph" and not item.has_frame_border
        ]
        rec_entries: list[RecommendationEntry] = []
        for textbox in textboxes:
            if start_idx <= textbox.anchor_index < end_idx:
                rec_entries.extend(extract_rec_entries_from_runs(textbox.runs))
        rec_entries.extend(extract_rec_entries_from_framed_paragraphs(observation_blocks))
        rec_entries.extend(extract_rec_entries_from_table_blocks(observation_blocks))
        if rec_entries:
            obs.rec_entries = rec_entries
            obs.rec_runs = None
        else:
            obs.rec_runs = extract_rec_runs_from_block(fallback_block)
        block_text = " ".join(item.text for item in observation_blocks)
        obs.materiality_level = extract_materiality_from_text(block_text)
        obs.deadline = extract_deadline_from_text(block_text)
        obs.rec_label = extract_rec_label(block_text)
        audit_object, manager = extract_audit_object_and_manager(block_text)
        if audit_object:
            obs.audit_object = audit_object
        if manager:
            obs.manager = manager

    return observations
