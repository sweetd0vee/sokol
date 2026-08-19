"""Errors raised by settings dictionary CRUD."""


class DuplicateDictionaryError(ValueError):
    """Raised when a dictionary label already exists."""

    def __init__(self, *, dictionary: str, label: str) -> None:
        self.dictionary = dictionary
        self.label = label
        super().__init__(
            f"Запись «{label}» уже существует в справочнике «{dictionary}»."
        )


class DictionaryInUseError(ValueError):
    """Raised when a dictionary row is referenced by checks or recommendations."""

    def __init__(self, *, dictionary: str, label: str) -> None:
        self.dictionary = dictionary
        self.label = label
        super().__init__(
            f"Нельзя удалить «{label}» из справочника «{dictionary}»: "
            "значение используется в проверках или рекомендациях."
        )


class DictionaryProtectedError(ValueError):
    """Raised when a system dictionary row cannot be renamed or deleted."""

    def __init__(self, *, dictionary: str, label: str, action: str = "удалить") -> None:
        self.dictionary = dictionary
        self.label = label
        self.action = action
        super().__init__(
            f"Системное значение «{label}» нельзя {action} в справочнике «{dictionary}»."
        )
