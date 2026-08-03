from dataclasses import dataclass
from functools import lru_cache
import os


@dataclass(frozen=True)
class SectionIISettings:
    lt_url: str
    lt_lang: str
    lt_enabled: bool


@lru_cache
def get_settings() -> SectionIISettings:
    lt_url = os.getenv("SOKOL_LT_URL", "").strip()
    lt_lang = os.getenv("SOKOL_LT_LANG", "auto")

    return SectionIISettings(
        lt_url=lt_url,
        lt_lang=lt_lang,
        lt_enabled=bool(lt_url),
    )
