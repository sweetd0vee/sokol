"""Генерация раздела I «Аудиторское мнение по итогам проверки» через Ollama."""

from app.services.reports.audit_opinion.processor import process_document
from app.services.reports.audit_opinion.prompts import DEFAULT_AUDIT_OPINION_PROMPT

__all__ = ["process_document", "DEFAULT_AUDIT_OPINION_PROMPT"]
