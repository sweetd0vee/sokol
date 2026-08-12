#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI-обёртка для генерации презентационного демо-датасета."""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from app.db.presentation_demo_data import PRESENTATION_TODAY, generate_presentation_dataset
from app.utils.paths import get_repo_data_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate presentation demo XLSX for SOKOL.")
    parser.add_argument("--checks-2025", type=int, default=18)
    parser.add_argument("--checks-2026", type=int, default=11)
    parser.add_argument("--seed", type=int, default=20260812)
    parser.add_argument("--today", type=str, default=PRESENTATION_TODAY.isoformat())
    parser.add_argument("--output-dir", type=Path, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir or get_repo_data_dir()
    generate_presentation_dataset(
        output_dir=output_dir,
        checks_2025=args.checks_2025,
        checks_2026=args.checks_2026,
        seed=args.seed,
        today=date.fromisoformat(args.today),
    )
    print(f"Created {output_dir / 'checks.xlsx'}")
    print(f"Created {output_dir / 'recommendations.xlsx'}")


if __name__ == "__main__":
    main()
