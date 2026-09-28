from __future__ import annotations

import base64
import html
import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

import streamlit as st
import streamlit.components.v1 as components

from sokol_reports.control_file.generator import generate_control_file_template
from sokol_reports.memorandum.docx_generator import generate_memorandum
from sokol_reports.memorandum.parser import parse_az_for_memorandum
from sokol_reports.section_ii.docx_generator import process_document
from ui.dictionary_tab import get_active_departments

OUTPUT_MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

GenerateFn = Callable[[Path, Path], Path]


@dataclass(frozen=True)
class ToolSpec:
    key_prefix: str
    title: str
    description: str
    generate: GenerateFn
    output_format: str = "docx"
    success_message: str = "Документ готов. Скачивание началось."
    template_file: Path | None = None


def save_uploaded_file(uploaded_file, folder: Path) -> Path:
    input_path = folder / uploaded_file.name
    input_path.write_bytes(uploaded_file.getbuffer())
    return input_path


def make_section_ii(input_path: Path, output_dir: Path, *, with_hyperlinks: bool = False) -> Path:
    suffix = "_section_ii_links" if with_hyperlinks else "_section_ii"
    output_path = output_dir / f"{input_path.stem}{suffix}.docx"
    result_path, _, error = process_document(
        str(input_path),
        str(output_path),
        with_hyperlinks=with_hyperlinks,
    )
    if error:
        raise RuntimeError(error)
    return Path(result_path)


def make_section_ii_plain(input_path: Path, output_dir: Path) -> Path:
    return make_section_ii(input_path, output_dir, with_hyperlinks=False)


def make_section_ii_with_links(input_path: Path, output_dir: Path) -> Path:
    return make_section_ii(input_path, output_dir, with_hyperlinks=True)


def make_memorandum(input_path: Path, output_dir: Path) -> Path:
    output_path = output_dir / f"{input_path.stem}_dz.docx"
    source, parse_error = parse_az_for_memorandum(
        str(input_path),
        department_names=get_active_departments(),
    )
    if parse_error:
        raise RuntimeError(parse_error)

    result_path, gen_error = generate_memorandum(source, str(output_path))
    if gen_error:
        raise RuntimeError(gen_error)
    return Path(result_path)


def make_control_file(input_path: Path, output_dir: Path) -> Path:
    output_path = output_dir / f"{input_path.stem}_control.xlsx"
    result_path, error = generate_control_file_template(str(input_path), str(output_path))
    if error:
        raise RuntimeError(error)
    return Path(result_path)


def start_download(file_name: str, file_bytes: bytes, *, output_format: str = "docx") -> None:
    mime_type = OUTPUT_MIME.get(output_format, OUTPUT_MIME["docx"])
    encoded_file = base64.b64encode(file_bytes).decode("ascii")
    safe_file_name = json.dumps(file_name)
    components.html(
        f"""
        <script>
            const link = document.createElement("a");
            link.href = "data:{mime_type};base64,{encoded_file}";
            link.download = {safe_file_name};
            link.click();
        </script>
        """,
        height=0,
    )


def render_tool(spec: ToolSpec) -> None:
    st.markdown(
        f"""
        <div class="tool-panel">
            <div class="tool-title">{html.escape(spec.title)}</div>
            <div class="tool-text">{html.escape(spec.description)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if spec.template_file is not None:
        if not spec.template_file.is_file():
            st.error(f"Шаблон не найден: {spec.template_file.name}")
        else:
            if st.button(
                "Скачать шаблон",
                key=f"{spec.key_prefix}_template_download",
                type="secondary",
            ):
                start_download(
                    spec.template_file.name,
                    spec.template_file.read_bytes(),
                    output_format="xlsx",
                )

    uploaded_file = st.file_uploader(
        "Выберите файл .docx",
        type=["docx"],
        key=f"{spec.key_prefix}_upload",
        label_visibility="collapsed",
    )

    if st.button(
        "Сгенерировать и скачать",
        key=f"{spec.key_prefix}_button",
        type="primary",
        disabled=uploaded_file is None,
    ):
        with st.spinner("Файл обрабатывается..."):
            try:
                with TemporaryDirectory() as temp_dir:
                    work_dir = Path(temp_dir)
                    input_path = save_uploaded_file(uploaded_file, work_dir)
                    result_path = spec.generate(input_path, work_dir)
                    result_name = result_path.name
                    result_bytes = result_path.read_bytes()
                start_download(result_name, result_bytes, output_format=spec.output_format)
                st.success(spec.success_message)
            except Exception as exc:
                st.error(f"Не удалось создать документ: {exc}")
