# -*- coding: utf-8 -*-
"""Парсинг АЗ под шаблон файла контроля (.xlsx)."""

from typing import Optional, Tuple


def generate_control_file_template(input_path: str, output_path: str) -> Tuple[Optional[str], Optional[str]]:
    """Сформировать xlsx-шаблон файла контроля из Аудиторского Заключения с Разделом II.

    Args:
        input_path: Путь к исходному .docx (АЗ с заполненным Разделом II).
        output_path: Путь для сохранения результата (.xlsx).

    Returns:
        Кортеж (путь к результату, сообщение об ошибке). При успехе error — None.
    """
    _ = input_path, output_path
    return None, "Инструмент в разработке"
