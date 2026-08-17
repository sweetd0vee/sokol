"""SOKOL design tokens and Streamlit theme overrides."""

SOKOL_CSS = """
<style>
    :root {
        --sber-dark: #003366;
        --sber-light: #6699ff;
        --sber-muted: #1d4ed8;
        --gray-50: #f9fafb;
        --gray-100: #f3f4f6;
        --gray-200: #e5e7eb;
        --gray-300: #d1d5db;
        --gray-500: #6b7280;
        --gray-700: #374151;
        --gray-900: #111827;
        --section-border: #b8bec8;
        --text: #111827;
    }

    /* Hide default Streamlit chrome */
    header[data-testid="stHeader"] {
        background: transparent;
        pointer-events: none;
    }

    header[data-testid="stHeader"] > div {
        display: none;
    }

    #MainMenu,
    footer,
    .stDeployButton {
        visibility: hidden;
    }

    .stApp {
        background: #ffffff;
        color: var(--text);
        font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .block-container {
        max-width: 72rem;
        padding: calc(88px + 2rem) 2rem 3rem;
    }

    div[data-testid="stMarkdownContainer"]:has(.sokol-topbar),
    div[data-testid="stMarkdownContainer"]:has(.sokol-topbar) * {
        color: #ffffff !important;
    }

    /* Top bar — mirrors React Sidebar header */
    .sokol-topbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999;
        height: 88px;
        background: var(--sber-dark);
        border-bottom: 1px solid rgba(102, 153, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff !important;
    }

    .sokol-topbar__logo,
    .sokol-topbar h1,
    .sokol-topbar p,
    .sokol-topbar span,
    .sokol-topbar * {
        margin: 0;
        font-size: 1.875rem;
        font-weight: 600;
        color: #ffffff !important;
        letter-spacing: 0.02em;
    }

    /* Page header — matches PageHeader.tsx */
    .page-title {
        margin: 0 0 2rem;
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.25;
        color: var(--sber-dark);
        text-align: left;
    }

    /* Segmented control — matches SegmentedControl.tsx */
    div[data-testid="stRadio"] > div[role="radiogroup"] {
        gap: 0.5rem;
        flex-wrap: nowrap;
    }

    div[data-testid="stRadio"] label {
        min-width: 156px;
        margin: 0 !important;
        padding: 0.35rem 0.625rem !important;
        border-radius: 0.5rem !important;
        background: var(--gray-100) !important;
        border: 1px solid transparent !important;
        justify-content: center;
        color: var(--gray-700) !important;
        transition: background-color 0.15s ease, color 0.15s ease;
    }

    div[data-testid="stRadio"] label:hover:not(:has(input:checked)):not([data-checked="true"]) {
        background: var(--gray-200) !important;
    }

    div[data-testid="stRadio"] label > div:first-child {
        display: none;
    }

    div[data-testid="stRadio"] label span,
    div[data-testid="stRadio"] label p,
    div[data-testid="stRadio"] label div[data-testid="stMarkdownContainer"] {
        font-size: 0.875rem;
        font-weight: 500;
        color: inherit !important;
    }

    div[data-testid="stRadio"] label[data-checked="true"],
    div[data-testid="stRadio"] label[aria-checked="true"],
    div[data-testid="stRadio"] label:has(input:checked) {
        background: var(--sber-dark) !important;
        color: #ffffff !important;
    }

    div[data-testid="stRadio"] label[data-checked="true"]:hover,
    div[data-testid="stRadio"] label[aria-checked="true"]:hover,
    div[data-testid="stRadio"] label:has(input:checked):hover {
        background: var(--sber-dark) !important;
        color: #ffffff !important;
    }

    div[data-testid="stRadio"] label[data-checked="true"] *,
    div[data-testid="stRadio"] label[aria-checked="true"] *,
    div[data-testid="stRadio"] label:has(input:checked) * {
        color: #ffffff !important;
    }

    /* Section card — matches FORM_SECTION_CLASS */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border-color: var(--section-border) !important;
        border-radius: 0.5rem !important;
        padding: 1.25rem !important;
        background: #ffffff;
    }

    .section-title {
        margin: 0 0 1.25rem;
        font-size: 1.125rem;
        font-weight: 600;
        line-height: 1.375;
        color: var(--gray-900);
        text-align: left;
    }

    /* Tool panel — matches DocxToolPanel.tsx */
    .tool-panel {
        padding-top: 0.5rem;
        padding-bottom: 2rem;
    }

    .tool-panel:last-child {
        padding-bottom: 0;
    }

    .tool-panel + .tool-panel {
        margin-top: 0.5rem;
    }

    .tool-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--gray-900);
        text-align: left;
    }

    .tool-text {
        margin: 0.25rem 0 1rem;
        font-size: 1rem;
        line-height: 1.5;
        color: var(--gray-500);
        text-align: left;
        max-width: 52rem;
    }

    div[data-testid="stFileUploader"] {
        width: 100%;
        max-width: 100%;
        padding: 0;
    }

    div[data-testid="stFileUploader"] section {
        width: 100%;
        min-height: 6.5rem;
        padding: 0.75rem 1rem;
        background: var(--gray-100);
        border: none;
        border-radius: 0.5rem;
        transition: background-color 0.15s ease;
    }

    div[data-testid="stFileUploader"] section[data-testid="stFileUploadDropzone"] {
        width: 100%;
    }

    div[data-testid="stFileUploader"]:hover section {
        background: var(--gray-200);
    }

    div[data-testid="stFileUploader"] section > div {
        text-align: center;
    }

    div[data-testid="stFileUploader"] button {
        color: var(--sber-dark);
        border-color: var(--gray-300);
        border-radius: 0.5rem;
        font-size: 0.875rem;
    }

    div[data-testid="stFileUploader"] small {
        color: var(--gray-500);
    }

    .stButton {
        display: flex;
        justify-content: flex-start;
    }

    .stButton > button {
        min-height: 2.75rem;
        margin-top: 1rem;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        box-shadow: none;
    }

    .stButton > button[kind="primary"] {
        border: 0;
        background: var(--sber-dark);
        color: #ffffff;
        transition: background-color 0.15s ease, opacity 0.15s ease;
    }

    .stButton > button[kind="secondary"] {
        margin-top: 0;
        margin-bottom: 1rem;
        border: 1px solid var(--gray-300);
        background: #ffffff;
        color: var(--sber-dark);
        transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .stButton > button[kind="primary"]:hover:not(:disabled) {
        border: 0;
        color: #ffffff;
        background: var(--sber-muted);
    }

    .stButton > button[kind="secondary"]:hover:not(:disabled) {
        border-color: var(--sber-dark);
        background: var(--gray-50);
        color: var(--sber-dark);
    }

    .stButton > button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: var(--sber-dark);
        color: #ffffff;
    }

    div[data-testid="stAlert"] {
        width: 100%;
        max-width: 100%;
        border-radius: 0.75rem;
        font-size: 0.875rem;
    }

    div[data-testid="stAlert"][data-baseweb="notification"] {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
    }

    .stSpinner > div {
        border-top-color: var(--sber-dark) !important;
    }

    .dictionary-hint {
        margin: 0 0 1.25rem;
    }

    .dictionary-hint code {
        font-size: 0.875rem;
        color: var(--gray-700);
        background: var(--gray-100);
        padding: 0.1rem 0.35rem;
        border-radius: 0.25rem;
    }

    div[data-testid="stDataEditor"] {
        border: 1px solid var(--section-border);
        border-radius: 0.5rem;
        overflow: hidden;
    }

    .mode-switch-spacer {
        height: 0.75rem;
    }
</style>
"""


def inject_theme() -> None:
    import streamlit as st

    st.markdown(SOKOL_CSS, unsafe_allow_html=True)
