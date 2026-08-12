"""Errors raised by settings dictionary CRUD."""


class DuplicateDictionaryError(ValueError):
    """Raised when a dictionary label already exists."""

    def __init__(self, *, dictionary: str, label: str) -> None:
        self.dictionary = dictionary
        self.label = label
        super().__init__(
            f"Запись «{label}» уже существует в справочнике «{dictionary}»."
        )
