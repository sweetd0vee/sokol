"""Baseline schema matching current SQLAlchemy models (tables, enums, indexes, FKs).

Fresh DB: ``upgrade`` builds the full schema.
Existing DB already created via ``create_all`` + legacy patches: stamp this revision
(see ``app.db.alembic_runner.ensure_schema``) — row data is not touched.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.models import Base

# revision identifiers, used by Alembic.
revision: str = "20260930_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    # Drop in FK-safe order (metadata handles dependency sorting).
    Base.metadata.drop_all(bind=bind)
