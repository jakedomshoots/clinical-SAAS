"""Add task notification acknowledgement.

Revision ID: 011_task_notification_acknowledgement
Revises: 010_assistant_proposals
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_task_notification_acknowledgement"
down_revision: Union[str, None] = "010_assistant_proposals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("notification_acknowledged_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "notification_acknowledged_at")
