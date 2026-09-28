from __future__ import annotations

import streamlit as st

from sokol_reports.paths import CONTROL_FILE_TEMPLATE
from ui.dictionary_tab import render_dictionary_tab
from ui.tools import (
    ToolSpec,
    make_control_file,
    make_memorandum,
    make_section_ii_plain,
    make_section_ii_with_links,
    render_tool,
)

AZ_TOOLS = (
    ToolSpec(
        key_prefix="az",
        title="1. Парсинг Раздела II Аудиторского Заключения",
        description=(
            "Загрузите Аудиторское Заключение в формате .docx без Раздела II, "
            "чтобы собрать таблицу с основными результатами аудита и аудиторскими рекомендациями."
        ),
        generate=make_section_ii_plain,
    ),
    ToolSpec(
        key_prefix="az_links",
        title="2. Парсинг Раздела II Аудиторского Заключения (с гиперссылками)",
        description=(
            "То же, что в пункте 1, но название каждого наблюдения в таблице будет "
            "гиперссылкой на это наблюдение в тексте документа."
        ),
        generate=make_section_ii_with_links,
    ),
    ToolSpec(
        key_prefix="az_control",
        title="3. Парсинг Аудиторского Заключения под форму файла контроля",
        description=(
            "Загрузите Аудиторское заключение с Разделом II, "
            "чтобы заполнить шаблон для файла контроля."
        ),
        generate=make_control_file,
        output_format="xlsx",
        success_message="Файл контроля готов. Скачивание xlsx началось.",
        template_file=CONTROL_FILE_TEMPLATE,
    ),
)

DZ_TOOLS = (
    ToolSpec(
        key_prefix="dz",
        title="1. Парсинг Приложения 2 к ДЗ",
        description=(
            "Загрузите Аудиторское Заключение в формате .docx с Разделом II, "
            "чтобы сгенерировать Приложение 2 к Докладной Записке."
        ),
        generate=make_memorandum,
    ),
)


def _render_parsing_tools(tools: tuple[ToolSpec, ...]) -> None:
    st.markdown('<div class="section-title">Парсинг</div>', unsafe_allow_html=True)
    for spec in tools:
        render_tool(spec)


def render_az_page() -> None:
    _render_parsing_tools(AZ_TOOLS)


def render_dz_page() -> None:
    _render_parsing_tools(DZ_TOOLS)


def render_dictionary_page() -> None:
    render_dictionary_tab()
