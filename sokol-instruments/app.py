import base64
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import streamlit as st
import streamlit.components.v1 as components

from sokol_reports.memorandum.docx_generator import generate_memorandum
from sokol_reports.memorandum.parser import parse_az_for_memorandum
from sokol_reports.section_ii.docx_generator import process_document
from ui.theme import inject_theme


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
    source, parse_error = parse_az_for_memorandum(str(input_path))
    if parse_error:
        raise RuntimeError(parse_error)

    result_path, gen_error = generate_memorandum(source, str(output_path))
    if gen_error:
        raise RuntimeError(gen_error)
    return Path(result_path)


def start_download(file_name: str, file_bytes: bytes) -> None:
    encoded_file = base64.b64encode(file_bytes).decode("ascii")
    safe_file_name = json.dumps(file_name)
    components.html(
        f"""
        <script>
            const link = document.createElement("a");
            link.href = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,{encoded_file}";
            link.download = {safe_file_name};
            link.click();
        </script>
        """,
        height=0,
    )


def render_tool(
    *,
    key_prefix: str,
    title: str,
    description: str,
    generate,
) -> None:
    st.markdown(
        f"""
        <div class="tool-panel">
            <div class="tool-title">{title}</div>
            <div class="tool-text">{description}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    uploaded_file = st.file_uploader(
        "Выберите файл .docx",
        type=["docx"],
        key=f"{key_prefix}_upload",
        label_visibility="collapsed",
    )

    upload_signature_key = f"{key_prefix}_upload_signature"

    if uploaded_file is None:
        st.session_state.pop(upload_signature_key, None)

    if uploaded_file is not None:
        upload_signature = (uploaded_file.name, uploaded_file.size)
        if st.session_state.get(upload_signature_key) != upload_signature:
            st.session_state[upload_signature_key] = upload_signature

    if st.button(
        "Сгенерировать и скачать",
        key=f"{key_prefix}_button",
        disabled=uploaded_file is None,
    ):
        with st.spinner("Файл обрабатывается..."):
            try:
                with TemporaryDirectory() as temp_dir:
                    work_dir = Path(temp_dir)
                    input_path = save_uploaded_file(uploaded_file, work_dir)
                    result_path = generate(input_path, work_dir)
                    result_name = result_path.name
                    result_bytes = result_path.read_bytes()
                start_download(result_name, result_bytes)
                st.success("Документ готов. Скачивание началось.")
            except Exception as exc:
                st.error(f"Не удалось создать документ: {exc}")


st.set_page_config(page_title="SOKOL — Инструменты аудита", layout="wide")
inject_theme()

st.markdown(
    """
    <div class="sokol-topbar">
        <h1 class="sokol-topbar__logo">SOKOL</h1>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown('<h2 class="page-title">Инструменты аудита</h2>', unsafe_allow_html=True)

mode = st.radio(
    "Режим",
    options=["АЗ", "ДЗ"],
    horizontal=True,
    label_visibility="collapsed",
    key="tools_mode",
)

st.markdown('<div class="mode-switch-spacer"></div>', unsafe_allow_html=True)

with st.container(border=True):
    st.markdown('<div class="section-title">Парсинг</div>', unsafe_allow_html=True)

    if mode == "АЗ":
        render_tool(
            key_prefix="az",
            title="1. Парсинг Раздела II Аудиторского Заключения",
            description=(
                "Загрузите Аудиторское Заключение в формате .docx без Раздела II, "
                "чтобы собрать таблицу с основными результатами аудита и аудиторскими рекомендациями."
            ),
            generate=make_section_ii_plain,
        )
        render_tool(
            key_prefix="az_links",
            title="2. Парсинг Раздела II Аудиторского Заключения (с гиперссылками)",
            description=(
                "То же, что в пункте 1, но название каждого наблюдения в таблице будет "
                "гиперссылкой на это наблюдение в тексте документа."
            ),
            generate=make_section_ii_with_links,
        )
    else:
        render_tool(
            key_prefix="dz",
            title="1. Парсинг Приложения 2 к ДЗ",
            description=(
                "Загрузите Аудиторское Заключение в формате .docx с Разделом II, "
                "чтобы сгенерировать Приложение 2 к Докладной Записке."
            ),
            generate=make_memorandum,
        )
