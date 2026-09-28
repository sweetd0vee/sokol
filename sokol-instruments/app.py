"""SOKOL Streamlit app: audit-document tools."""

from __future__ import annotations

import streamlit as st

from sokol_reports.paths import FAVICON_PATH
from ui.dictionary_tab import ensure_departments_loaded
from ui.pages import render_az_page, render_dictionary_page, render_dz_page
from ui.theme import inject_theme


def main() -> None:
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

    with st.container(border=True):
        if mode == "Справочник":
            render_dictionary_page()
        elif mode == "АЗ":
            render_az_page()
        else:
            render_dz_page()


main()
