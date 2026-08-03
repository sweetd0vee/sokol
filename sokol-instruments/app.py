import base64
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import streamlit as st
import streamlit.components.v1 as components

from sokol_reports.memorandum.docx_generator import generate_memorandum
from sokol_reports.memorandum.parser import parse_az_for_memorandum
from sokol_reports.section_ii.docx_generator import process_document


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


st.set_page_config(page_title="SOKOL", layout="centered")

st.markdown(
    """
    <style>
        :root {
            --blue-900: #0b365d;
            --blue-800: #0f4c81;
            --blue-700: #1b6ca8;
            --blue-100: #edf6ff;
            --gray-50: #fafbfd;
            --gray-100: #f5f7fa;
            --gray-200: #e6edf3;
            --gray-500: #7b8b99;
            --gray-700: #34495e;
            --text: #24394c;
        }

        .stApp {
            background: #f6f8fb;
            color: var(--text);
        }

        .block-container {
            max-width: 1120px;
            min-height: calc(100vh - 3rem);
            margin-top: 1.5rem;
            margin-bottom: 1.5rem;
            padding: 1.8rem 2.35rem 2.45rem;
            background: #ffffff;
            border: 1px solid var(--gray-200);
            border-radius: 18px;
            box-shadow: 0 10px 30px rgba(11, 54, 93, 0.06);
        }

        .brand {
            color: var(--blue-900);
            font-size: 3.1rem;
            font-weight: 950;
            letter-spacing: 0.08em;
            margin-bottom: 1.55rem;
            text-align: center;
        }

        .main-card {
            margin: 0;
            padding: 0;
        }

        .app-title {
            color: var(--blue-900);
            font-size: 1.65rem;
            font-weight: 800;
            margin: 0 0 1.65rem;
            text-align: center;
        }

        .tool-title {
            color: var(--blue-900);
            font-size: 1.2rem;
            font-weight: 800;
            margin: 1.25rem 0 0.55rem;
            text-align: center;
        }

        .tool-text {
            color: var(--gray-500);
            font-size: 1.08rem;
            line-height: 1.5;
            margin: 0 auto 1.2rem;
            max-width: 900px;
            text-align: center;
        }

        div[data-testid="stFileUploader"] {
            max-width: 980px;
            padding: 0;
            border-radius: 10px;
            background: var(--gray-50);
            border: 1px solid var(--gray-200);
            margin-left: auto;
            margin-right: auto;
            text-align: center;
        }

        div[data-testid="stFileUploader"] section {
            min-height: 3.35rem;
            background: var(--gray-50);
            border: 0;
            padding: 0.55rem 0.9rem;
            border-radius: 10px;
            justify-content: center;
            text-align: center;
        }

        div[data-testid="stFileUploader"] section > div {
            margin-left: auto;
            margin-right: auto;
            text-align: center;
        }

        div[data-testid="stFileUploader"] button {
            color: var(--blue-900);
            border-color: var(--gray-200);
            border-radius: 8px;
        }

        div[data-testid="stTabs"] > div:first-child {
            display: flex;
            justify-content: center;
        }

        .stTabs [data-baseweb="tab-list"] {
            gap: 0.55rem;
            margin: 0 auto 1.25rem;
            background: var(--gray-100);
            width: fit-content;
            padding: 0.3rem;
            border-radius: 14px;
            justify-content: center;
        }

        .stTabs [data-baseweb="tab"] {
            min-width: 6.2rem;
            height: 2.65rem;
            padding: 0 2.25rem;
            border-radius: 11px;
            background: transparent;
            color: var(--gray-700);
            font-weight: 800;
            font-size: 1.02rem;
            border: 1px solid transparent;
        }

        .stTabs [aria-selected="true"] {
            background: var(--blue-800);
            color: #ffffff;
            box-shadow: 0 4px 10px rgba(15, 76, 129, 0.16);
        }

        .stTabs [data-baseweb="tab-highlight"] {
            display: none;
        }

        .stButton > button {
            width: auto;
            min-width: 14.5rem;
            border: 0;
            border-radius: 9px;
            padding: 0.75rem 1.25rem;
            background: #6f91ad;
            color: white;
            font-weight: 700;
            font-size: 1rem;
            box-shadow: 0 6px 14px rgba(16, 58, 92, 0.12);
        }

        .stButton {
            display: flex;
            justify-content: center;
        }

        .stButton > button:hover {
            border: 0;
            color: white;
            background: var(--blue-800);
        }

        .hint {
            color: var(--gray-500);
            font-size: 0.9rem;
            margin-top: 0.8rem;
        }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="brand">SOKOL</div>
    <div class="main-card">
        <div class="app-title">Инструменты аудита</div>
    </div>
    """,
    unsafe_allow_html=True,
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
        <div class="tool-title">{title}</div>
        <div class="tool-text">{description}</div>
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
        return

    upload_signature = (uploaded_file.name, uploaded_file.size)
    if st.session_state.get(upload_signature_key) != upload_signature:
        st.session_state[upload_signature_key] = upload_signature

    if st.button("Сгенерировать и скачать", key=f"{key_prefix}_button"):
        with st.spinner("Готовим файл..."):
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


az_tab, dz_tab = st.tabs(["АЗ", "ДЗ"])

with az_tab:
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

with dz_tab:
    render_tool(
        key_prefix="dz",
        title="Генерация Докладной Записки",
        description=(
            "Загрузите Аудиторское Заключение в формате .docx с заполненным Разделом II, "
            "чтобы сформировать докладную записку с перечнем рекомендаций."
        ),
        generate=make_memorandum,
    )

