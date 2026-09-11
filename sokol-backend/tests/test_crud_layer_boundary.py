"""Guards that CRUD stays a SQL layer: flush only, no services/MinIO/validation."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
CRUD_DIR = BACKEND_ROOT / "app" / "crud"
ENDPOINTS_DIR = BACKEND_ROOT / "app" / "api" / "v1" / "endpoints"
DB_DIR = BACKEND_ROOT / "app" / "db"

FORBIDDEN_CRUD_MODULES = (
    "app.services",
    "app.schemas",
    "minio",
)
FORBIDDEN_CRUD_NAMES = frozenset({"hash_password", "DuplicateDictionaryError", "DictionaryRefError"})


def _module_name(node: ast.AST) -> list[str]:
    names: list[str] = []
    if isinstance(node, ast.ImportFrom) and node.module:
        names.append(node.module)
    if isinstance(node, ast.Import):
        names.extend(alias.name for alias in node.names)
    return names


def _imported_names(node: ast.AST) -> list[str]:
    if isinstance(node, ast.ImportFrom):
        return [alias.name for alias in node.names]
    if isinstance(node, ast.Import):
        return [alias.name.split(".")[-1] for alias in node.names]
    return []


def _awaits_commit(tree: ast.AST) -> bool:
    for node in ast.walk(tree):
        call: ast.Call | None = None
        if isinstance(node, ast.Await) and isinstance(node.value, ast.Call):
            call = node.value
        elif isinstance(node, ast.Call):
            call = node
        if call is None or not isinstance(call.func, ast.Attribute):
            continue
        if call.func.attr == "commit":
            return True
    return False


class CrudLayerBoundaryTests(unittest.TestCase):
    def test_crud_modules_stay_sql_only(self) -> None:
        import_offenders: list[str] = []
        commit_offenders: list[str] = []
        name_offenders: list[str] = []
        for path in sorted(CRUD_DIR.glob("*.py")):
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(path))
            if _awaits_commit(tree):
                commit_offenders.append(path.name)
            for node in ast.walk(tree):
                for module in _module_name(node):
                    if any(
                        module == forbidden or module.startswith(f"{forbidden}.")
                        for forbidden in FORBIDDEN_CRUD_MODULES
                    ):
                        import_offenders.append(f"{path.name}: {module}")
                for name in _imported_names(node):
                    if name in FORBIDDEN_CRUD_NAMES:
                        name_offenders.append(f"{path.name}: {name}")
        self.assertEqual(import_offenders, [])
        self.assertEqual(commit_offenders, [])
        self.assertEqual(name_offenders, [])

    def test_http_endpoints_do_not_import_crud(self) -> None:
        offenders: list[str] = []
        for path in sorted(ENDPOINTS_DIR.glob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                for module in _module_name(node):
                    if module == "app.crud" or module.startswith("app.crud."):
                        offenders.append(f"{path.name}: {module}")
        self.assertEqual(offenders, [])

    def test_no_root_migrate_shims(self) -> None:
        shims = sorted(path.name for path in DB_DIR.glob("migrate_*.py"))
        self.assertEqual(shims, [])


if __name__ == "__main__":
    unittest.main()
