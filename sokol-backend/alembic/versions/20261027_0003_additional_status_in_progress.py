"""Add recommendation_additional_status value in_progress.

The model and analytics already use this label. Stands created before it was
added to the enum (or rebuilt by the legacy status patch) reject the cast.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20261027_0003"
down_revision: Union[str, None] = "20260930_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE cannot run inside a transaction block on PostgreSQL < 12.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE recommendation_additional_status "
            "ADD VALUE IF NOT EXISTS 'in_progress'"
        )


def downgrade() -> None:
    # PostgreSQL has no DROP VALUE for a single enum label.
    pass
