from __future__ import annotations


def _normalize_person_value(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _parse_person_parts(value: str) -> tuple[str, str]:
    parts = [
        part
        for part in value.replace(".", " ").strip().split()
        if part
    ]
    if not parts:
        return "", ""

    surname = parts[0].lower()
    initials = "".join(part[0].lower() for part in parts[1:])
    return surname, initials


def _build_initials_patterns(initials: str) -> list[str]:
    if not initials:
        return []

    dotted = ".".join(initials) + "."
    return [dotted, dotted[:-1], initials, " ".join(initials)]


def _initials_decide_match(field_initials: str, user_initials: str) -> bool | None:
    """True/False when initials alone decide; None means try substring patterns."""
    if not user_initials:
        return True
    if not field_initials:
        return None

    shared_length = min(len(field_initials), len(user_initials))
    if field_initials[:shared_length] != user_initials[:shared_length]:
        return False
    if len(field_initials) >= len(user_initials):
        return True
    return None


def person_field_matches_user(person_field: str, user_full_name: str) -> bool:
    """Match short and full person names, e.g. «Иванов А.А.» and «Иванов Александр Александрович»."""
    field = person_field.strip()
    user = user_full_name.strip()

    if not field or not user:
        return False

    if _normalize_person_value(field) == _normalize_person_value(user):
        return True

    field_surname, field_initials = _parse_person_parts(field)
    user_surname, user_initials = _parse_person_parts(user)

    if not field_surname or not user_surname or field_surname != user_surname:
        return False

    initials_decision = _initials_decide_match(field_initials, user_initials)
    if initials_decision is not None:
        return initials_decision

    field_lower = field.lower()
    return any(pattern in field_lower for pattern in _build_initials_patterns(user_initials))
