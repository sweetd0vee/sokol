import re


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

DATE_RE = r"\d{1,2}[./]\d{1,2}[./](?:\d{4}|\d{2})"
# Любое вхождение в тексте (в т.ч. перекрёстные ссылки).
OBS_START_RE = re.compile(
    r"\bНаблюдени[ея]\s*(?:№|N|No\.?)?\s*(\d+(?:\.\d+)*)(?:[.)\s:;—–\-]*)",
    re.IGNORECASE,
)
# Заголовок наблюдения в начале абзаца/ячейки/строки (3.1, 3.3.1, 4.1.1, …).
OBS_BLOCK_START_RE = re.compile(
    r"^\s*Наблюдени[ея]\s*(?:№|N|No\.?)?\s*(\d+(?:\.\d+)*)(?:[.)\s:;—–\-]*)",
    re.IGNORECASE,
)
# То же для многострочного текста: только с начала строки.
OBS_LINE_START_RE = re.compile(
    r"(?m)^\s*Наблюдени[ея]\s*(?:№|N|No\.?)?\s*(\d+(?:\.\d+)*)(?:[.)\s:;—–\-]*)",
    re.IGNORECASE,
)
REC_LABEL_RE = re.compile(
    r"(Аудиторск\w*\s+рекомендац\w*|Рекомендаци[яи]|Мероприятия\s+после\s+аудита)\s*[:—–\-]?",
    re.IGNORECASE,
)
AUDIT_REC_LABEL_RE = re.compile(
    r"(?:Аудиторск\w*\s+рекомендац\w*|Рекомендаци[яи])\s*[:—–\-]",
    re.IGNORECASE,
)
SROK_TAIL_RE = re.compile(
    rf"\bСрок(?:\s+(?:исполнения|реализации|выполнения))?\s*(?:[—–\-:]?\s*)?"
    rf"(?:до\s*)?(?:{DATE_RE}|с\s*{DATE_RE}\s*по\s*{DATE_RE})"
    r"\s*(?:г\.?)?\.?",
    re.IGNORECASE,
)
SROK_MARK_RE = SROK_TAIL_RE
NAME_CUTOFF_PATTERNS = [
    # Тело наблюдения (не заголовок) — часто сразу после названия.
    r"Проверкой\s+установлено",
    r"В\s+ходе\s+проверки\s+установлено",
    r"В\s+результате\s+проверки",
    r"Уровень\s+существенности",
    r"Аудиторск\w*\s+рекомендац\w*",
    r"Рекомендаци[яи]\s*[:—–\-]",
    r"Мероприятия\s+после\s+аудита",
]

CHAPTER_RE = re.compile(
    r"^\s*(Глава|Раздел)\s+([IVXLCDM]+|\d+)\s*[.\-:]?\s*(.*)$",
    re.IGNORECASE,
)
ROMAN_HEADING_RE = re.compile(r"^\s*([IVXLCDM]+)\s*[.)–—\-:]?\s+(.+)$", re.IGNORECASE)
SUBCHAPTER_RE = re.compile(r"^\s*(\d+(?:\.\d+)+)\.\s+(.+)$", re.IGNORECASE)

SECTION2_ROMAN_ONLY_RE = re.compile(
    r"^\s*(?:Раздел\s+)?II\s*(?![IVXLCDM])[.)–—\-:]?\s*$",
    re.IGNORECASE,
)
SECTION2_START_RE = re.compile(
    r"^\s*(?:Раздел\s+)?II\s*(?![IVXLCDM])[.)–—\-:]?",
    re.IGNORECASE,
)
SECTION1_START_RE = re.compile(
    r"^\s*(?:Раздел\s+)?I\s*(?![IVXLCDM])[.)–—\-:]?",
    re.IGNORECASE,
)
SECTION2_TOC_TEXT_RE = re.compile(
    r"\bII\b|Основные\s+результаты|итогов\w*\s+аудиторск|аудиторск\w*\s+рекомендац",
    re.IGNORECASE,
)
SECTION1_TOC_TEXT_RE = re.compile(
    r"(?:^|\s)(?:Раздел\s+)?I\s*[.)–—\-:]?\s*Аудиторское\s*мнение|\bI\b.*Аудиторское\s*мнение|^\s*Аудиторское\s*мнение",
    re.IGNORECASE,
)
SECTION3_TOC_TEXT_RE = re.compile(
    r"\bIII\b|Детальные\s+результаты|^\s*(?:Раздел\s+)?3\s*[.)–—\-:]?",
    re.IGNORECASE,
)
DEFAULT_SECTION2_HEADING = (
    "II. Основные результаты аудита и аудиторские рекомендации"
)
DEFAULT_SECTION2_HEADING_TITLE = (
    "Основные результаты аудита и аудиторские рекомендации"
)
