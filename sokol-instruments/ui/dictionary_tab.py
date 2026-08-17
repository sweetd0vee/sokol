import pandas as pd
import streamlit as st

from sokol_reports.dictionaries.department_store import (
    load_departments,
    normalize_departments,
    reset_departments,
    save_departments,
    validate_departments,
)


def ensure_departments_loaded() -> None:
    if "departments" not in st.session_state:
        st.session_state.departments = load_departments()


def get_active_departments() -> list[str]:
    ensure_departments_loaded()
    return list(st.session_state.departments)


def render_dictionary_tab() -> None:
    ensure_departments_loaded()

    st.markdown(
        """
        <div class="section-title">Департаменты</div>
        <p class="tool-text dictionary-hint">
            Справочник используется при генерации докладной записки и нормализации объектов аудита.
            Изменения сохраняются локально в файл <code>data/departments.json</code>.
        </p>
        """,
        unsafe_allow_html=True,
    )

    table = pd.DataFrame({"Департамент": st.session_state.departments})
    edited = st.data_editor(
        table,
        num_rows="dynamic",
        use_container_width=True,
        hide_index=True,
        column_config={
            "Департамент": st.column_config.TextColumn(
                "Департамент",
                required=True,
                max_chars=256,
            ),
        },
        key="departments_editor",
    )

    save_col, reset_col, info_col = st.columns([1, 1, 2])
    with save_col:
        save_clicked = st.button("Сохранить", key="departments_save", type="primary")
    with reset_col:
        reset_clicked = st.button("Сбросить к встроенному", key="departments_reset")

    if save_clicked:
        raw_names = edited["Департамент"].tolist() if "Департамент" in edited.columns else []
        error = validate_departments(raw_names)
        if error:
            st.error(error)
        else:
            names = normalize_departments(raw_names)
            save_departments(names)
            st.session_state.departments = names
            st.success(f"Сохранено департаментов: {len(names)}.")

    if reset_clicked:
        names = reset_departments()
        st.session_state.departments = names
        st.session_state.pop("departments_editor", None)
        st.success("Справочник восстановлен из встроенного списка.")
        st.rerun()

    with info_col:
        st.caption(f"Сейчас в справочнике: {len(st.session_state.departments)} департаментов.")
