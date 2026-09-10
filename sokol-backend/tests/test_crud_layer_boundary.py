"""Guards that CRUD stays a SQL layer without service imports."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

CRUD_DIR = Path(__file__).resolve().parents[1] / "app" / "crud"


class CrudLayerBoundaryTests(unittest.TestCase):
    def test_crud_modules_do_not_import_services(self) -> None:
        offenders: list[str] = []
        for path in sorted(CRUD_DIR.glob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("app.services"):
                    offenders.append(f"{path.name}: from {node.module}")
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name.startswith("app.services"):
                            offenders.append(f"{path.name}: import {alias.name}")
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
