"""Add UNIQUE(check_id, sequence_number) on recommendations.

Dedupes any existing collisions by keeping the lowest id per (check_id, sequence_number)
and renumbering remaining rows per check before creating the constraint.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260930_0002"
down_revision: Union[str, None] = "20260930_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Drop duplicate sequence rows (keep smallest id).
    conn.execute(
        sa.text(
            """
            DELETE FROM recommendations AS r
            USING recommendations AS d
            WHERE r.check_id = d.check_id
              AND r.sequence_number = d.sequence_number
              AND r.id > d.id
            """
        )
    )
    # Renumber remaining rows per check to a dense 1..n sequence.
    conn.execute(
        sa.text(
            """
            WITH ranked AS (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY check_id
                       ORDER BY sequence_number, id
                     ) AS new_seq
              FROM recommendations
            )
            UPDATE recommendations AS r
            SET sequence_number = ranked.new_seq
            FROM ranked
            WHERE r.id = ranked.id
              AND r.sequence_number IS DISTINCT FROM ranked.new_seq
            """
        )
    )
    op.create_unique_constraint(
        "uq_recommendations_check_id_sequence_number",
        "recommendations",
        ["check_id", "sequence_number"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_recommendations_check_id_sequence_number",
        "recommendations",
        type_="unique",
    )
