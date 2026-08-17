import base64
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Optional

import streamlit as st

APP_DIR = Path(__file__).resolve().parent
FAVICON_PATH = APP_DIR / "images" / "sberbank.png"
CONTROL_FILE_HEADER_TEMPLATE = APP_DIR / "data" / "файл контроля шаблон (шапка).xlsx"
import streamlit.components.v1 as components

from sokol_reports.control_file.generator import generate_control_file_template
from sokol_reports.memorandum.docx_generator import generate_memorandum
from sokol_reports.memorandum.parser import parse_az_for_memorandum
from sokol_reports.section_ii.docx_generator import process_document
from ui.dictionary_tab import ensure_departments_loaded, get_active_departments, render_dictionary_tab
from ui.theme import inject_theme


OUTPUT_MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

TOOL_BUTTON_WIDTH = 288


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


def render_tool(
    *,
    key_prefix: str,
    title: str,
    description: str,
    generate,
    output_format: str = "docx",
    success_message: str = "Документ готов. Скачивание началось.",
    template_file: Optional[Path] = None,
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

    if template_file is not None:
        if not template_file.is_file():
            st.error(f"Шаблон не найден: {template_file.name}")
        else:
            if st.button(
                "Скачать шаблон",
                key=f"{key_prefix}_template_download",
                type="secondary",
                width=TOOL_BUTTON_WIDTH,
            ):
                start_download(
                    template_file.name,
                    template_file.read_bytes(),
                    output_format="xlsx",
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
        type="primary",
        width=TOOL_BUTTON_WIDTH,
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
                start_download(result_name, result_bytes, output_format=output_format)
                st.success(success_message)
            except Exception as exc:
                st.error(f"Не удалось создать документ: {exc}")


st.set_page_config(
    page_title="SOKOL — Инструменты аудита",
    page_icon=str(FAVICON_PATH),
    layout="wide",
)
inject_theme()
ensure_departments_loaded()

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
    options=["АЗ", "ДЗ", "Справочник"],
    horizontal=True,
    label_visibility="collapsed",
    key="tools_mode",
)

st.markdown('<div class="mode-switch-spacer"></div>', unsafe_allow_html=True)

if mode == "Справочник":
    with st.container(border=True):
        render_dictionary_tab()
else:
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
            render_tool(
                key_prefix="az_control",
                title="3. Парсинг Аудиторского Заключения под форму файла контроля",
                description=(
                    "Загрузите Аудиторское заключение с Разделом II, "
                    "чтобы подготовить шаблон для файла контроля."
                ),
                generate=make_control_file,
                output_format="xlsx",
                success_message="Файл контроля готов. Скачивание xlsx началось.",
                template_file=CONTROL_FILE_HEADER_TEMPLATE,
            )
        elif mode == "ДЗ":
            render_tool(
                key_prefix="dz",
                title="1. Парсинг Приложения 2 к ДЗ",
                description=(
                    "Загрузите Аудиторское Заключение в формате .docx с Разделом II, "
                    "чтобы сгенерировать Приложение 2 к Докладной Записке."
                ),
                generate=make_memorandum,
            )
