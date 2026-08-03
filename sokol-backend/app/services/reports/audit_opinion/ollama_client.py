from __future__ import annotations

import os
from typing import Any

import requests

from app.core.config import settings
from app.services.reports.section_ii.models import Observation


def format_observations_context(observations: list[Observation]) -> str:
    lines: list[str] = [
        "Наблюдения и рекомендации из аудиторского заключения:",
        "",
    ]
    for obs in observations:
        lines.append(f"Наблюдение {obs.number}".strip())
        if obs.chapter or obs.chapter_title:
            chapter = " ".join(part for part in [obs.chapter, obs.chapter_title] if part).strip()
            if chapter:
                lines.append(f"Глава / раздел: {chapter}")
        if obs.name:
            lines.append(f"Название: {obs.name.strip()}")
        if obs.materiality_level:
            lines.append(f"Уровень существенности: {obs.materiality_level.strip()}")
        if obs.recommendations:
            lines.append(f"Рекомендации: {obs.recommendations.strip()}")
        if obs.deadline:
            lines.append(f"Срок: {obs.deadline.strip()}")
        lines.append("")
    return "\n".join(lines).strip()


def build_final_prompt(user_prompt: str, observations: list[Observation]) -> str:
    from app.services.reports.audit_opinion.prompts import OBSERVATIONS_PLACEHOLDER

    context = format_observations_context(observations)
    prompt = (user_prompt or "").strip()
    if OBSERVATIONS_PLACEHOLDER in prompt:
        return prompt.replace(OBSERVATIONS_PLACEHOLDER, context)
    if not prompt:
        from app.services.reports.audit_opinion.prompts import DEFAULT_AUDIT_OPINION_PROMPT

        return DEFAULT_AUDIT_OPINION_PROMPT.replace(OBSERVATIONS_PLACEHOLDER, context)
    return f"{prompt}\n\n{context}"


class OllamaError(RuntimeError):
    """Ошибка вызова Ollama."""


def _ollama_url() -> str:
    return (settings.sokol_ollama_url or os.getenv("SOKOL_OLLAMA_URL", "http://localhost:11434")).rstrip("/")


def _ollama_model() -> str:
    return settings.sokol_ollama_model or os.getenv("SOKOL_OLLAMA_MODEL", "qwen3.5:35b")


def _ollama_timeout() -> float:
    return float(settings.sokol_ollama_timeout_s or os.getenv("SOKOL_OLLAMA_TIMEOUT_S", "600"))


def default_model() -> str:
    return _ollama_model()


def list_models() -> list[str]:
    """Список локальных моделей Ollama (имена для /api/chat)."""
    url = f"{_ollama_url()}/api/tags"
    try:
        response = requests.get(url, timeout=15)
    except requests.RequestException as exc:
        raise OllamaError(
            f"Не удалось получить список моделей Ollama ({_ollama_url()}). "
            "Убедитесь, что сервис запущен."
        ) from exc

    if response.status_code >= 400:
        detail = (response.text or "").strip()[:300]
        raise OllamaError(
            f"Ollama вернула ошибку {response.status_code} при запросе моделей"
            + (f": {detail}" if detail else ".")
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise OllamaError("Ollama вернула некорректный JSON со списком моделей.") from exc

    models: list[str] = []
    for item in data.get("models") or []:
        name = (item.get("name") or item.get("model") or "").strip()
        if name:
            models.append(name)
    models = sorted(set(models), key=str.lower)

    default = _ollama_model()
    if default and default not in models:
        models.insert(0, default)
    return models


def generate_text(prompt: str, model: str | None = None) -> str:
    """Синхронный вызов Ollama /api/chat."""
    selected_model = (model or "").strip() or _ollama_model()
    url = f"{_ollama_url()}/api/chat"
    payload: dict[str, Any] = {
        "model": selected_model,
        "stream": False,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты помощник аудитора. Отвечай только готовым текстом аудиторского мнения "
                    "на русском языке, без markdown и без пояснений вне текста мнения."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "options": {
            "temperature": 0.3,
            "num_predict": 4096,
        },
    }
    try:
        response = requests.post(url, json=payload, timeout=_ollama_timeout())
    except requests.Timeout as exc:
        raise OllamaError(
            "Превышено время ожидания ответа Ollama. Увеличьте SOKOL_OLLAMA_TIMEOUT_S "
            "или проверьте, что модель загружена."
        ) from exc
    except requests.RequestException as exc:
        raise OllamaError(
            f"Не удалось подключиться к Ollama ({_ollama_url()}). "
            "Убедитесь, что контейнер/сервис запущен и модель скачана "
            f"(ollama pull {selected_model})."
        ) from exc

    if response.status_code >= 400:
        detail = (response.text or "").strip()[:500]
        raise OllamaError(
            f"Ollama вернула ошибку {response.status_code}"
            + (f": {detail}" if detail else ".")
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise OllamaError("Ollama вернула некорректный JSON.") from exc

    message = data.get("message") or {}
    content = (message.get("content") or data.get("response") or "").strip()
    if not content:
        raise OllamaError("Ollama вернула пустой ответ. Проверьте модель и промпт.")
    return content
