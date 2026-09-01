"""Typed filter payloads shared by analytics SQL and dashboard builders."""

from __future__ import annotations

from typing import TypedDict


class PeriodFilterParams(TypedDict, total=False):
    years: list[str] | None
    quarters: list[str] | None
    months: list[str] | None


class CheckFilterParams(PeriodFilterParams, total=False):
    auditors: list[str] | None
    departments: list[str] | None


class RecommendationFilterParams(CheckFilterParams, total=False):
    statuses: list[str] | None
    additional_statuses: list[str] | None
    materiality_levels: list[str] | None


def check_params(
    *,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
) -> CheckFilterParams:
    return {
        "years": years,
        "quarters": quarters,
        "months": months,
        "auditors": auditors,
        "departments": departments,
    }


def recommendation_params(
    *,
    years: list[str] | None = None,
    quarters: list[str] | None = None,
    months: list[str] | None = None,
    auditors: list[str] | None = None,
    departments: list[str] | None = None,
    statuses: list[str] | None = None,
    additional_statuses: list[str] | None = None,
    materiality_levels: list[str] | None = None,
) -> RecommendationFilterParams:
    return {
        "years": years,
        "quarters": quarters,
        "months": months,
        "auditors": auditors,
        "departments": departments,
        "statuses": statuses,
        "additional_statuses": additional_statuses,
        "materiality_levels": materiality_levels,
    }
